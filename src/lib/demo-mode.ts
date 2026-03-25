const DEMO_MODE_STORAGE_KEY = 'tiktok-1p-demo-mode';
const DEMO_MODE_HEADER = 'X-Demo-Mode';

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readPersistedDemoMode() {
  return getStorage()?.getItem(DEMO_MODE_STORAGE_KEY) === 'true';
}

export function writePersistedDemoMode(isDemoMode: boolean) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(DEMO_MODE_STORAGE_KEY, String(isDemoMode));
}

export function readDemoModeFromHeaders(headers: Headers) {
  return headers.get(DEMO_MODE_HEADER) === 'true';
}

export function persistDemoModeFromHeaders(headers: Headers) {
  const isDemoMode = readDemoModeFromHeaders(headers);
  writePersistedDemoMode(isDemoMode);
  return isDemoMode;
}

export async function fetchDemoModeStatus(signal?: AbortSignal) {
  const response = await fetch('/api/analyze', {
    method: 'HEAD',
    cache: 'no-store',
    signal,
  });

  return persistDemoModeFromHeaders(response.headers);
}
