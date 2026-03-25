// app/bonus/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnalyzeResponseData } from '@/types';
import Link from 'next/link';

const TIKTOK_TEAL = '#69C9D0';
const TIKTOK_RED = '#FE2C55';

function BonusContent() {
  const searchParams = useSearchParams();
  const aid = searchParams.get('aid');

  const [data, setData] = useState<AnalyzeResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!aid) {
      setError('No analysis ID provided');
      setLoading(false);
      return;
    }

    async function fetchAnalysis() {
      try {
        const response = await fetch(`/api/analyze?aid=${aid}`);
        const result = await response.json();

        if (result.success) {
          setData(result.data);
        } else {
          setError(result.error?.message || 'Failed to load analysis');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysis();
  }, [aid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400">Loading retargeting data...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error || 'Failed to load analysis'}</p>
          <Link href="/" className="text-zinc-400 hover:text-white underline">
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { retargeting, totalJourneySteps } = data;
  const { totalFormStarts, totalAbandonments, fieldBreakdown, estimatedCtrLift } = retargeting;

  // Find the highest abandonment field
  let highestAbandonmentField = '';
  let highestAbandonmentCount = 0;

  Object.entries(fieldBreakdown).forEach(([field, data]) => {
    if (data.abandoned > highestAbandonmentCount) {
      highestAbandonmentCount = data.abandoned;
      highestAbandonmentField = field;
    }
  });

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="w-full py-4 px-6 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: TIKTOK_RED }}>
            <span className="text-white font-bold text-sm">TT</span>
          </div>
          <span className="font-semibold">TikTok 1P Demo</span>
        </div>
        <Link
          href={`/preview?aid=${aid}`}
          className="text-zinc-400 hover:text-white text-sm"
        >
          ← Back to Preview
        </Link>
      </header>

      {/* Retargeting metrics are always simulated for demo purposes. */}
      <div className="w-full py-3 text-center text-sm font-bold text-black" style={{ backgroundColor: '#FFD700' }}>
        SIMULATED DEMO DATA — FOR DEMONSTRATION PURPOSES ONLY
      </div>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Title */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-2">🎯 Retargeting Audience Builder</h1>
          <p className="text-zinc-400">Turn form abandonment into high-value retargeting audiences</p>
        </div>

        {/* Journey Compression Section — NEW */}
        <div className="mb-12">
          <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <span>📊</span> Journey Compression Analysis
          </h2>

          <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 3P Journey Stats */}
              <div className="bg-zinc-950/50 rounded-xl p-5 border border-zinc-800">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">😓</span>
                  <span className="text-zinc-400 font-medium">3P Journey</span>
                </div>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-red-400">
                    {totalJourneySteps} steps
                  </div>
                  <div className="text-sm text-zinc-500">~2-3 minutes</div>
                  <div className="text-xs text-zinc-600">
                    Multiple page loads, context switching, form fatigue
                  </div>
                </div>
              </div>

              {/* VS Divider */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
                  <span className="text-zinc-500 font-bold">VS</span>
                </div>
                <div className="text-center">
                  <p className="text-sm text-zinc-500">Conversion friction</p>
                </div>
              </div>

              {/* 1P TikTok Stats */}
              <div className="bg-zinc-950/50 rounded-xl p-5 border border-zinc-700">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✨</span>
                  <span className="font-medium" style={{ color: TIKTOK_TEAL }}>1P TikTok</span>
                </div>
                <div className="space-y-2">
                  <div className="text-3xl font-bold" style={{ color: TIKTOK_TEAL }}>
                    1 step
                  </div>
                  <div className="text-sm text-zinc-500">~15 seconds</div>
                  <div className="text-xs text-zinc-600">
                    Instant form, auto-filled fields, native trust
                  </div>
                </div>
              </div>
            </div>

            {/* Lift Stat */}
            <div className="mt-6 pt-6 border-t border-zinc-700">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-white">Estimated completion rate lift</p>
                    <p className="text-xs text-zinc-500">Based on industry benchmarks for 1P vs 3P experiences</p>
                  </div>
                </div>
                <div className="text-4xl font-bold text-green-400">
                  +47%
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Total Form Starts */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <div className="text-zinc-400 text-sm mb-1">Total Form Starts</div>
            <div className="text-4xl font-bold" style={{ color: TIKTOK_TEAL }}>
              {totalFormStarts.toLocaleString()}
            </div>
            <div className="text-zinc-500 text-sm mt-2">Users who began the form</div>
          </div>

          {/* Total Abandonments */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <div className="text-zinc-400 text-sm mb-1">Total Abandonments</div>
            <div className="text-4xl font-bold text-red-400">
              {totalAbandonments.toLocaleString()}
            </div>
            <div className="text-zinc-500 text-sm mt-2">Users who didn&apos;t complete</div>
          </div>

          {/* Estimated CTR Lift */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <div className="text-zinc-400 text-sm mb-1">Est. CTR Lift</div>
            <div className="text-4xl font-bold text-green-400">
              +{(estimatedCtrLift * 100).toFixed(0)}%
            </div>
            <div className="text-zinc-500 text-sm mt-2">From retargeting audience</div>
          </div>
        </div>

        {/* Field Breakdown */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 mb-8">
          <h2 className="text-xl font-semibold mb-6">Field-Level Abandonment Breakdown</h2>

          <div className="space-y-6">
            {Object.entries(fieldBreakdown).map(([field, fieldData]) => {
              const isHighest = field === highestAbandonmentField;
              const fieldCompletionRate = fieldData.started > 0
                ? ((fieldData.started - fieldData.abandoned) / fieldData.started * 100)
                : 0;
              const abandonmentRate = 100 - fieldCompletionRate;

              return (
                <div
                  key={field}
                  className={`p-4 rounded-xl border ${isHighest ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-zinc-800'}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-medium capitalize">{field}</span>
                      {isHighest && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400">
                          Highest Drop-off
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{fieldData.abandoned.toLocaleString()}</span>
                      <span className="text-zinc-500 text-sm ml-1">abandoned</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden flex">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${fieldCompletionRate}%`,
                          backgroundColor: TIKTOK_TEAL
                        }}
                      />
                      <div
                        className="h-full bg-red-500/50 transition-all duration-500"
                        style={{ width: `${abandonmentRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>{fieldData.started.toLocaleString()} started</span>
                      <span>{fieldCompletionRate.toFixed(0)}% completion rate</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Auto-Created Audience */}
        <div className="bg-gradient-to-r from-zinc-900 to-zinc-800 rounded-2xl p-6 border border-zinc-700">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold mb-1">Auto-Created Retargeting Audience</h3>
              <p className="text-zinc-400 text-sm">
                &ldquo;High Intent - {highestAbandonmentField.charAt(0).toUpperCase() + highestAbandonmentField.slice(1)} Captured&rdquo;
              </p>
              <p className="text-zinc-500 text-sm mt-1">
                {highestAbandonmentCount.toLocaleString()} users who provided their {highestAbandonmentField} but didn&apos;t finish
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/30">
              <span className="text-green-400 font-medium">Ready to use</span>
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-center gap-4 mt-12">
          <Link
            href={`/preview?aid=${aid}`}
            className="px-6 py-3 rounded-xl font-semibold border border-zinc-600 hover:bg-zinc-800 transition-colors"
          >
            ← Back to Preview
          </Link>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl font-semibold text-black transition-opacity hover:opacity-90"
            style={{ backgroundColor: TIKTOK_TEAL }}
          >
            Analyze Another Page
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function BonusPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400">Loading retargeting data...</p>
        </div>
      </div>
    }>
      <BonusContent />
    </Suspense>
  );
}
