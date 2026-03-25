import { AnalyzeResponse, ErrorResponse } from '@/types';

const OPENDOOR_DEMO_URL = 'https://www.opendoor.com';
const SONO_BELLO_DEMO_URL = 'https://www.sonobello.com/consultation/';

export function getDemoFallbackUrl(rawUrl?: string | null) {
  const normalizedUrl = rawUrl?.toLowerCase() || '';

  return normalizedUrl.includes('opendoor')
    ? OPENDOOR_DEMO_URL
    : SONO_BELLO_DEMO_URL;
}

export async function persistDemoFixture(rawUrl?: string | null) {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: getDemoFallbackUrl(rawUrl),
    }),
  });

  const result = await response.json() as AnalyzeResponse | ErrorResponse;

  if (!response.ok || !result.success) {
    throw new Error(
      !result.success
        ? result.error.message
        : 'Failed to load demo data'
    );
  }

  return result.data.analysisId;
}
