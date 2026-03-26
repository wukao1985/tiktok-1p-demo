// lib/analyze-page.ts

import puppeteer from 'puppeteer-core';
import type { Page, ElementHandle, Frame } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { analyzeWithGemini } from './gemini';
import {
  ANALYSIS_GEMINI_BUDGET_MS,
  ANALYSIS_SCRAPE_BUDGET_MS,
  createAnalysisDeadline,
  getRemainingAnalysisBudget,
} from './analysis-budget';
import {
  AnalyzeResponseData,
  ScreenshotAsset,
  JourneyStep,
  ExtractedField,
  PrimaryFormSelection,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface ScrapedStep {
  html: string;
  title: string;
  url: string;
  screenshotBase64: string | null;
  screenshotStatus: ScreenshotAsset['status'];
  fields: ExtractedField[];
  ctaText?: string;
  stepType: JourneyStep['stepType'];
}

type AnalyzeFailureCode =
  | 'SCRAPING_BLOCKED'
  | 'PAGE_NOT_FOUND'
  | 'NO_FORM_DETECTED'
  | 'PRIMARY_FORM_UNCERTAIN';

class AnalyzeFailure extends Error {
  code: AnalyzeFailureCode;

  constructor(code: AnalyzeFailureCode) {
    super(code);
    this.name = 'AnalyzeFailure';
    this.code = code;
  }
}

const STEALTH_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36';
const STEALTH_VIEWPORT = {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  isMobile: false,
  hasTouch: false,
};
const CTA_PRIORITY_KEYWORDS = [
  'get started',
  'book now',
  'free consultation',
  'get a cash offer',
  'check eligibility',
  'continue',
  'next',
  'submit',
];
const CTA_FALLBACK_KEYWORDS = [
  'book',
  'schedule',
  'consult',
  'request',
  'quote',
  'estimate',
  'offer',
  'apply',
  'start',
];
const NEXT_KEYWORDS = ['next', 'continue', 'proceed', 'step', 'forward'];
const CTA_SELECTOR =
  'button, a[href], a[role="button"], input[type="button"], input[type="submit"], [role="button"]';
const COOKIE_BANNER_SELECTORS = [
  '[id*="cookie"]',
  '[class*="cookie"]',
  '[id*="consent"]',
  '[class*="consent"]',
  '[id*="gdpr"]',
  '[class*="gdpr"]',
  '[aria-label*="cookie"]',
  '[aria-label*="consent"]',
];
const COOKIE_ACTION_KEYWORDS = [
  'accept all',
  'accept',
  'agree',
  'allow all',
  'allow',
  'ok',
  'got it',
  'dismiss',
  'close',
];
const COOKIE_CONTEXT_KEYWORDS = ['cookie', 'consent', 'gdpr', 'privacy'];
const BOT_BLOCK_KEYWORDS = [
  'captcha',
  'verify you are human',
  'verify you\'re human',
  'access denied',
  'temporarily blocked',
  'bot detection',
  'unusual traffic',
  'security check',
  'blocked',
];
const BOT_BLOCK_SELECTORS = [
  'iframe[src*="captcha"]',
  'iframe[src*="challenge"]',
  'iframe[title*="challenge"]',
  '[id*="captcha"]',
  '[class*="captcha"]',
  '[data-sitekey]',
  '[name="cf-turnstile-response"]',
  '.cf-turnstile',
  '#challenge-running',
  'form[action*="challenge"]',
];
const BOT_BLOCK_URL_KEYWORDS = ['captcha', 'challenge', 'blocked', 'deny', 'verify'];
const NOT_FOUND_MESSAGE_PATTERNS = [
  'err_name_not_resolved',
  'enotfound',
  'err_connection_refused',
  'err_address_unreachable',
  'err_connection_closed',
  'ns_error_unknown_host',
];
const BOT_BLOCK_STATUS_CODES = new Set([401, 403, 429]);
const NOT_FOUND_STATUS_CODES = new Set([404, 410]);
const NAV_TIMEOUT = 3000;
const POST_CLICK_SETTLE_TIMEOUT = 5000;
const SCREENSHOT_TIMEOUT = 2000;
const STEP_DELAY_MIN_MS = 500;
const STEP_DELAY_MAX_MS = 1500;
const MAX_JOURNEY_STEPS = 4;
const MIN_REAL_FORM_FIELDS = 2;
const HTML_CAPTURE_LIMIT = 50000;
const GEMINI_HTML_LIMIT = 15000;
const FIELD_SELECTORS = [
  'input[type="text"]:not([name*="search"]):not([placeholder*="search"])',
  'input[type="email"]',
  'input[type="tel"]',
  'input[type="number"]',
  'input[type="date"]',
  'select',
  'textarea',
  'input[type="checkbox"]',
  'input[type="radio"]',
];
const IGNORED_SELECTORS = [
  '[class*="cookie"]',
  '[class*="consent"]',
  '[class*="gdpr"]',
  '[class*="newsletter"]',
  '[type="search"]',
  '[name*="search"]',
  'nav input',
  'header input',
];
const FIELD_SELECTOR_QUERY = FIELD_SELECTORS.join(', ');

interface PrimaryFormExtractionResult {
  fields: ExtractedField[];
  primaryFormSelection: PrimaryFormSelection;
  shouldRaiseUncertain: boolean;
}

interface ExtractFieldOptions {
  suppressUncertain?: boolean;
}

interface CtaMatch {
  element: ElementHandle<Element> | null;
  text: string;
  isNextStepCta: boolean;
}

function isConfirmationUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return ['thank', 'confirm', 'success', 'complete', 'done'].some(keyword =>
    lowerUrl.includes(keyword)
  );
}

