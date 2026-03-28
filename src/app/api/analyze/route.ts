import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';

import { analyzePage } from '@/lib/analyze-page';
import { ANALYZE_ROUTE_TIMEOUT_MS } from '@/lib/analysis-budget';
import {
  DemoFixtureKey,
  getDemoFixtureKey,
  getDemoFixtureUrl,
  getFallbackData,
  OPENDOOR_DEMO,
  SONO_BELLO_DEMO,
} from '@/lib/demo-data';
import {
  isGeminiFormatError,
  isGeminiTransportError,
  isLLMTimeoutError,
} from '@/lib/gemini';
import { kv } from '@/lib/kv-client';
import {
  getExpiryMetadataKey,
  createExpiryMetadata,
  getExpiryMetadataTtlSeconds,
  isExpired,
  parseExpiryMetadata,
} from '@/lib/kv-expiry';
import {
  checkRateLimit,
  getDemoModeHeadersForRequest,
  getRateLimitHeaders,
} from '@/lib/rate-limit';
import { AnalyzeResponseData } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ANALYSIS_TTL_SECONDS = Number.parseInt(process.env.ANALYSIS_TTL_SECONDS || '300', 10);
const DEMO_TTL_SECONDS = 3600;
type RouteTimeoutPhase = 'analysis' | 'finalization';

class RouteTimeoutError extends Error {
  phase: RouteTimeoutPhase;

  constructor(phase: RouteTimeoutPhase) {
    super('TIMEOUT');
    this.name = 'RouteTimeoutError';
    this.phase = phase;
  }
}

function normalizeUrl(url: string) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }

  return url;
}

