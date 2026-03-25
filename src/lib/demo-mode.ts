const DEMO_MODE_STORAGE_KEY = 'tiktok-1p-demo-mode';

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