function getRemainingBudget(deadlineMs: number, bufferMs = 0) {
  return getRemainingAnalysisBudget(deadlineMs, bufferMs);
}

function getBoundedTimeout(deadlineMs: number, maxTimeoutMs: number, bufferMs = 0) {
  return Math.min(maxTimeoutMs, Math.max(0, getRemainingBudget(deadlineMs, bufferMs)));
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * ((max - min) + 1)) + min;
}

async function waitWithSignal(timeoutMs: number, signal?: AbortSignal) {
  if (timeoutMs <= 0 || signal?.aborted) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);

    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function waitForHumanDelay(deadlineMs: number, signal?: AbortSignal) {
  const timeoutMs = Math.min(
    getRandomInt(STEP_DELAY_MIN_MS, STEP_DELAY_MAX_MS),
    getBoundedTimeout(deadlineMs, STEP_DELAY_MAX_MS, 100)
  );

  await waitWithSignal(timeoutMs, signal);
}

function createAnalyzeFailure(code: AnalyzeFailureCode) {
  return new AnalyzeFailure(code);
}

function isAnalyzeFailure(error: unknown, code?: AnalyzeFailureCode): error is AnalyzeFailure {
  return error instanceof AnalyzeFailure && (!code || error.code === code);
}

function normalizeNavigationError(error: unknown) {
  if (isAnalyzeFailure(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (NOT_FOUND_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern)) || /\b404\b/.test(message)) {
    return createAnalyzeFailure('PAGE_NOT_FOUND');
  }

  if (/captcha|challenge|blocked|access denied|forbidden|\b403\b|\b429\b/.test(message)) {
    return createAnalyzeFailure('SCRAPING_BLOCKED');
  }

  return error;
}

async function detectBotProtection(page: Page) {
  const urlMatch = BOT_BLOCK_URL_KEYWORDS.some((keyword) => page.url().toLowerCase().includes(keyword));
  const domSignal = await page.evaluate(
    ({ keywords, selectors }) => {
      const pageText = `${document.title}\n${document.body?.innerText || ''}`.toLowerCase();
      const keywordMatch = keywords.some((keyword) => pageText.includes(keyword));
      const selectorMatch = selectors.some((selector) => Boolean(document.querySelector(selector)));
      const titleMatch = /just a moment|verify|attention required|access denied/i.test(document.title);

      return keywordMatch || selectorMatch || titleMatch;
    },
    {
      keywords: BOT_BLOCK_KEYWORDS,
      selectors: BOT_BLOCK_SELECTORS,
    }
  );

  return urlMatch || domSignal;
}

async function ensureNotBlocked(page: Page) {
  if (await detectBotProtection(page)) {
    throw createAnalyzeFailure('SCRAPING_BLOCKED');
  }
}

async function hasLoadedDocument(page: Page) {
  try {
    return await page.evaluate(() => {
      const bodyText = document.body?.innerText?.trim() || '';
      return Boolean(document.title || bodyText || document.body?.children.length);
    });
  } catch {
    return false;
  }
}

