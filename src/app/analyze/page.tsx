'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { persistDemoFixture } from '@/lib/demo-fallback';
import { ApiError } from '@/types';

const TIKTOK_TEAL = '#69C9D0';
const TIKTOK_RED = '#FE2C55';

function AnalyzeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get('url');

  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);
  const [showDemoButton, setShowDemoButton] = useState(false);
  const [isHydratingDemo, setIsHydratingDemo] = useState(false);
  const abortController = useRef<AbortController | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      abortController.current?.abort();
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!rawUrl) {
      setError({
        code: 'MISSING_URL',
        message: 'No URL provided for analysis',
        retryable: false,
      });
      return;
    }

    abortController.current = new AbortController();
    setError(null);
    setShowDemoButton(false);
    setProgress(0);

    progressInterval.current = setInterval(() => {
      setProgress((currentProgress) => Math.min(100, currentProgress + 100 / 80));
    }, 100);

    async function runAnalysis() {
      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: rawUrl }),
          signal: abortController.current?.signal,
        });
        const result = await response.json();

        if (result.success) {
          router.replace(`/preview?aid=${result.data.analysisId}`);
          return;
        }

        setError(result.error || {
          code: 'ANALYSIS_ERROR',
          message: 'Analysis failed',
          retryable: true,
        });
        setShowDemoButton(Boolean(result.fallbackAvailable));
      } catch (analysisError) {
        if (analysisError instanceof Error && analysisError.name === 'AbortError') {
          return;
        }

        setError({
          code: 'NETWORK_ERROR',
          message: analysisError instanceof Error ? analysisError.message : 'Network error occurred',
          retryable: true,
        });
        setShowDemoButton(true);
      } finally {
        if (progressInterval.current) {
          clearInterval(progressInterval.current);
          progressInterval.current = null;
        }
      }
    }

    runAnalysis();
  }, [rawUrl, router]);

  const handleUseDemoData = async () => {
    if (isHydratingDemo) {
      return;
    }

    setIsHydratingDemo(true);

    try {
      const analysisId = await persistDemoFixture(rawUrl);
      router.replace(`/preview?aid=${analysisId}`);
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

  const handleCancel = () => {
    abortController.current?.abort();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="w-full py-4 px-6 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: TIKTOK_RED }}>
            <span className="text-white font-bold text-sm">TT</span>
          </div>
          <span className="font-semibold text-lg">TikTok 1P Demo</span>
        </div>
        <button type="button" onClick={handleCancel} className="text-sm text-zinc-400 hover:text-white">
          Cancel
        </button>
      </header>

      <main className="flex min-h-[calc(100vh-65px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8 text-center shadow-2xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
          </div>

          <h1 className="text-3xl font-bold">Analyzing page structure...</h1>
          <p className="mt-3 text-sm text-zinc-500">
            Scraping page, extracting fields, and generating TikTok-ready copy.
          </p>

          <div className="mt-8 space-y-3">
            <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{ width: `${progress}%`, backgroundColor: TIKTOK_TEAL }}
              />
            </div>
            <div className="flex justify-between text-xs uppercase tracking-wide text-zinc-500">
              <span>{progress < 30 ? 'Scraping page' : progress < 80 ? 'Analyzing with AI' : 'Finalizing'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {rawUrl && (
            <p className="mt-6 text-xs text-zinc-500 break-all">{rawUrl}</p>
          )}

          {error && (
            <div className="mt-8 rounded-2xl border border-red-800 bg-red-950/30 p-4 text-left">
              <p className="font-semibold text-red-300">{error.code}</p>
              <p className="mt-1 text-sm text-red-200">{error.message}</p>
            </div>
          )}

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {showDemoButton && (
              <button
                type="button"
                onClick={handleUseDemoData}
                disabled={isHydratingDemo}
                className="rounded-xl border border-zinc-600 px-5 py-3 font-semibold text-white hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isHydratingDemo ? 'Loading Demo...' : 'Use Demo Data'}
              </button>
            )}
            <Link href="/" className="rounded-xl border border-zinc-800 px-5 py-3 font-semibold text-zinc-300 hover:bg-zinc-900">
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-zinc-400">Preparing analysis...</p>
          </div>
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}
