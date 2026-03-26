// app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';

import { persistDemoFixture } from '@/lib/demo-fallback';
import { fetchDemoModeStatus, readPersistedDemoMode } from '@/lib/demo-mode';
import { ApiError } from '@/types';

const TIKTOK_TEAL = '#69C9D0';
const TIKTOK_RED = '#FE2C55';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading] = useState(false);
  const [progress] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [showDemoButton, setShowDemoButton] = useState(false);
  const [isHydratingDemo, setIsHydratingDemo] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    setIsDemoMode(readPersistedDemoMode());

    let isActive = true;

    void fetchDemoModeStatus()
      .then((demoModeEnabled) => {
        if (isActive) {
          setIsDemoMode(demoModeEnabled);
        }
      })
      .catch(() => {});

    return () => {
      isActive = false;
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
  };

  const handleDemoSelect = (demo: 'sonobello' | 'opendoor') => {
    const demoUrls = {
      sonobello: 'https://www.sonobello.com/',
      opendoor: 'https://www.opendoor.com'
    };
    const demoUrl = demoUrls[demo];

    flushSync(() => {
      setUrl(demoUrl);
    });

    if (inputRef.current) {
      inputRef.current.value = demoUrl;
    }

    router.push(`/analyze?url=${encodeURIComponent(demoUrl)}`);
  };

  const handleUseDemoData = async () => {
    if (isHydratingDemo) {
      return;
    }

    setIsHydratingDemo(true);

    try {
      const analysisId = await persistDemoFixture(url);
      router.push(`/preview?aid=${analysisId}`);
    } catch (demoError) {
      setError({
        code: 'DEMO_FALLBACK_ERROR',
        message: demoError instanceof Error ? demoError.message : 'Failed to load demo data',
        retryable: true,
      });
      setShowDemoButton(true);
    } finally {
      setIsHydratingDemo(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-black text-white">
      {/* Header */}
      <header className="w-full py-4 px-6 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: TIKTOK_RED }}>
            <span className="text-white font-bold text-sm">TT</span>
          </div>
          <span className="font-semibold text-lg">TikTok 1P Demo</span>
        </div>
        {isDemoMode && (
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Demo Mode
          </span>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl text-center space-y-8">
          {/* Hero */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold leading-tight">
              Turn Any Landing Page Into a{' '}
              <span style={{ color: TIKTOK_TEAL }}>TikTok Instant Form</span>
            </h1>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">
              See how AI automatically converts your existing landing pages into
              high-converting TikTok Instant Forms in under 8 seconds.
            </p>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.sonobello.com/consultation/"
                disabled={isLoading}
                className="w-full px-6 py-4 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 disabled:opacity-50 transition-colors"
              />
              {isLoading && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-zinc-500 border-t-white rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {isLoading && (
              <div className="space-y-2">
                <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all duration-100 ease-out rounded-full"
                    style={{
                      width: `${progress}%`,
                      backgroundColor: TIKTOK_TEAL
                    }}
                  />
                </div>
                <p className="text-sm text-zinc-500">
                  {progress < 30 && 'Scraping page...'}
                  {progress >= 30 && progress < 80 && 'Analyzing with AI...'}
                  {progress >= 80 && 'Finalizing...'}
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-left">
                <p className="text-red-400 font-medium">{error.code}</p>
                <p className="text-red-300 text-sm">{error.message}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="flex-1 px-6 py-4 rounded-xl font-semibold text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ backgroundColor: TIKTOK_TEAL }}
              >
                {isLoading ? 'Analyzing...' : 'Analyze →'}
              </button>

              {showDemoButton && (
                <button
                  type="button"
                  onClick={handleUseDemoData}
                  disabled={isHydratingDemo}
                  className="px-6 py-4 rounded-xl font-semibold border border-zinc-600 hover:bg-zinc-800 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isHydratingDemo ? 'Loading Demo...' : 'Use Demo Data'}
                </button>
              )}
            </div>
          </form>

          {/* Demo Shortcuts */}
          <div className="pt-4">
            <p className="text-zinc-500 text-sm mb-3">Or try one of these demo sites:</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => handleDemoSelect('sonobello')}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 transition-colors disabled:opacity-50 text-sm"
              >
                Try Sono Bello
              </button>
              <button
                type="button"
                onClick={() => handleDemoSelect('opendoor')}
                disabled={isLoading}
                className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 transition-colors disabled:opacity-50 text-sm"
              >
                Try Opendoor
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 px-4 text-center text-zinc-600 text-sm border-t border-zinc-900">
        <p>TikTok 1P Demo Tool — For sales enablement purposes only</p>
      </footer>
    </div>
  );
}