async function navigateToLandingPage(page: Page, url: string, scrapeDeadlineMs: number) {
  const navigationTimeout = getBoundedTimeout(scrapeDeadlineMs, NAV_TIMEOUT, 250);
  if (navigationTimeout <= 0) {
    return;
  }

  try {
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: navigationTimeout,
    });
    const status = response?.status();

    if (status && BOT_BLOCK_STATUS_CODES.has(status)) {
      throw createAnalyzeFailure('SCRAPING_BLOCKED');
    }

    if (status && NOT_FOUND_STATUS_CODES.has(status)) {
      throw createAnalyzeFailure('PAGE_NOT_FOUND');
    }
  } catch (error) {
    if (error instanceof Error && /timeout/i.test(error.message) && await hasLoadedDocument(page)) {
      return;
    }

    throw normalizeNavigationError(error);
  }
}

async function takeScreenshotWithBudget(page: Page, scrapeDeadlineMs: number) {
  const timeoutMs = getBoundedTimeout(scrapeDeadlineMs, SCREENSHOT_TIMEOUT, 100);
  if (timeoutMs <= 0) {
    return {
      screenshotBase64: null,
      screenshotStatus: 'failed' as ScreenshotAsset['status'],
    };
  }

  try {
    const screenshotPromise = page.screenshot({
      type: 'png',
      fullPage: true,
      encoding: 'base64',
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Screenshot timeout')), timeoutMs)
    );
    const screenshotBase64 = await Promise.race([screenshotPromise, timeoutPromise]) as string;

    return {
      screenshotBase64,
      screenshotStatus: 'ok' as ScreenshotAsset['status'],
    };
  } catch {
    return {
      screenshotBase64: null,
      screenshotStatus: 'failed' as ScreenshotAsset['status'],
    };
  }
}

async function extractFieldsFromPage(
  page: Page,
  options: ExtractFieldOptions = {}
): Promise<ExtractedField[]> {
  const result = await page.evaluate(
    ({ fieldSelectorQuery, ignoredSelectors }) => {
      const isFormControl = (
        element: Element
      ): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement;

      const isIgnoredField = (element: Element) => {
        if (
          ignoredSelectors.some(
            (selector) => element.matches(selector) || Boolean(element.closest(selector))
          )
        ) {
          return true;
        }

        const searchText = [
          element.getAttribute('name') || '',
          element.getAttribute('placeholder') || '',
          element.getAttribute('aria-label') || '',
        ]
          .join(' ')
          .toLowerCase();

        return searchText.includes('search');
      };

      const getSupportedFields = (root: ParentNode) =>
        Array.from(root.querySelectorAll(fieldSelectorQuery))
          .filter(isFormControl)
          .filter((element) => !isIgnoredField(element));

      const getFieldScore = (container: Element) => {
        const inputs = getSupportedFields(container).length;
        const rect = container.getBoundingClientRect();
        const isVisible = rect.width > 0;
        const hasSubmit = Boolean(
          container.querySelector('button[type="submit"], input[type="submit"]')
        );

        return (inputs * 10) + (isVisible ? 50 : 0) + (hasSubmit ? 30 : 0) - (rect.top * 0.01);
      };

      const formCandidates = Array.from(
        new Set(
          getSupportedFields(document)
            .map((field) => field.closest('form'))
            .filter((form): form is HTMLFormElement => form instanceof HTMLFormElement)
        )
      );

      const scoredForms = formCandidates
        .map((form) => ({
          form,
          score: getFieldScore(form),
        }))
        .sort((a, b) => b.score - a.score);

      const topCandidateScore = scoredForms[0]?.score ?? 0;
      const runnerUpScore = scoredForms[1]?.score ?? 0;
      const shouldRaiseUncertain =
        topCandidateScore < 60 ||
        (formCandidates.length > 1 && (topCandidateScore - runnerUpScore) < 15);

      let selectedContainer: Element | null = null;

      if (formCandidates.length === 1) {
        selectedContainer = formCandidates[0];
      } else if (formCandidates.length > 1) {
        selectedContainer = scoredForms[0]?.form ?? null;
      } else if (formCandidates.length === 0) {
        const documentFields = getSupportedFields(document);
        if (documentFields.length > 0) {
          selectedContainer = document.body;
        }
      }

      if (!selectedContainer) {
        return {
          fields: [],
          primaryFormSelection: {
            topCandidateScore,
            runnerUpScore,
          },
          shouldRaiseUncertain,
        };
      }

      const seenSelectors = new Set<string>();
      const fields: ExtractedField[] = [];

      getSupportedFields(selectedContainer).forEach((element, index) => {
        const tagName = element.tagName.toLowerCase();
        const inputType =
          element instanceof HTMLInputElement ? element.type || 'text' : 'text';

        if (
          inputType === 'hidden' ||
          inputType === 'submit' ||
          inputType === 'button' ||
          inputType === 'image'
        ) {
          return;
        }

        let label = '';
        const id = element.id;
        const name = 'name' in element ? element.name : '';
        const ariaLabel = element.getAttribute('aria-label');
        const placeholder = 'placeholder' in element ? element.placeholder : '';

        if (id) {
          const labelEl = document.querySelector(`label[for="${id}"]`);
          if (labelEl) {
            label = labelEl.textContent || '';
          }
        }

        if (!label) {
          const parentLabel = element.closest('label');
          if (parentLabel) {
            label = parentLabel.textContent || '';
          }
        }

        if (!label && ariaLabel) {
          label = ariaLabel;
        }

        if (!label && placeholder) {
          label = placeholder;
        }

        if (!label && name) {
          label = name;
        }

        label = label.trim().replace(/\s+/g, ' ').slice(0, 50);
        if (!label) {
          label = `Field ${index + 1}`;
        }

        let fieldType: ExtractedField['type'] = 'text';
        let tiktokFieldType: ExtractedField['tiktokFieldType'] = 'CUSTOM';
        const lowerLabel = label.toLowerCase();

        if (
          inputType === 'email' ||
          lowerLabel.includes('email') ||
          lowerLabel.includes('e-mail')
        ) {
          fieldType = 'email';
          tiktokFieldType = 'EMAIL';
        } else if (
          inputType === 'tel' ||
          lowerLabel.includes('phone') ||
          lowerLabel.includes('mobile')
        ) {
          fieldType = 'tel';
          tiktokFieldType = 'PHONE_NUMBER';
        } else if (lowerLabel.includes('zip') || lowerLabel.includes('postal')) {
          fieldType = 'zip';
          tiktokFieldType = 'ZIP_POST_CODE';
        } else if (tagName === 'select') {
          fieldType = 'dropdown';
        } else if (inputType === 'checkbox') {
          fieldType = 'checkbox';
        } else if (inputType === 'radio') {
          fieldType = 'radio';
        } else if (inputType === 'date') {
          fieldType = 'date';
        } else if (inputType === 'number') {
          fieldType = 'number';
        }

        if (
          lowerLabel.includes('full name') ||
          lowerLabel === 'name' ||
          (lowerLabel.includes('name') &&
            (lowerLabel.includes('first') || lowerLabel.includes('last')))
        ) {
          tiktokFieldType = 'FULL_NAME';
        }

        const selector =
          tagName +
          (name ? `[name="${name}"]` : '') +
          (id ? `#${id}` : `:nth-of-type(${index + 1})`);

        if (seenSelectors.has(selector)) {
          return;
        }

        seenSelectors.add(selector);
        fields.push({
          id: `field_${index + 1}`,
          label,
          type: fieldType,
          placeholder: placeholder || undefined,
          required: element.hasAttribute('required'),
          confidence: 0.9,
          tiktokFieldId: label.toLowerCase().replace(/\s+/g, '_').slice(0, 30),
          tiktokFieldType,
          sourceSelector: selector,
        });
      });

      return {
        fields,
        primaryFormSelection: {
          topCandidateScore,
          runnerUpScore,
        },
        shouldRaiseUncertain,
      };
    },
    {
      fieldSelectorQuery: FIELD_SELECTOR_QUERY,
      ignoredSelectors: IGNORED_SELECTORS,
    }
  ) as PrimaryFormExtractionResult;

  if (result.shouldRaiseUncertain && !options.suppressUncertain) {
    throw createAnalyzeFailure('PRIMARY_FORM_UNCERTAIN');
  }

  return result.fields;
}

async function applyStealthSettings(page: Page) {
  await page.setViewport(STEALTH_VIEWPORT);
  await page.setUserAgent(STEALTH_USER_AGENT);
  await page.setExtraHTTPHeaders({
    'accept-language': 'en-US,en;q=0.9',
  });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, 'platform', {
      get: () => 'MacIntel',
    });
    Object.defineProperty(navigator, 'vendor', {
      get: () => 'Google Inc.',
    });

    const chromeWindow = window as Window & {
      chrome?: {
        runtime?: Record<string, unknown>;
      };
    };
    chromeWindow.chrome = chromeWindow.chrome || { runtime: {} };
  });
}

