// app/preview/page.tsx
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AnalyzeResponseData, ExtractedField, JourneyStep } from '@/types';
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
  const [activeStep, setActiveStep] = useState(1);
  const [ctaSubmitted, setCtaSubmitted] = useState(false);

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

  const getStepTypeLabel = (stepType: JourneyStep['stepType']) => {
    switch (stepType) {
      case 'landing': return 'Landing';
      case 'form': return 'Form';
      case 'multistep': return 'Multi-step';
      case 'confirmation': return 'Complete';
      default: return 'Step';
    }
  };

  const getStepTypeColor = (stepType: JourneyStep['stepType']) => {
    switch (stepType) {
      case 'landing': return 'bg-blue-500/20 text-blue-400';
      case 'form': return 'bg-yellow-500/20 text-yellow-400';
      case 'multistep': return 'bg-orange-500/20 text-orange-400';
      case 'confirmation': return 'bg-green-500/20 text-green-400';
      default: return 'bg-zinc-500/20 text-zinc-400';
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

  const { brandColors, extractedFields, generatedCopy, screenshot, isSimulatedData, landingPageUrl, journey, totalJourneySteps } = data;

  // Calculate total fields across all steps
  const totalFieldsInJourney = journey?.reduce((sum, step) => sum + step.fields.length, 0) || extractedFields.length;

  // Get active step data
  const activeStepData = journey?.find(s => s.stepNumber === activeStep) || journey?.[0];

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
        {/* LEFT PANEL (45%) — The 3P Journey — shows pain */}
        <div className="w-full lg:w-[45%] border-r border-zinc-800 bg-zinc-950">
          {/* Header */}
          <div className="p-6 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-zinc-300 flex items-center gap-2">
                <span>😓</span> The 3P Experience
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                {totalJourneySteps} STEPS
              </span>
            </div>
            <p className="text-sm text-zinc-500">Traditional multi-page conversion journey</p>
          </div>

          {/* Step Stepper */}
          <div className="px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              {journey?.map((step, index) => (
                <button
                  key={step.stepNumber}
                  onClick={() => setActiveStep(step.stepNumber)}
                  className={`flex items-center gap-2 transition-all ${
                    activeStep === step.stepNumber
                      ? 'opacity-100'
                      : 'opacity-50 hover:opacity-75'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      activeStep === step.stepNumber
                        ? 'bg-white text-black'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {step.stepNumber}
                  </div>
                  {index < journey.length - 1 && (
                    <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Step Details */}
          <div className="p-6 space-y-6">
            {activeStepData && (
              <div className="space-y-4">
                {/* Step Card */}
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="p-4 border-b border-zinc-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-zinc-500">{activeStepData.stepNumber}</span>
                        <div>
                          <h3 className="font-medium text-white">{activeStepData.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded ${getStepTypeColor(activeStepData.stepType)}`}>
                            {getStepTypeLabel(activeStepData.stepType)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Screenshot Placeholder */}
                  <div className="aspect-video bg-zinc-950 flex items-center justify-center border-b border-zinc-800">
                    {(activeStepData.screenshotBase64 || activeStepData.screenshotUrl) ? (
                      <img
                        src={activeStepData.screenshotUrl || `data:image/png;base64,${activeStepData.screenshotBase64}`}
                        alt={`Step ${activeStepData.stepNumber}`}
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <div className="text-center text-zinc-600">
                        <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xs">Page screenshot unavailable</p>
                      </div>
                    )}
                  </div>

                  {/* Fields on this step */}
                  <div className="p-4">
                    <p className="text-xs text-zinc-500 mb-2">Fields on this step:</p>
                    {activeStepData.fields.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {activeStepData.fields.map((field) => (
                          <span
                            key={field.id}
                            className="px-2 py-1 rounded-md text-xs bg-zinc-800 text-zinc-300 border border-zinc-700"
                          >
                            {field.label}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-600 italic">No fields — CTA click required</p>
                    )}
                  </div>

                  {/* CTA */}
                  {activeStepData.ctaText && (
                    <div className="px-4 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">CTA:</span>
                        <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300">
                          "{activeStepData.ctaText}"
                        </span>
                        <span className="text-zinc-600">→</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Journey Flow Visualization */}
                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-3">Full Journey Flow:</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {journey?.map((step, index) => (
                      <div key={step.stepNumber} className="flex items-center">
                        <button
                          onClick={() => setActiveStep(step.stepNumber)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            activeStep === step.stepNumber
                              ? 'bg-zinc-700 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                          }`}
                        >
                          {step.stepNumber}. {getStepTypeLabel(step.stepType)}
                          {step.fields.length > 0 && (
                            <span className="ml-1 text-zinc-500">({step.fields.length} fields)</span>
                          )}
                        </button>
                        {index < journey.length - 1 && (
                          <svg className="w-4 h-4 mx-1 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Friction Summary */}
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium text-red-400">Total Friction</span>
              </div>
              <p className="text-sm text-zinc-400">
                <span className="text-white font-semibold">{totalJourneySteps} page loads</span>,{' '}
                <span className="text-white font-semibold">{totalFieldsInJourney} form fields</span> across{' '}
                <span className="text-white font-semibold">{totalJourneySteps} steps</span>
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Estimated completion time: ~2-3 minutes
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL (55%) — The TikTok 1P Form — shows delight */}
        <div className="w-full lg:w-[55%] bg-white">
          {/* Header */}
          <div className="p-6 border-b border-zinc-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
                <span>✨</span> TikTok Instant Form
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: TIKTOK_TEAL }}>
                1 STEP
              </span>
            </div>
            <p className="text-sm text-zinc-500">Native in-app lead capture experience</p>
          </div>

          <div className="p-6">
            {/* Mobile Frame */}
            <div className="max-w-sm mx-auto">
              {/* Phone Frame */}
              <div className="bg-zinc-900 rounded-[2.5rem] p-3 border-4 border-zinc-800 shadow-2xl">
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
                      className="w-full py-3 rounded-lg font-semibold text-white text-sm transition-all hover:opacity-90 active:scale-[0.98]"
                      style={{ backgroundColor: ctaSubmitted ? '#22c55e' : brandColors.primaryColor }}
                      onClick={() => setCtaSubmitted(true)}
                    >
                      {ctaSubmitted ? '✓ Lead Submitted to TikTok!' : generatedCopy.tiktokCta}
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
                <div className="w-24 h-1 bg-zinc-800 rounded-full" />
              </div>
            </div>

            {/* Benefits List */}
            <div className="mt-8 max-w-sm mx-auto space-y-3">
              <div className="flex items-center gap-3 text-sm text-zinc-600">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${TIKTOK_TEAL}20` }}>
                  <span className="text-lg">⚡</span>
                </div>
                <span>One tap — no page loads</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-600">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${TIKTOK_TEAL}20` }}>
                  <span className="text-lg">🔄</span>
                </div>
                <span>Auto-filled from TikTok profile</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-600">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${TIKTOK_TEAL}20` }}>
                  <span className="text-lg">🎯</span>
                </div>
                <span>Native, trusted experience</span>
              </div>
            </div>

            {/* Time Comparison */}
            <div className="mt-8 max-w-sm mx-auto bg-zinc-50 rounded-xl p-4 border border-zinc-200">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-500">Completion time:</span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 line-through">~2-3 min</span>
                  <span className="font-bold" style={{ color: TIKTOK_TEAL }}>~15 sec</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 p-6 pt-0">
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
