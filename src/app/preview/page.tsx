// app/preview/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AnalyzeResponseData, ExtractedField } from '@/types';
import Link from 'next/link';

const TIKTOK_TEAL = '#69C9D0';
const TIKTOK_RED = '#FE2C55';

function PreviewContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const aid = searchParams.get('aid');

  const [data, setData] = useState<AnalyzeResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareToast, setShowShareToast] = useState(false);

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

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    } catch {
      // Fallback
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400">Loading preview...</p>
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

  const { brandColors, extractedFields, generatedCopy, screenshot, isSimulatedData, landingPageUrl } = data;

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
        <div className="flex items-center gap-4">
          <button
            onClick={handleShare}
            className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 transition-colors text-sm"
          >
            Share URL
          </button>
          <Link
            href="/"
            className="text-zinc-400 hover:text-white text-sm"
          >
            New Analysis
          </Link>
        </div>
      </header>

      {/* Share Toast */}
      {showShareToast && (
        <div className="fixed top-20 right-6 px-4 py-2 rounded-lg text-sm font-medium text-black z-50" style={{ backgroundColor: TIKTOK_TEAL }}>
          URL copied to clipboard!
        </div>
      )}

      {/* Simulated Data Banner */}
      {isSimulatedData && (
        <div className="w-full py-2 text-center text-sm font-semibold text-black" style={{ backgroundColor: '#FFD700' }}>
          SIMULATED DEMO DATA
        </div>
      )}

      {/* Main Content */}
      <main className="flex flex-col lg:flex-row min-h-[calc(100vh-65px)]">
        {/* Left: Original Landing Page (40%) */}
        <div className="w-full lg:w-2/5 border-r border-zinc-800 p-6">
          <h2 className="text-lg font-semibold mb-4 text-zinc-300">Original Landing Page</h2>
          <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
            {screenshot.status === 'ok' ? (
              <div className="relative aspect-[4/3] bg-zinc-800">
                <img
                  src={`/api/screenshot?id=${aid}`}
                  alt="Landing page screenshot"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="aspect-[4/3] flex flex-col items-center justify-center bg-zinc-900 text-zinc-500 p-8">
                <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm">Screenshot unavailable — showing placeholder</p>
              </div>
            )}
            <div className="p-4 border-t border-zinc-800">
              <a
                href={landingPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-400 hover:text-white truncate block"
              >
                {landingPageUrl}
              </a>
            </div>
          </div>
        </div>

        {/* Right: TikTok Form Preview (60%) */}
        <div className="w-full lg:w-3/5 p-6">
          <h2 className="text-lg font-semibold mb-4 text-zinc-300">TikTok Instant Form Preview</h2>

          {/* Mobile Frame */}
          <div className="max-w-sm mx-auto">
            {/* Phone Frame */}
            <div className="bg-zinc-900 rounded-[2.5rem] p-3 border-4 border-zinc-700">
              {/* Screen */}
              <div className="bg-white rounded-[2rem] overflow-hidden">
                {/* TikTok Header */}
                <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: brandColors.primaryColor }}>
                  <div className="flex items-center gap-2">
                    {brandColors.logoUrl ? (
                      <img src={brandColors.logoUrl} alt="Logo" className="w-6 h-6 rounded" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-white">{brandColors.name.charAt(0)}</span>
                      </div>
                    )}
                    <span className="text-white text-sm font-medium truncate max-w-[120px]">
                      {brandColors.name.replace(' - SIMULATED DEMO DATA', '')}
                    </span>
                  </div>
                  <div className="w-6 h-6 rounded-full bg-white/20" />
                </div>

                {/* Form Content */}
                <div className="p-5 space-y-4">
                  {/* Headline */}
                  <div>
                    <h3 className="text-black text-lg font-bold leading-tight">
                      {generatedCopy.tiktokHeadline}
                    </h3>
                  </div>

                  {/* Benefits */}
                  <ul className="space-y-2">
                    {generatedCopy.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-zinc-700">
                        <span className="text-green-500 mt-0.5">✓</span>
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Form Fields */}
                  <div className="space-y-3">
                    {extractedFields.map((field) => (
                      <div key={field.id} className="space-y-1">
                        <label className="text-xs text-zinc-500 font-medium">
                          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        <input
                          type={field.tiktokFieldType === 'EMAIL' ? 'email' : field.tiktokFieldType === 'PHONE_NUMBER' ? 'tel' : 'text'}
                          placeholder={field.placeholder || field.label}
                          className="w-full h-10 bg-zinc-100 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
                        />
                      </div>
                    ))}
                  </div>

                  {/* CTA Button */}
                  <button
                    className="w-full py-3 rounded-lg font-semibold text-white text-sm transition-opacity hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: brandColors.primaryColor }}
                    onClick={() => alert('🎉 This is a TikTok Instant Form demo — in production, this submits to TikTok Lead Generation!')}
                  >
                    {generatedCopy.tiktokCta}
                  </button>

                  {/* Disclaimer */}
                  {generatedCopy.disclaimerText && (
                    <p className="text-[10px] text-zinc-400 text-center leading-tight">
                      {generatedCopy.disclaimerText}
                    </p>
                  )}
                </div>

                {/* TikTok Footer */}
                <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100">
                  <p className="text-[10px] text-zinc-400 text-center">
                    Powered by TikTok Lead Generation
                  </p>
                </div>
              </div>
            </div>

            {/* Home Indicator */}
            <div className="flex justify-center mt-2">
              <div className="w-24 h-1 bg-zinc-700 rounded-full" />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-8">
            <Link
              href={`/bonus?aid=${aid}`}
              className="px-6 py-3 rounded-xl font-semibold text-black transition-opacity hover:opacity-90"
              style={{ backgroundColor: TIKTOK_TEAL }}
            >
              View Retargeting Bonus →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-black text-white">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-zinc-400">Loading preview...</p>
        </div>
      </div>
    }>
      <PreviewContent />
    </Suspense>
  );
}
