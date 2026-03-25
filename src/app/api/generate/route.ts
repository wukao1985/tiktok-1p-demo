import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

import { generateCopyWithGemini } from '@/lib/gemini';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';
import { GenerateRequest, Industry, Tone } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const VALID_INDUSTRIES: Industry[] = [
  'real_estate',
  'medical_aesthetics',
  'fitness',
  'education',
  'finance',
];
const VALID_TONES: Tone[] = ['urgent', 'friendly', 'professional', 'playful'];

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

function passesCompliance(result: Awaited<ReturnType<typeof generateCopyWithGemini>>, industry: Industry) {
  if (industry === 'medical_aesthetics' && result.disclaimerText !== 'Results may vary. Consultation required.') {
    return false;
  }

  return true;
}

export async function POST(request: NextRequest) {
  const requestId = `req_${uuidv4().slice(0, 8)}`;
  const startTime = Date.now();
  const rateLimit = await checkRateLimit(request, 'ratelimit:generate');
  const rateLimitHeaders = getRateLimitHeaders(rateLimit);

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
    const body = await request.json() as GenerateRequest;

    if (!body.context) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: 'MISSING_CONTEXT',
            message: 'Request body missing context field',
            retryable: false,
          },
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
        rateLimitHeaders
      );
    }

    if (!VALID_INDUSTRIES.includes(body.context.industry)) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: 'INVALID_INDUSTRY',
            message: 'Industry not in allowed list',
            retryable: false,
          },
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
        rateLimitHeaders
      );
    }

    if (!VALID_TONES.includes(body.context.tone)) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: 'INVALID_TONE',
            message: 'Tone not in allowed list',
            retryable: false,
          },
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 400 },
        rateLimitHeaders
      );
    }

    const generatedCopy = await generateCopyWithGemini(body.context);

    if (!passesCompliance(generatedCopy, body.context.industry)) {
      return jsonResponse(
        {
          success: false,
          error: {
            code: 'COMPLIANCE_BLOCKED',
            message: 'Generated copy violated compliance rules',
            retryable: false,
          },
          requestId,
          timestamp: new Date().toISOString(),
        },
        { status: 500 },
        rateLimitHeaders
      );
    }

    return jsonResponse(
      {
        success: true,
        data: generatedCopy,
        requestId,
        latencyMs: Date.now() - startTime,
      },
      { status: 200 },
      rateLimitHeaders
    );
  } catch (error) {
    console.error('Copy generation failed:', error);

    return jsonResponse(
      {
        success: false,
        error: {
          code: 'LLM_ERROR',
          message: 'Gemini API error or malformed JSON',
          retryable: true,
        },
        requestId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
      rateLimitHeaders
    );
  }
}
