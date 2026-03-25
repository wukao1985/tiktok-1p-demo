import { kv } from '@vercel/kv';
import { NextRequest } from 'next/server';

const DEFAULT_LIMIT = Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10);
const DEFAULT_WINDOW_SECONDS = Number.parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS || '60', 10);
const EXEMPT_IPS = new Set(
  (process.env.RATE_LIMIT_EXEMPT_IPS || '127.0.0.1,::1')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean)
);

export interface RateLimitResult {
  bypassed: boolean;
  limited: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
  clientIp: string;
  forceDemoMode: boolean;
}

export function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  return request.headers.get('x-real-ip') || 'unknown';
}

function shouldBypassRateLimit(clientIp: string, forceDemoMode: boolean) {
  return forceDemoMode || EXEMPT_IPS.has(clientIp);
}

export function getDemoModeHeadersForRequest(request: NextRequest): Record<string, string> {
  const forceDemoMode = process.env.FORCE_DEMO_MODE === 'true';
  const clientIp = getClientIp(request);

  return shouldBypassRateLimit(clientIp, forceDemoMode)
    ? { 'X-Demo-Mode': 'true' }
    : {};
}

export async function checkRateLimit(
  request: NextRequest,
  keyPrefix = 'ratelimit'
): Promise<RateLimitResult> {
  const limit = Number.isFinite(DEFAULT_LIMIT) ? DEFAULT_LIMIT : 10;
  const windowSeconds = Number.isFinite(DEFAULT_WINDOW_SECONDS) ? DEFAULT_WINDOW_SECONDS : 60;
  const forceDemoMode = process.env.FORCE_DEMO_MODE === 'true';
  const clientIp = getClientIp(request);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const reset = nowSeconds - (nowSeconds % windowSeconds) + windowSeconds;
  const bypassed = shouldBypassRateLimit(clientIp, forceDemoMode);

  if (bypassed) {
    return {
      bypassed: true,
      limited: false,
      limit,
      remaining: limit,
      reset,
      retryAfter: 0,
      clientIp,
      forceDemoMode,
    };
  }

  const bucket = Math.floor(nowSeconds / windowSeconds);
  const key = `${keyPrefix}:${clientIp}:${bucket}`;

  try {
    const currentCount = await kv.incr(key);
    if (currentCount === 1) {
      await kv.expire(key, windowSeconds);
    }

    return {
      bypassed: false,
      limited: currentCount > limit,
      limit,
      remaining: Math.max(0, limit - currentCount),
      reset,
      retryAfter: Math.max(0, reset - nowSeconds),
      clientIp,
      forceDemoMode,
    };
  } catch (error) {
    console.error('Rate limit KV error:', error);

    return {
      bypassed: true,
      limited: false,
      limit,
      remaining: limit,
      reset,
      retryAfter: 0,
      clientIp,
      forceDemoMode,
    };
  }
}

export function getRateLimitHeaders(result: RateLimitResult) {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  };

  if (result.limited) {
    headers['Retry-After'] = String(result.retryAfter);
  }

  if (result.bypassed) {
    headers['X-Demo-Mode'] = 'true';
  }

  return headers;
}