function createAnalysisId() {
  return `aid_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

function isValidUrl(url: string) {
  try {
    new URL(normalizeUrl(url));
    return true;
  } catch {
    return false;
  }
}

function getAnalysisTargetUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.hostname.includes('sonobello.com') &&
      parsedUrl.pathname.startsWith('/consultation')
    ) {
      return 'https://www.sonobello.com/';
    }
  } catch {
    return url;
  }

  return url;
}

function jsonResponse(
  payload: unknown,
  init: ResponseInit = {},
  headers: Record<string, string> = {}
) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });
}

function isDemoFixtureKey(value: unknown): value is DemoFixtureKey {
  return value === 'opendoor' || value === 'sonobello';
}

function getDemoPayload(url: string, fixtureOverride?: DemoFixtureKey) {
  const fixture = fixtureOverride || getDemoFixtureKey(url);
  const template = fixture === 'opendoor' ? OPENDOOR_DEMO : SONO_BELLO_DEMO;
  const payload = structuredClone(template);

  return {
    ...withAnalysisId(payload, createAnalysisId()),
    landingPageUrl: url,
  };
}

function withAnalysisId(data: AnalyzeResponseData, analysisId: string) {
  return {
    ...data,
    analysisId,
    createdAt: new Date().toISOString(),
  };
}

function createTimeoutFallbackPayload(url: string) {
  return withAnalysisId(
    {
      ...getFallbackData(url),
      landingPageUrl: url,
    },
    createAnalysisId()
  );
}

function isRouteTimeoutError(error: unknown, phase?: RouteTimeoutPhase): error is RouteTimeoutError {
  return error instanceof RouteTimeoutError && (!phase || error.phase === phase);
}

function getScreenshotApiUrl(analysisId: string) {
  return `/api/screenshot?id=${analysisId}`;
}

function withPrimaryScreenshotApiUrl(data: AnalyzeResponseData) {
  // Demo fixtures and timeout fallbacks use checked-in public assets; keep those stable.
  if (data.isSimulatedData) {
    return data;
  }

  const screenshotUrl =
    data.screenshot.status === 'ok'
      ? getScreenshotApiUrl(data.analysisId)
      : data.screenshot.url;
  const hasPrimaryStepScreenshot = Boolean(data.journey[0]?.screenshotUrl);

  return {
    ...data,
    screenshot: data.screenshot.status === 'ok'
      ? {
          ...data.screenshot,
          url: screenshotUrl,
        }
      : data.screenshot,
    journey: hasPrimaryStepScreenshot
      ? data.journey.map((step, index) =>
          index === 0
            ? {
                ...step,
                screenshotUrl,
              }
            : step
        )
      : data.journey,
  };
}

function getPublicAssetPath(assetUrl: string) {
  return path.join(process.cwd(), 'public', assetUrl.replace(/^\//, ''));
}

async function readPublicPngBase64(assetUrl: string) {
  const pngBytes = await readFile(getPublicAssetPath(assetUrl));
  return pngBytes.toString('base64');
}

async function resolvePrimaryScreenshotBase64(data: AnalyzeResponseData) {
  const primaryScreenshot = data.journey[0]?.screenshotBase64;
  if (primaryScreenshot) {
    return primaryScreenshot;
  }

  const primaryScreenshotUrl = data.journey[0]?.screenshotUrl || data.screenshot.url;
  if (!primaryScreenshotUrl || primaryScreenshotUrl.startsWith('/api/screenshot')) {
    return null;
  }

  return primaryScreenshotUrl.startsWith('/')
    ? readPublicPngBase64(primaryScreenshotUrl)
    : null;
}

async function storeAnalysis(data: AnalyzeResponseData, ttlSeconds: number) {
  const expiryMetadata = createExpiryMetadata(ttlSeconds);

  await Promise.all([
    kv.set(`analysis:${data.analysisId}`, data, { ex: ttlSeconds }),
    kv.set(
      getExpiryMetadataKey('analysis', data.analysisId),
      JSON.stringify(expiryMetadata),
      { ex: getExpiryMetadataTtlSeconds(ttlSeconds) }
    ),
  ]);
}

async function storeScreenshot(analysisId: string, screenshotBase64: string | null | undefined, ttlSeconds: number) {
  if (!screenshotBase64) {
    return;
  }

  const expiryMetadata = createExpiryMetadata(ttlSeconds);

  await Promise.all([
    kv.set(`screenshot:${analysisId}`, screenshotBase64, { ex: ttlSeconds }),
    kv.set(
      getExpiryMetadataKey('screenshot', analysisId),
      JSON.stringify(expiryMetadata),
      { ex: getExpiryMetadataTtlSeconds(ttlSeconds) }
    ),
  ]);
}

async function persistArtifacts(data: AnalyzeResponseData, ttlSeconds: number) {
  const primaryScreenshot = await resolvePrimaryScreenshotBase64(data);
  const preparedData = withPrimaryScreenshotApiUrl(data);

  await Promise.all([
    storeAnalysis(preparedData, ttlSeconds),
    storeScreenshot(preparedData.analysisId, primaryScreenshot, ttlSeconds),
  ]);

  return preparedData;
}

async function storeDemoPayload(data: AnalyzeResponseData) {
  return persistArtifacts(data, DEMO_TTL_SECONDS);
}

async function storeLiveArtifacts(data: AnalyzeResponseData) {
  return persistArtifacts(data, ANALYSIS_TTL_SECONDS);
}

async function runWithinRouteBudget<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
  deadlineMs: number,
  phase: RouteTimeoutPhase
) {
  if (signal.aborted || Date.now() >= deadlineMs) {
    throw new RouteTimeoutError(phase);
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new RouteTimeoutError(phase));
    signal.addEventListener('abort', onAbort, { once: true });

    operation().then(
      (result) => {
        signal.removeEventListener('abort', onAbort);
        resolve(result);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

function kvWriteErrorResponse(requestId: string, headers: Record<string, string>) {
  return jsonResponse(
    {
      success: false,
      error: {
        code: 'KV_WRITE_ERROR',
        message: 'Failed to store analysis result',
        retryable: true,
      },
      fallbackAvailable: true,
      requestId,
      timestamp: new Date().toISOString(),
    },
    { status: 503 },
    headers
  );
}

function finalizationTimeoutResponse(requestId: string, headers: Record<string, string>) {
  return jsonResponse(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: `Analysis finalization exceeded the ${Math.ceil(ANALYZE_ROUTE_TIMEOUT_MS / 1000)}-second deadline`,
        retryable: true,
      },
      fallbackAvailable: true,
      requestId,
      timestamp: new Date().toISOString(),
    },
    { status: 503 },
    headers
  );
}

function mapAnalyzeError(error: unknown): {
  status: number;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  headers: Record<string, string>;
} {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (isGeminiFormatError(error)) {
    return {
      status: 503,
      error: {
        code: 'LLM_ERROR',
        message: 'Gemini API returned malformed or incomplete JSON',
        retryable: true,
      },
      headers: {},
    };
  }

  if (isGeminiTransportError(error)) {
    return {
      status: 503,
      error: {
        code: 'LLM_ERROR',
        message: 'Gemini API error or malformed JSON',
        retryable: true,
      },
      headers: {},
    };
  }

  if (errorMessage === 'NO_FORM_DETECTED') {
    return {
      status: 422,
      error: {
        code: 'NO_FORM_DETECTED',
        message: 'No form found on this page',
        retryable: false,
      },
      headers: {},
    };
  }

  if (errorMessage === 'PRIMARY_FORM_UNCERTAIN') {
    return {
      status: 422,
      error: {
        code: 'PRIMARY_FORM_UNCERTAIN',
        message: 'Unable to confidently identify the primary form on this page',
        retryable: false,
      },
      headers: {},
    };
  }

  if (errorMessage === 'SCRAPING_BLOCKED') {
    return {
      status: 422,
      error: {
        code: 'SCRAPING_BLOCKED',
        message: 'Target site blocks automated access',
        retryable: false,
      },
      headers: {
        'X-Error-Source': 'scraper',
      },
    };
  }

  if (errorMessage === 'NETWORK_FAILURE') {
    return {
      status: 503,
      error: {
        code: 'NETWORK_FAILURE',
        message: 'Target site could not be reached due to a network error',
        retryable: true,
      },
      headers: {},
    };
  }

  if (errorMessage === 'PAGE_NOT_FOUND') {
    return {
      status: 422,
      error: {
        code: 'PAGE_NOT_FOUND',
        message: 'URL returned 404 or DNS failure',
        retryable: false,
      },
      headers: {},
    };
  }

  if (
    /vertex ai (configuration error|authentication failed)/i.test(errorMessage) ||
    /google_cloud_(project_id|location)/i.test(errorMessage) ||
    /google_application_credentials/i.test(errorMessage) ||
    /service account json/i.test(errorMessage)
  ) {
    return {
      status: 503,
      error: {
        code: 'LLM_ERROR',
        message: 'Google Cloud AI credentials are missing or invalid',
        retryable: true,
      },
      headers: {},
    };
  }

  if (/bot|blocked/i.test(errorMessage)) {
    return {
      status: 422,
      error: {
        code: 'SCRAPING_BLOCKED',
        message: 'Target site blocks automated access',
        retryable: false,
      },
      headers: {
        'X-Error-Source': 'scraper',
      },
    };
  }

  if (
    /err_connection_refused|err_address_unreachable|err_connection_closed|connection refused|address unreachable|connection closed/i.test(
      errorMessage
    )
  ) {
    return {
      status: 503,
      error: {
        code: 'NETWORK_FAILURE',
        message: 'Target site could not be reached due to a network error',
        retryable: true,
      },
      headers: {},
    };
  }

  if (
    /404|dns|enotfound|err_name_not_resolved|could not resolve host|server ip address could not be found/i.test(
      errorMessage
    )
  ) {
    return {
      status: 422,
      error: {
        code: 'PAGE_NOT_FOUND',
        message: 'URL returned 404 or could not be resolved',
        retryable: false,
      },
      headers: {},
    };
  }

  if (/llm|vertex|gemini|unexpected response format/i.test(errorMessage)) {
    return {
      status: 503,
      error: {
        code: 'LLM_ERROR',
        message: 'Gemini API error or malformed JSON',
        retryable: true,
      },
      headers: {},
    };
  }

  return {
    status: 422,
    error: {
      code: 'SCRAPING_BLOCKED',
      message: errorMessage || 'Target site blocks automated access',
      retryable: false,
    },
    headers: {},
  };
}

export async function POST(request: NextRequest) {
  const requestId = `req_${uuidv4().slice(0, 8)}`;
  const startTime = Date.now();
  const deadlineMs = startTime + ANALYZE_ROUTE_TIMEOUT_MS;
  const rateLimit = await checkRateLimit(request);
  const rateLimitHeaders = getRateLimitHeaders(rateLimit);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANALYZE_ROUTE_TIMEOUT_MS);

  if (rateLimit.limited) {
    return jsonResponse(
      {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Rate limit exceeded. Try again in ${rateLimit.retryAfter} seconds.`,
          retryable: true,
        },
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 429 },
      rateLimitHeaders
    );
  }

  try {
    const body = await request.json();
    const {
      url,
      demoFixture,
    } = body as {
      url?: string;
      demoFixture?: DemoFixtureKey | string;
    };
    const requestedDemoFixture = demoFixture === undefined
      ? undefined
      : isDemoFixtureKey(demoFixture)
        ? demoFixture
        : null;

    if (requestedDemoFixture === null) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: 'INVALID_DEMO_FIXTURE',
            message: 'Demo fixture must be opendoor or sonobello',
            retryable: false,
          },
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
        rateLimitHeaders
      );
    }

    const requestedUrl = url || (requestedDemoFixture ? getDemoFixtureUrl(requestedDemoFixture) : undefined);

    if (!requestedUrl) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: 'MISSING_URL',
            message: 'Request body missing url field',
            retryable: false,
          },
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
        rateLimitHeaders
      );
    }

    if (!isValidUrl(requestedUrl)) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: 'INVALID_URL',
            message: 'URL format not recognized',
            retryable: false,
          },
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
        rateLimitHeaders
      );
    }

    const normalizedUrl = normalizeUrl(requestedUrl);
    const analysisTargetUrl = getAnalysisTargetUrl(normalizedUrl);
    const selectedDemoFixture = requestedDemoFixture || getDemoFixtureKey(normalizedUrl);
    const useDemoMode = rateLimit.forceDemoMode || Boolean(requestedDemoFixture);

    if (useDemoMode) {
      try {
        const demoData = await runWithinRouteBudget(
          () => storeDemoPayload(getDemoPayload(normalizedUrl, selectedDemoFixture)),
          controller.signal,
          deadlineMs,
          'finalization'
        );

        return jsonResponse(
          {
            success: true,
            data: demoData,
            requestId,
            latencyMs: Date.now() - startTime,
          },
          { status: 200 },
          rateLimitHeaders
        );
      } catch (kvError) {
        if (isRouteTimeoutError(kvError, 'finalization')) {
          return finalizationTimeoutResponse(requestId, rateLimitHeaders);
        }

        console.error('KV write error:', kvError);
        return kvWriteErrorResponse(requestId, rateLimitHeaders);
      }
    }

    let result: AnalyzeResponseData;
    let fallbackReason: 'timeout' | undefined;

    try {
      result = await runWithinRouteBudget(
        () => analyzePage(analysisTargetUrl, controller.signal),
        controller.signal,
        deadlineMs,
        'analysis'
      );

      if (analysisTargetUrl !== normalizedUrl) {
        result = {
          ...result,
          landingPageUrl: normalizedUrl,
        };
      }
    } catch (error) {
      if (isRouteTimeoutError(error, 'analysis') || isLLMTimeoutError(error)) {
        result = createTimeoutFallbackPayload(normalizedUrl);
        fallbackReason = 'timeout';
      } else {
        const mapped = mapAnalyzeError(error);

        return jsonResponse(
          {
            success: false,
            error: mapped.error,
            fallbackAvailable: true,
            requestId,
            timestamp: new Date().toISOString(),
          },
          { status: mapped.status, headers: mapped.headers },
          rateLimitHeaders
        );
      }
    }

    try {
      result = await runWithinRouteBudget(
        () => storeLiveArtifacts(result),
        controller.signal,
        deadlineMs,
        'finalization'
      );
    } catch (kvError) {
      if (isRouteTimeoutError(kvError, 'finalization')) {
        return finalizationTimeoutResponse(requestId, rateLimitHeaders);
      }

      console.error('KV write error:', kvError);
      return kvWriteErrorResponse(requestId, rateLimitHeaders);
    }

    return jsonResponse(
      {
        success: true,
        data: result,
        fallbackReason,
        requestId,
        latencyMs: Date.now() - startTime,
      },
      { status: 200 },
      rateLimitHeaders
    );
  } catch (error) {
    console.error('Unexpected error:', error);

    return jsonResponse(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          retryable: true,
        },
        fallbackAvailable: true,
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
      rateLimitHeaders
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function HEAD(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...getDemoModeHeadersForRequest(request),
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  const requestId = `req_${uuidv4().slice(0, 8)}`;
  const { searchParams } = new URL(request.url);
  const aid = searchParams.get('aid');

  if (!aid) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'MISSING_AID',
          message: "Query parameter 'aid' is required",
          retryable: false,
        },
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  try {
    const [stored, expiryMetadataValue] = await Promise.all([
      kv.get<string | AnalyzeResponseData>(`analysis:${aid}`),
      kv.get<string>(getExpiryMetadataKey('analysis', aid)),
    ]);

    if (stored) {
      return NextResponse.json({
        success: true,
        data: typeof stored === 'string' ? JSON.parse(stored) : stored,
        requestId,
        latencyMs: 0,
      });
    }

    const expiryMetadata = parseExpiryMetadata(expiryMetadataValue);
    if (isExpired(expiryMetadata)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ANALYSIS_EXPIRED',
            message: 'Stored analysis exceeded TTL and was purged',
            retryable: false,
          },
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 410 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'ANALYSIS_NOT_FOUND',
          message: 'No stored analysis found for analysis ID',
          retryable: false,
        },
        requestId,
        timestamp: new Date().toISOString(),
      },
      {
        status: 404,
        headers: {
          'X-Analysis-Id': aid,
        },
      }
    );
  } catch (error) {
    console.error('KV read error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'KV_READ_ERROR',
          message: 'Failed to retrieve analysis result',
          retryable: true,
        },
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
