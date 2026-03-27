import { AnalyzeResponse, ErrorResponse } from '@/types';
import {
  getDemoFixtureKey,
  getDemoFixtureUrl,
} from '@/lib/demo-data';

export function getDemoFallbackUrl(rawUrl?: string | null) {
  return getDemoFixtureUrl(getDemoFixtureKey(rawUrl));
}

export async function persistDemoFixture(rawUrl?: string | null) {
  const demoFixture = getDemoFixtureKey(rawUrl);
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: getDemoFixtureUrl(demoFixture),
      demoFixture,
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