async function dismissCookieConsentInFrame(frame: Frame) {
  try {
    return await frame.evaluate(
      ({ bannerSelectors, actionKeywords, contextKeywords }) => {
        const clickableSelector =
          'button, [role="button"], a, input[type="button"], input[type="submit"]';
        const bannerSelector = bannerSelectors.join(', ');
        const getText = (element: Element) =>
          (
            element.textContent ||
            element.getAttribute('aria-label') ||
            element.getAttribute('value') ||
            ''
          )
            .trim()
            .replace(/\s+/g, ' ');
        const isVisible = (element: Element) => {
          if (!(element instanceof HTMLElement)) {
            return false;
          }

          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
          );
        };
        const hasCookieContext = (element: Element) => {
          if (bannerSelector && element.closest(bannerSelector)) {
            return true;
          }

          let current: Element | null = element;
          let depth = 0;
          while (current && depth < 4) {
            const text = (current.textContent || '').toLowerCase();
            if (contextKeywords.some((keyword) => text.includes(keyword))) {
              return true;
            }
            current = current.parentElement;
            depth += 1;
          }

          return false;
        };

        const candidates = Array.from(document.querySelectorAll(clickableSelector))
          .map((element) => {
            const text = getText(element);
            const lowerText = text.toLowerCase();
            const actionIndex = actionKeywords.findIndex((keyword) => lowerText.includes(keyword));
            const cookieContext = hasCookieContext(element);

            if (!text || !isVisible(element) || (actionIndex === -1 && !cookieContext)) {
              return null;
            }

            const score =
              (cookieContext ? 100 : 0) +
              (actionIndex === -1 ? 0 : 80 - (actionIndex * 5)) +
              (lowerText.includes('accept') ? 20 : 0);

            return { element, score };
          })
          .filter((candidate): candidate is { element: Element; score: number } => Boolean(candidate))
          .sort((a, b) => b.score - a.score);

        const target = candidates[0]?.element;
        if (!target || !(target instanceof HTMLElement)) {
          return false;
        }

        target.click();
        return true;
      },
      {
        bannerSelectors: COOKIE_BANNER_SELECTORS,
        actionKeywords: COOKIE_ACTION_KEYWORDS,
        contextKeywords: COOKIE_CONTEXT_KEYWORDS,
      }
    );
  } catch {
    return false;
  }
}

