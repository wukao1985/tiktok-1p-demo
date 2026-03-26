import assert from 'node:assert/strict';

const PRODUCTION_URL = 'https://tiktok-1p-demo-app.vercel.app';

interface AnalyzeResponseEnvelope {
  success: boolean;
  data?: {
    isSimulatedData: boolean;
    screenshot: {
      status: string;
      url?: string;
    };
    extractedFields: Array<{
      label: string;
      tiktokFieldType: string;
    }>;
  };
  error?: {
    code: string;
    message: string;
  };
  requestId?: string;
  latencyMs?: number;
  fallbackReason?: string;
}

interface TestCase {
  label: string;
  inputUrl: string;
  minFields: number;
  expectedScreenshotStatus?: 'ok' | 'failed' | 'pending';
}

const TEST_CASES: TestCase[] = [
  {
    label: 'Sono Bello',
    inputUrl: 'https://www.sonobello.com/',
    minFields: 1,
    expectedScreenshotStatus: 'ok',
  },
  {
    label: 'Opendoor',
    inputUrl: 'https://www.opendoor.com',
    minFields: 1,
  },
];

async function analyzeUrl(inputUrl: string) {
  const response = await fetch(`${PRODUCTION_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ url: inputUrl }),
  });

  const rawBody = await response.text();
  let payload: AnalyzeResponseEnvelope;

  try {
    payload = JSON.parse(rawBody) as AnalyzeResponseEnvelope;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to parse JSON response (${response.status}): ${message}\n${rawBody.slice(0, 500)}`
    );
  }

  return {
    response,
    payload,
  };
}

async function runTest(testCase: TestCase) {
  const startedAt = Date.now();
  console.log(`\n[start] ${testCase.label}: ${testCase.inputUrl}`);

  const { response, payload } = await analyzeUrl(testCase.inputUrl);
  const elapsedMs = Date.now() - startedAt;
  const demoModeHeader = response.headers.get('x-demo-mode');

  assert.equal(
    demoModeHeader,
    null,
    `${testCase.label}: production responded with X-Demo-Mode=true`
  );
  assert.equal(
    response.status,
    200,
    `${testCase.label}: expected HTTP 200, received ${response.status} ${response.statusText}`
  );
  assert.equal(payload.success, true, `${testCase.label}: success !== true`);
  assert.ok(payload.data, `${testCase.label}: response missing data payload`);
  assert.equal(
    payload.fallbackReason,
    undefined,
    `${testCase.label}: unexpected fallbackReason=${payload.fallbackReason}`
  );
  assert.equal(
    payload.data.isSimulatedData,
    false,
    `${testCase.label}: expected live data, got simulated data`
  );
  assert.ok(
    payload.data.extractedFields.length >= testCase.minFields,
    `${testCase.label}: expected at least ${testCase.minFields} extracted field(s), got ${payload.data.extractedFields.length}`
  );

  if (testCase.expectedScreenshotStatus) {
    assert.equal(
      payload.data.screenshot.status,
      testCase.expectedScreenshotStatus,
      `${testCase.label}: expected screenshot.status=${testCase.expectedScreenshotStatus}, got ${payload.data.screenshot.status}`
    );
  }

  const labels = payload.data.extractedFields
    .map((field) => `${field.label} (${field.tiktokFieldType})`)
    .join(', ');

  console.log(
    `[pass] ${testCase.label} in ${elapsedMs}ms; latency=${payload.latencyMs ?? 'n/a'}; fields=${labels}`
  );
}

async function main() {
  for (const testCase of TEST_CASES) {
    await runTest(testCase);
  }

  console.log('\nAll production E2E checks passed.');
}

main().catch((error) => {
  console.error('\nE2E test failed.');
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
