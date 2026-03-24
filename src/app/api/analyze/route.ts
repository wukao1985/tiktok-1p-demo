// app/api/analyze/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { analyzePage } from '@/lib/analyze-page';
import { getFallbackData, SONO_BELLO_DEMO, OPENDOOR_DEMO } from '@/lib/demo-data';
import { AnalyzeResponseData, ApiError } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Route config for Vercel
export const runtime = 'nodejs';
export const maxDuration = 60;

// Helper to normalize URL
function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

// Helper to validate URL
function isValidUrl(url: string): boolean {
  try {
    new URL(normalizeUrl(url));
    return true;
  } catch {
    return false;
  }
}

// POST /api/analyze
export async function POST(request: NextRequest) {
  const requestId = `req_${uuidv4().slice(0, 8)}`;
  const startTime = Date.now();

  // 8s global timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const body = await request.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_URL',
            message: 'Request body missing url field',
            retryable: false
          },
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    if (!isValidUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_URL',
            message: 'URL format not recognized',
            retryable: false
          },
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: 400 }
      );
    }

    const normalizedUrl = normalizeUrl(url);

    // Check for demo URLs to use specific fallbacks
    const lowerUrl = normalizedUrl.toLowerCase();
    const isSonoBello = lowerUrl.includes('sonobello.com');
    const isOpendoor = lowerUrl.includes('opendoor.com');

    try {
      // Attempt live analysis
      const analysis = await Promise.race([
        analyzePage(normalizedUrl),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('TIMEOUT'));
          });
        })
      ]);

      clearTimeout(timeoutId);

      const result = analysis as AnalyzeResponseData;

      // Store in KV
      try {
        await kv.set(`analysis:${result.analysisId}`, JSON.stringify(result), { ex: 300 }); // 5 min TTL
      } catch (kvError) {
        console.error('KV write error:', kvError);
        // Continue - we still return the result even if KV fails
      }

      const latencyMs = Date.now() - startTime;

      return NextResponse.json({
        success: true,
        data: result,
        requestId,
        latencyMs
      });
    } catch (error) {
      clearTimeout(timeoutId);

      const errorMessage = error instanceof Error ? error.message : String(error);

      // Handle timeout - return simulated data with fallbackReason
      if (errorMessage === 'TIMEOUT' || controller.signal.aborted) {
        const fallbackData = getFallbackData(normalizedUrl);
        fallbackData.analysisId = `aid_${uuidv4().slice(0, 16)}`;
        fallbackData.createdAt = new Date().toISOString();

        // Store in KV
        try {
          await kv.set(`analysis:${fallbackData.analysisId}`, JSON.stringify(fallbackData), { ex: 300 });
        } catch (kvError) {
          console.error('KV write error:', kvError);
        }

        return NextResponse.json({
          success: true,
          data: fallbackData,
          fallbackReason: 'timeout',
          requestId,
          latencyMs: Date.now() - startTime
        });
      }

      // For demo URLs, return specific fallback data
      if (isSonoBello) {
        const demoData = { ...SONO_BELLO_DEMO };
        demoData.analysisId = `aid_${uuidv4().slice(0, 16)}`;
        demoData.createdAt = new Date().toISOString();

        try {
          await kv.set(`analysis:${demoData.analysisId}`, JSON.stringify(demoData), { ex: 300 });
        } catch (kvError) {
          console.error('KV write error:', kvError);
        }

        return NextResponse.json({
          success: true,
          data: demoData,
          requestId,
          latencyMs: Date.now() - startTime
        });
      }

      if (isOpendoor) {
        const demoData = { ...OPENDOOR_DEMO };
        demoData.analysisId = `aid_${uuidv4().slice(0, 16)}`;
        demoData.createdAt = new Date().toISOString();

        try {
          await kv.set(`analysis:${demoData.analysisId}`, JSON.stringify(demoData), { ex: 300 });
        } catch (kvError) {
          console.error('KV write error:', kvError);
        }

        return NextResponse.json({
          success: true,
          data: demoData,
          requestId,
          latencyMs: Date.now() - startTime
        });
      }

      // Return error with fallback available
      let errorCode = 'SCRAPING_BLOCKED';
      let statusCode = 422;

      if (errorMessage.includes('404')) {
        errorCode = 'PAGE_NOT_FOUND';
      } else if (errorMessage.includes('LLM')) {
        errorCode = 'LLM_ERROR';
        statusCode = 503;
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
            retryable: statusCode === 503
          },
          fallbackAvailable: true,
          requestId,
          timestamp: new Date().toISOString()
        },
        { status: statusCode }
      );
    }
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          retryable: true
        },
        fallbackAvailable: true,
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}

// GET /api/analyze?aid={id}
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
          retryable: false
        },
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: 400 }
    );
  }

  try {
    const data = await kv.get<string>(`analysis:${aid}`);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ANALYSIS_NOT_FOUND',
            message: 'No stored analysis found for analysis ID',
            retryable: false
          },
          requestId,
          timestamp: new Date().toISOString()
        },
        {
          status: 404,
          headers: {
            'X-Analysis-Id': aid
          }
        }
      );
    }

    const parsedData = typeof data === 'string' ? JSON.parse(data) : data;

    return NextResponse.json({
      success: true,
      data: parsedData,
      requestId,
      latencyMs: 0
    });
  } catch (error) {
    console.error('KV read error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'KV_READ_ERROR',
          message: 'Failed to retrieve analysis result',
          retryable: true
        },
        requestId,
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