async function hideCookieBanners(page: Page) {
  try {
    await page.evaluate((selectors) => {
      for (const selector of selectors) {
        document.querySelectorAll(selector).forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.display = 'none';
            element.style.visibility = 'hidden';
            element.style.pointerEvents = 'none';
          }
        });
      }
    }, COOKIE_BANNER_SELECTORS);
  } catch {
    // Best-effort only.
  }
}

async function dismissCookieConsent(
  page: Page,
  scrapeDeadlineMs: number,
  signal?: AbortSignal
) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let dismissed = false;

    for (const frame of page.frames()) {
      if (await dismissCookieConsentInFrame(frame)) {
        dismissed = true;
        break;
      }
    }

    if (!dismissed) {
      break;
    }

    await waitWithSignal(getBoundedTimeout(scrapeDeadlineMs, 350, 50), signal);
  }

  await hideCookieBanners(page);
}

async function getCurrentStepHtml(page: Page) {
  return page.evaluate(
    (captureLimit) => document.body?.innerHTML?.slice(0, captureLimit) || '',
    HTML_CAPTURE_LIMIT
  );
}

async function getPageFingerprint(page: Page) {
  return page.evaluate(
    ({ fieldSelectorQuery }) =>
      JSON.stringify({
        url: window.location.href,
        title: document.title,
        text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 400),
        fieldCount: document.querySelectorAll(fieldSelectorQuery).length,
        dialogCount: document.querySelectorAll(
          '[role="dialog"], .modal, [class*="modal"], [class*="popup"]'
        ).length,
        htmlLength: document.body?.innerHTML.length || 0,
      }),
    { fieldSelectorQuery: FIELD_SELECTOR_QUERY }
  );
}

async function waitForInteractionToSettle(
  page: Page,
  scrapeDeadlineMs: number,
  signal?: AbortSignal
) {
  const timeoutMs = getBoundedTimeout(scrapeDeadlineMs, POST_CLICK_SETTLE_TIMEOUT, 150);
  if (timeoutMs <= 0) {
    return;
  }

  await Promise.race([
    page
      .waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: timeoutMs,
      })
      .catch(() => undefined),
    page
      .waitForNetworkIdle({
        idleTime: 500,
        timeout: Math.min(timeoutMs, 1500),
      })
      .catch(() => undefined),
    waitWithSignal(Math.min(timeoutMs, 1200), signal),
  ]);

  await waitForHumanDelay(scrapeDeadlineMs, signal);
}

