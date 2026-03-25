// app/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ApiError } from '@/types';

const TIKTOK_TEAL = '#69C9D0';
const TIKTOK_RED = '#FE2C55';

export default function Home() {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [showDemoButton, setShowDemoButton] = useState(false);
  const abortController = useRef<AbortController | null>(null);
  const latestRequestId = useRef<string>('');
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortController.current) {
        abortController.current.abort();
      }
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  const startProgress = () => {
    setProgress(0);
    const duration = 8000; // 8 seconds
    const interval = 100; // Update every 100ms
    const increment = 100 / (duration / interval);

    progressInterval.current = setInterval(() => {
      setProgress(prev => {
        const next = prev + increment;
        return next >= 100 ? 100 : next;
      });
    }, interval);
  };

  const stopProgress = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    setProgress(0);
  };

  const handleAnalyze = async (inputUrl: string) => {
    // Cancel any in-flight request
    if (abortController.current) {
      abortController.current.abort();
    }

    abortController.current = new AbortController();
    const requestId = `req_${Date.now().toString(36)}`;
    latestRequestId.current = requestId;

    setIsLoading(true);
    setError(null);
    setShowDemoButton(false);
    startProgress();

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: inputUrl, requestId }),
        signal: abortController.current.signal
      });

      const data = await response.json();

      // Stale response check
      if (requestId !== latestRequestId.current) {
        console.log('Stale response ignored');
        return;
      }

      stopProgress();

      if (data.success) {
        // Navigate to preview page
        router.push(`/preview?aid=${data.data.analysisId}`);
      } else {
        setError(data.error);
        if (data.fallbackAvailable) {
          setShowDemoButton(true);
        }
        setIsLoading(false);
      }
    } catch (err) {
      stopProgress();

      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Request cancelled');
        setIsLoading(false);
        return;
      }

      setError({
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network error occurred',
        retryable: true
      });
      setShowDemoButton(true);
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isLoading) return;
    router.push(`/analyze?url=${encodeURIComponent(url.trim())}`);
  };

  const handleDemoSelect = (demo: 'sonobello' | 'opendoor') => {
    const demoUrls = {
      sonobello: 'https://www.sonobello.com/consultation/',
      opendoor: 'https://www.opendoor.com'
    };
    router.push(`/analyze?url=${encodeURIComponent(demoUrls[demo])}`);
  };

  const handleUseDemoData = () => {
    // Navigate with demo flag
    const demoUrl = url.includes('opendoor') ? 'opendoor' : 'sonobello';
    const demoData = demoUrl === 'opendoor'
      ? 'demo_opendoor'
      : 'demo_sonobello';
    router.push(`/preview?aid=${demoData}`);
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
                  className="px-6 py-4 rounded-xl font-semibold border border-zinc-600 hover:bg-zinc-800 transition-colors"
                >
                  Use Demo Data
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
