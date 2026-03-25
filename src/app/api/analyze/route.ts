import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { v4 as uuidv4 } from 'uuid';

import { analyzePage } from '@/lib/analyze-page';
import { getFallbackData, OPENDOOR_DEMO, SONO_BELLO_DEMO } from '@/lib/demo-data';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { AnalyzeResponseData } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const ANALYSIS_TTL_SECONDS = Number.parseInt(process.env.ANALYSIS_TTL_SECONDS || '300', 10);
const DEMO_TTL_SECONDS = 3600;

function normalizeUrl(url: string) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }

  return url;
}

function isValidUrl(url: string) {
  try {
    new URL(normalizeUrl(url));
    return true;
  } catch {
    return false;
  }
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

function getDemoPayload(url: string) {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('opendoor.com')) {
    return {
      ...OPENDOOR_DEMO,
      landingPageUrl: url,
      createdAt: new Date().toISOString(),
    };
  }

  return {
    ...SONO_BELLO_DEMO,
    landingPageUrl: url,
    createdAt: new Date().toISOString(),
  };
}

function getDemoFixture(aid: string) {
  if (aid === 'demo_sonobello') {
    return SONO_BELLO_DEMO;
  }

  if (aid === 'demo_opendoor') {
    return OPENDOOR_DEMO;
  }

  return null;
}

function withAnalysisId(data: AnalyzeResponseData, analysisId: string) {
  const screenshotUrl =
    data.screenshot.status === 'ok' && data.screenshot.url?.startsWith('/api/screenshot')
      ? `/api/screenshot?id=${analysisId}`
      : data.screenshot.url;

  return {
    ...data,
    analysisId,
    createdAt: new Date().toISOString(),
    screenshot: data.screenshot.status === 'ok'
      ? {
          ...data.screenshot,
          url: screenshotUrl,
        }
      : data.screenshot,
  };
}

async function storeAnalysis(data: AnalyzeResponseData, ttlSeconds: number) {
  await kv.set(`analysis:${data.analysisId}`, JSON.stringify(data), { ex: ttlSeconds });
}

async function storeScreenshot(analysisId: string, screenshotBase64: string | null | undefined, ttlSeconds: number) {
  if (!screenshotBase64) {
    return;
  }

  await kv.set(`screenshot:${analysisId}`, screenshotBase64, { ex: ttlSeconds });
}

async function storeDemoPayload(data: AnalyzeResponseData) {
  await storeAnalysis(data, DEMO_TTL_SECONDS);
}

async function storeLiveArtifacts(data: AnalyzeResponseData) {
  await storeAnalysis(data, ANALYSIS_TTL_SECONDS);

  const primaryScreenshot = data.journey[0]?.screenshotBase64;
  await storeScreenshot(data.analysisId, primaryScreenshot, ANALYSIS_TTL_SECONDS);
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
      requestId,
      timestamp: new Date().toISOString(),
    },
    { status: 503 },
    headers
  );
}

function mapAnalyzeError(errorMessage: string): {
  status: number;
  error: {
    code: string;
    message: string;
    retryable: boolean;
  };
  headers: Record<string, string>;
} {
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

  if (errorMessage === 'VERTEX_AI_API_KEY not configured') {
    return {
      status: 503,
      error: {
        code: 'AI_UNAVAILABLE',
        message: 'VERTEX_AI_API_KEY not configured',
        retryable: false,
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

  if (/404|dns|enotfound|err_name_not_resolved/i.test(errorMessage)) {
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
  const rateLimit = await checkRateLimit(request);
  const rateLimitHeaders = getRateLimitHeaders(rateLimit);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

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
    const { url } = body as { url?: string };

    if (!url) {
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

    if (!isValidUrl(url)) {
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

    const normalizedUrl = normalizeUrl(url);
    const lowerUrl = normalizedUrl.toLowerCase();
    const isSonoBello = lowerUrl.includes('sonobello.com');
    const isOpendoor = lowerUrl.includes('opendoor.com');
    const useDemoMode = rateLimit.forceDemoMode || isSonoBello || isOpendoor;

    if (useDemoMode) {
      clearTimeout(timeoutId);
      const demoData = getDemoPayload(normalizedUrl);
      try {
        await storeDemoPayload(demoData);
      } catch (kvError) {
        console.error('KV write error:', kvError);
        return kvWriteErrorResponse(requestId, rateLimitHeaders);
      }

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
    }

    try {
      const analysis = await Promise.race([
        analyzePage(normalizedUrl),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('TIMEOUT'));
          });
        }),
      ]);

      clearTimeout(timeoutId);

      const result = analysis as AnalyzeResponseData;
      try {
        await storeLiveArtifacts(result);
      } catch (kvError) {
        console.error('KV write error:', kvError);
        return kvWriteErrorResponse(requestId, rateLimitHeaders);
      }

      return jsonResponse(
        {
          success: true,
          data: result,
          requestId,
          latencyMs: Date.now() - startTime,
        },
        { status: 200 },
        rateLimitHeaders
      );
    } catch (error) {
      clearTimeout(timeoutId);

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage === 'TIMEOUT' || controller.signal.aborted) {
        const fallbackData = withAnalysisId(
          {
            ...getFallbackData(normalizedUrl),
            landingPageUrl: normalizedUrl,
          },
          `aid_${uuidv4().slice(0, 16)}`
        );

        try {
          await storeLiveArtifacts(fallbackData);
        } catch (kvError) {
          console.error('KV write error:', kvError);
          return kvWriteErrorResponse(requestId, rateLimitHeaders);
        }

        return jsonResponse(
          {
            success: true,
            data: fallbackData,
            fallbackReason: 'timeout',
            requestId,
            latencyMs: Date.now() - startTime,
          },
          { status: 200 },
          rateLimitHeaders
        );
      }

      const mapped = mapAnalyzeError(errorMessage);

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
  } catch (error) {
    clearTimeout(timeoutId);
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
  }
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
    const stored = await kv.get<string | AnalyzeResponseData>(`analysis:${aid}`);

    if (stored) {
      const data = typeof stored === 'string' ? JSON.parse(stored) : stored;

      return NextResponse.json({
        success: true,
        data,
        requestId,
        latencyMs: 0,
      });
    }

    const demoFixture = getDemoFixture(aid);

    if (demoFixture) {
      return NextResponse.json({
        success: true,
        data: demoFixture,
        requestId,
        latencyMs: 0,
      });
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