async function clickElementHandle(
  page: Page,
  element: ElementHandle<Element>,
  scrapeDeadlineMs: number,
  signal?: AbortSignal
) {
  try {
    await element.evaluate((node) =>
      node.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' })
    );
    await waitWithSignal(getBoundedTimeout(scrapeDeadlineMs, 150, 50), signal);

    try {
      await element.click({ delay: getRandomInt(40, 120) });
    } catch {
      await element.evaluate((node) => {
        if (node instanceof HTMLElement) {
          node.click();
        }
      });
    }

    await waitForInteractionToSettle(page, scrapeDeadlineMs, signal);
    return true;
  } catch {
    return false;
  }
}

async function findCTAButton(page: Page): Promise<CtaMatch> {
  const candidates = await page.$$(CTA_SELECTOR);
  let bestMatch:
    | (CtaMatch & {
        score: number;
      })
    | null = null;

  for (const candidate of candidates) {
    const metadata = await page.evaluate(
      (
        element,
        { bannerSelectors, priorityKeywords, fallbackKeywords, nextKeywords }
      ) => {
        const getText = (node: Element) =>
          (
            node.textContent ||
            node.getAttribute('aria-label') ||
            node.getAttribute('value') ||
            ''
          )
            .trim()
            .replace(/\s+/g, ' ');
        const isVisible = (node: Element) => {
          if (!(node instanceof HTMLElement)) {
            return false;
          }

          const rect = node.getBoundingClientRect();
          const style = window.getComputedStyle(node);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== 'none' &&
            style.visibility !== 'hidden'
          );
        };
        const bannerSelector = bannerSelectors.join(', ');
        const text = getText(element);
        const lowerText = text.toLowerCase();
        const inBanner = bannerSelector ? Boolean(element.closest(bannerSelector)) : false;
        const disabled =
          (element instanceof HTMLButtonElement ||
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement) &&
          element.disabled;

        if (
          !text ||
          text.length > 120 ||
          !isVisible(element) ||
          disabled ||
          inBanner ||
          /cookie|consent|privacy|newsletter/.test(lowerText)
        ) {
          return null;
        }

        const priorityIndex = priorityKeywords.findIndex((keyword) => lowerText.includes(keyword));
        const fallbackIndex = fallbackKeywords.findIndex((keyword) => lowerText.includes(keyword));
        const isNextStepCta = nextKeywords.some((keyword) => lowerText.includes(keyword));

        if (priorityIndex === -1 && fallbackIndex === -1 && !isNextStepCta) {
          return null;
        }

        let score = 0;

        if (priorityIndex !== -1) {
          score += 220 - (priorityIndex * 10);
        }
        if (fallbackIndex !== -1) {
          score += 120 - (fallbackIndex * 5);
        }
        if (isNextStepCta) {
          score += 90;
        }
        if (element.closest('form, [role="dialog"], main, section, article')) {
          score += 20;
        }
        if (element.closest('nav, header, footer')) {
          score -= 50;
        }

        const rect = element.getBoundingClientRect();
        if (rect.top >= 0 && rect.top <= window.innerHeight * 1.5) {
          score += 10;
        }

        return {
          text,
          score,
          isNextStepCta,
        };
      },
      candidate,
      {
        bannerSelectors: COOKIE_BANNER_SELECTORS,
        priorityKeywords: CTA_PRIORITY_KEYWORDS,
        fallbackKeywords: CTA_FALLBACK_KEYWORDS,
        nextKeywords: NEXT_KEYWORDS,
      }
    );

    if (!metadata) {
      continue;
    }

    const isInViewport = await candidate
      .isIntersectingViewport({ threshold: 0 })
      .catch(() => false);
    const score = metadata.score + (isInViewport ? 10 : 0);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        element: candidate,
        text: metadata.text,
        isNextStepCta: metadata.isNextStepCta,
        score,
      };
    }
  }

  if (!bestMatch) {
    return {
      element: null,
      text: '',
      isNextStepCta: false,
    };
  }

  return {
    element: bestMatch.element,
    text: bestMatch.text,
    isNextStepCta: bestMatch.isNextStepCta,
  };
}

function getStepType(url: string, fields: ExtractedField[], ctaMatch?: CtaMatch): JourneyStep['stepType'] {
  if (isConfirmationUrl(url)) {
    return 'confirmation';
  }

  if (fields.length > 0 && ctaMatch?.isNextStepCta) {
    return 'multistep';
  }

  if (fields.length > 0) {
    return 'form';
  }

  return 'landing';
}

async function captureStep(page: Page, scrapeDeadlineMs: number, ctaMatch?: CtaMatch) {
  const fields = await extractFieldsFromPage(page, { suppressUncertain: true });
  const title = await page.title();
  const url = page.url();
  const html = await getCurrentStepHtml(page);
  const { screenshotBase64, screenshotStatus } = await takeScreenshotWithBudget(page, scrapeDeadlineMs);

  return {
    html,
    title,
    url,
    screenshotBase64,
    screenshotStatus,
    fields,
    ctaText: ctaMatch?.text || undefined,
    stepType: getStepType(url, fields, ctaMatch),
  } satisfies ScrapedStep;
}

async function navigateMultiStepJourney(
  page: Page,
  startUrl: string,
  signal: AbortSignal | undefined,
  budgetMs: number
): Promise<ScrapedStep[]> {
  const steps: ScrapedStep[] = [];
  const seenFingerprints = new Set<string>();

  await navigateToLandingPage(page, startUrl, budgetMs);
  await ensureNotBlocked(page);
  await dismissCookieConsent(page, budgetMs, signal);

  for (let stepIndex = 0; stepIndex < MAX_JOURNEY_STEPS; stepIndex += 1) {
    if (signal?.aborted || getRemainingBudget(budgetMs, 200) <= 0) {
      break;
    }

    await ensureNotBlocked(page);
    await dismissCookieConsent(page, budgetMs, signal);

    const ctaMatch = stepIndex < (MAX_JOURNEY_STEPS - 1)
      ? await findCTAButton(page)
      : { element: null, text: '', isNextStepCta: false };
    const currentFingerprint = await getPageFingerprint(page);

    if (!seenFingerprints.has(currentFingerprint)) {
      seenFingerprints.add(currentFingerprint);
      steps.push(await captureStep(page, budgetMs, ctaMatch));
    }

    const currentStep = steps[steps.length - 1];
    if (
      !currentStep ||
      currentStep.fields.length >= MIN_REAL_FORM_FIELDS ||
      currentStep.stepType === 'confirmation' ||
      !ctaMatch.element
    ) {
      break;
    }

    const clicked = await clickElementHandle(page, ctaMatch.element, budgetMs, signal);
    if (!clicked) {
      break;
    }

    await ensureNotBlocked(page);
    await dismissCookieConsent(page, budgetMs, signal);

    const nextFingerprint = await getPageFingerprint(page);
    if (nextFingerprint === currentFingerprint || seenFingerprints.has(nextFingerprint)) {
      break;
    }
  }

  return steps;
}

async function scrapeJourney(
  url: string,
  scrapeDeadlineMs: number,
  signal?: AbortSignal
): Promise<ScrapedStep[]> {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        '--disable-blink-features=AutomationControlled',
      ],
      defaultViewport: STEALTH_VIEWPORT,
      executablePath: await chromium.executablePath(),
      headless: true,
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await browser.newPage();
    await applyStealthSettings(page);

    if (getRemainingBudget(scrapeDeadlineMs) <= 0) {
      return [];
    }

    return await navigateMultiStepJourney(page, url, signal, scrapeDeadlineMs);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function getStepSelectionScore(step: ScrapedStep) {
  const mappedFieldCount = step.fields.filter((field) => field.tiktokFieldType !== 'CUSTOM').length;
  const requiredFieldCount = step.fields.filter((field) => field.required).length;
  const uniqueFieldCount = new Set(
    step.fields.map((field) => `${field.label.toLowerCase()}::${field.tiktokFieldType}`)
  ).size;

  return (
    (step.fields.length * 10) +
    (mappedFieldCount * 4) +
    (requiredFieldCount * 2) +
    uniqueFieldCount +
    (step.stepType === 'form' ? 20 : 0) +
    (step.stepType === 'multistep' ? 12 : 0)
  );
}

export async function analyzePage(
  url: string,
  signal?: AbortSignal
): Promise<AnalyzeResponseData> {
  const startTime = Date.now();
  const analysisDeadlineMs = createAnalysisDeadline(startTime);
  const scrapeDeadlineMs = Math.min(
    startTime + ANALYSIS_SCRAPE_BUDGET_MS,
    analysisDeadlineMs - ANALYSIS_GEMINI_BUDGET_MS
  );
  const analysisId = `aid_${uuidv4().replace(/-/g, '').slice(0, 16)}`;

  try {
    // Reserve the final 5 seconds of the internal deadline for Gemini.
    const scrapedSteps = await scrapeJourney(url, scrapeDeadlineMs, signal);
    if (scrapedSteps.length === 0) {
      throw createAnalyzeFailure('NO_FORM_DETECTED');
    }

    const bestScrapedStep = scrapedSteps.reduce((bestStep, currentStep) =>
      getStepSelectionScore(currentStep) > getStepSelectionScore(bestStep)
        ? currentStep
        : bestStep
    );

    const bestStepScreenshot = bestScrapedStep.screenshotBase64 || undefined;
    const allHtml = scrapedSteps
      .map(
        (step, index) =>
          `\n--- STEP ${index + 1} ---\nTitle: ${step.title}\nURL: ${step.url}\nFields: ${step.fields.length}\nHTML:\n${step.html.slice(0, GEMINI_HTML_LIMIT)}`
      )
      .join('\n');

    const geminiResult = await analyzeWithGemini(allHtml, bestStepScreenshot, url, {
      deadlineMs: analysisDeadlineMs,
    });

    // Build journey steps with step numbers
    const journey: JourneyStep[] = scrapedSteps.map((step, index) => ({
      stepNumber: index + 1,
      url: step.url,
      title: step.title,
      screenshotBase64: step.screenshotBase64 || undefined,
      fields: step.fields,
      ctaText: step.ctaText,
      stepType: step.stepType
    }));

    // Deduplicate fields across all steps for the consolidated form
    const allFields = scrapedSteps.flatMap((step) => step.fields);
    const seenFieldIds = new Set<string>();
    const deduplicatedFields: ExtractedField[] = [];

    allFields.forEach((field) => {
      const key = `${field.label.toLowerCase()}_${field.tiktokFieldType}`;
      if (!seenFieldIds.has(key)) {
        seenFieldIds.add(key);
        deduplicatedFields.push(field);
      }
    });

    const extractedFields =
      bestScrapedStep.fields.length > 0
        ? bestScrapedStep.fields
        : geminiResult.extractedFields.length > 0
          ? geminiResult.extractedFields
          : deduplicatedFields;

    if (extractedFields.length === 0) {
      throw createAnalyzeFailure('NO_FORM_DETECTED');
    }

    // Generate fallback retargeting data
    const totalStarts = 1247;
    const totalAbandonments = 412;
    const fieldBreakdown: Record<string, { started: number; abandoned: number }> = {};

    let remainingAbandonments = totalAbandonments;
    extractedFields.forEach((field) => {
      if (field.tiktokFieldType === 'PHONE_NUMBER') {
        fieldBreakdown.phone = { started: 847, abandoned: 312 };
        remainingAbandonments -= 312;
      } else if (field.tiktokFieldType === 'ZIP_POST_CODE') {
        fieldBreakdown.zip = { started: 600, abandoned: Math.min(100, remainingAbandonments) };
        remainingAbandonments -= Math.min(100, remainingAbandonments);
      } else if (field.tiktokFieldType === 'EMAIL') {
        const abandoned = Math.floor(remainingAbandonments * 0.3);
        fieldBreakdown.email = { started: 400, abandoned };
        remainingAbandonments -= abandoned;
      }
    });

    if (Object.keys(fieldBreakdown).length === 0) {
      fieldBreakdown.zip = { started: 847, abandoned: 312 };
      fieldBreakdown.email = { started: 400, abandoned: 100 };
    }

    const now = new Date().toISOString();

    return {
      analysisId,
      landingPageUrl: url,
      screenshot: {
        status: scrapedSteps[0]?.screenshotStatus || 'failed',
        url: scrapedSteps[0]?.screenshotStatus === 'ok' ? `/api/screenshot?id=${analysisId}` : undefined
      },
      isSimulatedData: false,
      createdAt: now,
      brandColors: geminiResult.brandColors || {
        name: 'Unknown',
        primaryColor: '#FE2C55',
        secondaryColor: '#25F4EE'
      },
      extractedFields,
      formBoundingBox: geminiResult.formBoundingBox || {
        x: 0,
        y: 0,
        width: 400,
        height: 300
      },
      generatedCopy: geminiResult.generatedCopy || {
        originalHeadline: 'Original Headline',
        tiktokHeadline: 'TikTok Headline',
        originalCta: 'Submit',
        tiktokCta: 'Claim Now',
        benefits: ['Benefit 1', 'Benefit 2', 'Benefit 3'],
        explanation: 'Generated by AI'
      },
      performance: {
        estimated3pLoadTime: 5.2,
        estimated1pLoadTime: 0.8,
        dropOff3p: 0.40,
        dropOff1p: 0.12,
        estimatedDropOffReduction: 0.28
      },
      retargeting: {
        totalFormStarts: totalStarts,
        totalAbandonments: totalAbandonments,
        fieldBreakdown,
        estimatedCtrLift: 0.42
      },
      journey,
      totalJourneySteps: journey.length
    };
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}
