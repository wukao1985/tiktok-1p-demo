'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  AnalyzeResponseData,
  ExtractedField,
  FormBoundingBox,
  GeneratedCopy,
  Industry,
  JourneyStep,
  Tone,
} from '@/types';

const TIKTOK_TEAL = '#69C9D0';
const TIKTOK_RED = '#FE2C55';
const TONE_OPTIONS: Tone[] = ['urgent', 'friendly', 'professional', 'playful'];
type PreviewTab = 'field-detection' | 'ai-copy' | 'performance';

function TabButton({
  label,
  tab,
  activeTab,
  onClick,
}: {
  label: string;
  tab: PreviewTab;
  activeTab: PreviewTab;
  onClick: (tab: PreviewTab) => void;
}) {
  const isActive = activeTab === tab;

  return (
    <button
      type="button"
      onClick={() => onClick(tab)}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'border-zinc-900 text-white'
          : 'border-zinc-300 text-zinc-600 hover:border-zinc-500 hover:text-zinc-900'
      }`}
      style={isActive ? { backgroundColor: TIKTOK_TEAL, borderColor: TIKTOK_TEAL } : undefined}
    >
      {label}
    </button>
  );
}

function FieldTypeBadge({ type }: { type: ExtractedField['tiktokFieldType'] }) {
  return (
    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
      {type}
    </span>
  );
}

function getConfidenceBadgeClassName(confidence: number) {
  if (confidence >= 0.9) {
    return 'bg-green-500 text-white';
  }

  if (confidence >= 0.8) {
    return 'bg-yellow-500 text-black';
  }

  return 'bg-red-500 text-white';
}

function guessIndustry(url: string): Industry {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('sonobello') || lowerUrl.includes('consultation') || lowerUrl.includes('clinic')) {
    return 'medical_aesthetics';
  }

  if (lowerUrl.includes('opendoor') || lowerUrl.includes('property') || lowerUrl.includes('house')) {
    return 'real_estate';
  }

  if (lowerUrl.includes('finance') || lowerUrl.includes('loan')) {
    return 'finance';
  }

  if (lowerUrl.includes('fitness') || lowerUrl.includes('gym')) {
    return 'fitness';
  }

  return 'education';
}

function getStepTypeLabel(stepType: JourneyStep['stepType']) {
  switch (stepType) {
    case 'landing':
      return 'Landing';
    case 'form':
      return 'Form';
    case 'multistep':
      return 'Multi-step';
    case 'confirmation':
      return 'Complete';
    default:
      return 'Step';
  }
}

function getStepTypeColor(stepType: JourneyStep['stepType']) {
  switch (stepType) {
    case 'landing':
      return 'bg-blue-500/20 text-blue-400';
    case 'form':
      return 'bg-yellow-500/20 text-yellow-400';
    case 'multistep':
      return 'bg-orange-500/20 text-orange-400';
    case 'confirmation':
      return 'bg-green-500/20 text-green-400';
    default:
      return 'bg-zinc-500/20 text-zinc-400';
  }
}

function getOverlayStyle(
  formBoundingBox: FormBoundingBox,
  imageDimensions: { width: number; height: number }
) {
  return {
    left: `${(formBoundingBox.x / imageDimensions.width) * 100}%`,
    top: `${(formBoundingBox.y / imageDimensions.height) * 100}%`,
    width: `${(formBoundingBox.width / imageDimensions.width) * 100}%`,
    height: `${(formBoundingBox.height / imageDimensions.height) * 100}%`,
  };
}

function PhonePreview({
  brandName,
  logoUrl,
  primaryColor,
  fields,
  copy,
  ctaSubmitted,
  onSubmit,
}: {
  brandName: string;
  logoUrl?: string;
  primaryColor: string;
  fields: ExtractedField[];
  copy: GeneratedCopy;
  ctaSubmitted: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="max-w-sm mx-auto">
      <div className="bg-zinc-900 rounded-[2.5rem] p-3 border-4 border-zinc-800 shadow-2xl">
        <div className="bg-white rounded-[2rem] overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: primaryColor }}>
            <div className="flex items-center gap-2">
              {logoUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img data-testid="brand-logo" src={logoUrl} alt="Logo" className="w-6 h-6 rounded" />
                </>
              )}
              <span className="text-white text-sm font-medium truncate max-w-[120px]">
                {brandName}
              </span>
            </div>
            <div className="w-6 h-6 rounded-full bg-white/20" />
          </div>

          <div className="p-5 space-y-4">
            <h3 className="text-black text-lg font-bold leading-tight">{copy.tiktokHeadline}</h3>

            <ul className="space-y-2">
              {copy.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2 text-sm text-zinc-700">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.id} className="space-y-1">
                  <label className="text-xs text-zinc-500 font-medium">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    type={
                      field.tiktokFieldType === 'EMAIL'
                        ? 'email'
                        : field.tiktokFieldType === 'PHONE_NUMBER'
                          ? 'tel'
                          : 'text'
                    }
                    placeholder={field.placeholder || field.label}
                    className="w-full h-10 bg-zinc-100 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-zinc-400 transition-colors"
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              className="w-full py-3 rounded-lg font-semibold text-white text-sm transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: ctaSubmitted ? '#22c55e' : primaryColor }}
              onClick={onSubmit}
            >
              {ctaSubmitted ? '✓ Lead Submitted to TikTok!' : copy.tiktokCta}
            </button>

            {copy.disclaimerText && (
              <p data-testid="disclaimer" className="text-[10px] text-zinc-400 text-center leading-tight">
                {copy.disclaimerText}
              </p>
            )}
          </div>

          <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100">
            <p className="text-[10px] text-zinc-400 text-center">
              Powered by TikTok Lead Generation
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-center mt-2">
        <div className="w-24 h-1 bg-zinc-800 rounded-full" />
      </div>
    </div>
  );
}

function PreviewContent() {
  const searchParams = useSearchParams();
  const aid = searchParams.get('aid');

  const [data, setData] = useState<AnalyzeResponseData | null>(null);
  const [editableFields, setEditableFields] = useState<ExtractedField[]>([]);
  const [editableCopy, setEditableCopy] = useState<GeneratedCopy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShareToast, setShowShareToast] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [ctaSubmitted, setCtaSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<PreviewTab>('field-detection');
  const [screenshotZoom, setScreenshotZoom] = useState(1);
  const [editingField, setEditingField] = useState<ExtractedField | null>(null);
  const [fieldDraft, setFieldDraft] = useState<ExtractedField | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<Tone>('urgent');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [activeScreenshotDimensions, setActiveScreenshotDimensions] = useState<{ width: number; height: number } | null>(null);

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
          const payload = result.data as AnalyzeResponseData;
          setData(payload);
          setEditableFields(payload.extractedFields);
          setEditableCopy(payload.generatedCopy);
          setActiveStep(payload.journey[0]?.stepNumber || 1);
        } else {
          setError(result.error?.message || 'Failed to load analysis');
        }
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Network error');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysis();
  }, [aid]);

  useEffect(() => {
    setActiveScreenshotDimensions(null);
  }, [data?.analysisId, activeStep]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShowShareToast(true);
      setTimeout(() => setShowShareToast(false), 2000);
    } catch {}
  };

  const openFieldEditor = (field: ExtractedField) => {
    setEditingField(field);
    setFieldDraft({ ...field });
    setFieldError(null);
  };

  const closeFieldEditor = () => {
    setEditingField(null);
    setFieldDraft(null);
    setFieldError(null);
  };

  const saveFieldEdit = () => {
    if (!editingField || !fieldDraft) {
      return;
    }

    const nextLabel = fieldDraft.label.trim();

    if (!nextLabel) {
      setFieldError('Label is required');
      return;
    }

    if (nextLabel.length > 50) {
      setFieldError('Label max 50 characters');
      return;
    }

    setEditableFields((currentFields) =>
      currentFields.map((field) =>
        field.id === editingField.id
          ? {
              ...field,
              label: nextLabel,
              placeholder: fieldDraft.placeholder,
              required: fieldDraft.required,
            }
          : field
      )
    );
    closeFieldEditor();
  };

  const handleRegenerateCopy = async () => {
    if (!data || !editableCopy) {
      return;
    }

    setIsRegenerating(true);
    setRegenerateError(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            originalHeadline: editableCopy.originalHeadline,
            originalCta: editableCopy.originalCta,
            industry: guessIndustry(data.landingPageUrl),
            tone: selectedTone,
            brandName: data.brandColors.name.replace(' - SIMULATED DEMO DATA', ''),
            benefits: editableCopy.benefits,
          },
        }),
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to regenerate copy');
      }

      setEditableCopy((currentCopy) => ({
        ...(currentCopy || editableCopy),
        ...result.data,
        originalHeadline: editableCopy.originalHeadline,
        originalCta: editableCopy.originalCta,
      }));
      setCtaSubmitted(false);
    } catch (regenError) {
      setRegenerateError(regenError instanceof Error ? regenError.message : 'Failed to regenerate copy');
    } finally {
      setIsRegenerating(false);
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

  if (error || !data || !editableCopy) {
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

  const {
    brandColors,
    screenshot,
    isSimulatedData,
    landingPageUrl,
    journey,
    totalJourneySteps,
    performance,
    retargeting,
  } = data;
  const totalFieldsInJourney = journey.reduce((sum, step) => sum + step.fields.length, 0) || editableFields.length;
  const activeStepData = journey.find((step) => step.stepNumber === activeStep) || journey[0];
  const activeScreenshotSrc = activeStepData?.screenshotUrl
    || (activeStepData?.screenshotBase64 ? `data:image/png;base64,${activeStepData.screenshotBase64}` : undefined)
    || (activeStep === 1 ? screenshot.url : undefined);
  const maxLoadTime = Math.max(performance.estimated3pLoadTime, performance.estimated1pLoadTime, 0.1);
  const maxDropOff = Math.max(performance.dropOff3p, performance.dropOff1p, 0.01);
  const shouldShowFormOverlay = Boolean(
    activeStepData?.stepNumber === data.primaryFormStepNumber &&
    activeScreenshotSrc &&
    activeScreenshotDimensions &&
    data.formBoundingBox.width > 0 &&
    data.formBoundingBox.height > 0
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="w-full py-4 px-6 flex items-center justify-between border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: TIKTOK_RED }}>
            <span className="text-white font-bold text-sm">TT</span>
          </div>
          <span className="font-semibold">TikTok 1P Demo</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleShare}
            className="px-4 py-2 rounded-lg bg-zinc-900 border border-zinc-700 hover:border-zinc-500 transition-colors text-sm"
          >
            Share URL
          </button>
          <Link href="/" className="text-zinc-400 hover:text-white text-sm">
            New Analysis
          </Link>
        </div>
      </header>

      {showShareToast && (
        <div className="fixed top-20 right-6 px-4 py-2 rounded-lg text-sm font-medium text-black z-50" style={{ backgroundColor: TIKTOK_TEAL }}>
          URL copied to clipboard!
        </div>
      )}

      {isSimulatedData && (
        <div className="w-full py-2 text-center text-sm font-semibold text-black" style={{ backgroundColor: '#FFD700' }}>
          SIMULATED DEMO DATA
        </div>
      )}

      <main className="flex flex-col lg:flex-row min-h-[calc(100vh-65px)]">
        <div className="w-full lg:w-[45%] border-r border-zinc-800 bg-zinc-950">
          <div className="p-6 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-zinc-300 flex items-center gap-2">
                <span>😓</span>
                <span>The 3P Experience</span>
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">
                {totalJourneySteps} STEPS
              </span>
            </div>
            <p className="text-sm text-zinc-500">Traditional multi-page conversion journey</p>
            <a
              href={landingPageUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-xs text-zinc-400 hover:text-white underline underline-offset-4"
            >
              {landingPageUrl}
            </a>
          </div>

          <div className="px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              {journey.map((step, index) => (
                <button
                  key={step.stepNumber}
                  type="button"
                  onClick={() => setActiveStep(step.stepNumber)}
                  className={`flex items-center gap-2 transition-all ${
                    activeStep === step.stepNumber ? 'opacity-100' : 'opacity-50 hover:opacity-75'
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

          <div className="p-6 space-y-6">
            {activeStepData && (
              <div className="space-y-4">
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
                      {activeScreenshotSrc && (
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                          <button
                            type="button"
                            onClick={() => setScreenshotZoom(1)}
                            className={`rounded-full px-2 py-1 ${screenshotZoom === 1 ? 'bg-zinc-700 text-white' : 'bg-zinc-800'}`}
                          >
                            1x
                          </button>
                          <button
                            type="button"
                            onClick={() => setScreenshotZoom(1.5)}
                            className={`rounded-full px-2 py-1 ${screenshotZoom === 1.5 ? 'bg-zinc-700 text-white' : 'bg-zinc-800'}`}
                          >
                            1.5x
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="max-h-[70vh] bg-zinc-950 overflow-auto border-b border-zinc-800">
                    {activeScreenshotSrc ? (
                      <div className="p-3">
                        <div
                          className="relative mx-auto"
                          style={{ width: `${screenshotZoom * 100}%` }}
                        >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={activeScreenshotSrc}
                          alt={`Step ${activeStepData.stepNumber}`}
                          className="block w-full h-auto"
                          onLoad={(event) => {
                            setActiveScreenshotDimensions({
                              width: event.currentTarget.naturalWidth,
                              height: event.currentTarget.naturalHeight,
                            });
                          }}
                        />
                          {shouldShowFormOverlay && activeScreenshotDimensions && (
                            <div
                              className="pointer-events-none absolute rounded-xl border-2 border-cyan-300 bg-cyan-300/15 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
                              style={getOverlayStyle(data.formBoundingBox, activeScreenshotDimensions)}
                            >
                              <span className="absolute left-2 top-2 rounded-full bg-cyan-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-black">
                                Primary form
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-white p-4 overflow-auto">
                        <div className="max-w-sm mx-auto space-y-3">
                          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                            Screenshot unavailable - showing placeholder
                          </div>
                          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">
                            {activeStepData.title}
                          </div>
                          {activeStepData.fields.length > 0 ? (
                            activeStepData.fields.map((field) => (
                              <div key={field.id} className="space-y-1">
                                <div className="text-xs text-zinc-600">
                                  {field.label}
                                  {field.required ? ' *' : ''}
                                </div>
                                <div className="h-9 border border-zinc-300 rounded bg-zinc-50 px-3 flex items-center text-xs text-zinc-400">
                                  {field.placeholder || field.label}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-6 text-center">
                              <div className="text-3xl mb-2">🏠</div>
                              <p className="text-sm font-medium text-zinc-700">{activeStepData.title}</p>
                              <p className="text-xs text-zinc-400 mt-1">Landing page</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

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
                      <p className="text-xs text-zinc-600 italic">No fields on this step</p>
                    )}
                  </div>

                  {activeStepData.ctaText && (
                    <div className="px-4 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">CTA:</span>
                        <span className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300">
                          &ldquo;{activeStepData.ctaText}&rdquo;
                        </span>
                        <span className="text-zinc-600">→</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
                  <p className="text-xs text-zinc-500 mb-3">Full Journey Flow:</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {journey.map((step, index) => (
                      <div key={step.stepNumber} className="flex items-center">
                        <button
                          type="button"
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
              <p className="text-xs text-zinc-500 mt-1">Estimated completion time: ~2-3 minutes</p>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[55%] bg-white">
          <div className="p-6 border-b border-zinc-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold text-zinc-800 flex items-center gap-2">
                <span>✨</span>
                <span>TikTok Instant Form</span>
              </h2>
              <span className="px-3 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: TIKTOK_TEAL }}>
                1 STEP
              </span>
            </div>
            <p className="text-sm text-zinc-500">Native in-app lead capture experience</p>
          </div>

          <div className="p-6">
            <div className="flex flex-wrap gap-3 mb-6">
              <TabButton label="Field Detection" tab="field-detection" activeTab={activeTab} onClick={setActiveTab} />
              <TabButton label="AI Copy" tab="ai-copy" activeTab={activeTab} onClick={setActiveTab} />
              <TabButton label="Performance" tab="performance" activeTab={activeTab} onClick={setActiveTab} />
            </div>

            {activeTab === 'field-detection' && (
              <div className="space-y-4">
                {editableFields.map((field) => (
                  <div
                    key={field.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-zinc-900">{field.label}</h3>
                        <FieldTypeBadge type={field.tiktokFieldType} />
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${getConfidenceBadgeClassName(field.confidence)}`}
                        >
                          {(field.confidence * 100).toFixed(0)}% confidence
                        </span>
                        {field.required && (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-medium text-red-700">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-500">{field.sourceSelector}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openFieldEditor(field)}
                      className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:border-zinc-500 hover:text-zinc-900"
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'ai-copy' && (
              <div className="space-y-6">
                <div className="max-w-md mx-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-4 space-y-4">
                  <div className="grid gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Original headline</p>
                      <p className="text-zinc-900">{editableCopy.originalHeadline}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">AI headline</p>
                      <p className="text-zinc-900 font-semibold">{editableCopy.tiktokHeadline}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Why this works</p>
                      <p className="text-zinc-600">{editableCopy.explanation}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={selectedTone}
                      onChange={(event) => setSelectedTone(event.target.value as Tone)}
                      className="flex-1 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm text-zinc-700"
                    >
                      {TONE_OPTIONS.map((tone) => (
                        <option key={tone} value={tone}>
                          {tone.charAt(0).toUpperCase() + tone.slice(1)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleRegenerateCopy}
                      disabled={isRegenerating}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                      style={{ backgroundColor: TIKTOK_TEAL }}
                    >
                      {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  </div>

                  {regenerateError && (
                    <p className="text-sm text-red-600">{regenerateError}</p>
                  )}
                </div>

                <PhonePreview
                  brandName={brandColors.name.replace(' - SIMULATED DEMO DATA', '')}
                  logoUrl={brandColors.logoUrl}
                  primaryColor={brandColors.primaryColor}
                  fields={editableFields}
                  copy={editableCopy}
                  ctaSubmitted={ctaSubmitted}
                  onSubmit={() => setCtaSubmitted(true)}
                />

                <div className="mt-8 max-w-sm mx-auto space-y-3">
                  <div className="flex items-center gap-3 text-sm text-zinc-600">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${TIKTOK_TEAL}20` }}>
                      <span className="text-lg">⚡</span>
                    </div>
                    <span>One tap, no page loads</span>
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
              </div>
            )}

            {activeTab === 'performance' && (
              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-sm text-zinc-500">Total Form Starts</p>
                    <p className="mt-2 text-3xl font-bold text-zinc-900">{retargeting.totalFormStarts.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-sm text-zinc-500">Total Abandonments</p>
                    <p className="mt-2 text-3xl font-bold text-zinc-900">{retargeting.totalAbandonments.toLocaleString()}</p>
                  </div>
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                    <p className="text-sm text-zinc-500">Estimated CTR Lift</p>
                    <p className="mt-2 text-3xl font-bold text-zinc-900">+{(retargeting.estimatedCtrLift * 100).toFixed(0)}%</p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Load Time Comparison</p>
                      <p className="text-sm text-zinc-500">Page-load delay before a lead can submit.</p>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-zinc-700">3P landing page</span>
                          <span className="font-semibold text-zinc-900">{performance.estimated3pLoadTime.toFixed(1)}s</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${(performance.estimated3pLoadTime / maxLoadTime) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-zinc-700">TikTok instant form</span>
                          <span className="font-semibold" style={{ color: TIKTOK_TEAL }}>
                            {performance.estimated1pLoadTime.toFixed(1)}s
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(performance.estimated1pLoadTime / maxLoadTime) * 100}%`,
                              backgroundColor: TIKTOK_TEAL,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Drop-off Comparison</p>
                      <p className="text-sm text-zinc-500">Side-by-side abandonment rate from the stored model.</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">3P drop-off</p>
                        <p className="mt-2 text-3xl font-bold text-red-700">
                          {(performance.dropOff3p * 100).toFixed(0)}%
                        </p>
                      </div>
                      <div className="rounded-2xl border p-4" style={{ borderColor: `${TIKTOK_TEAL}55`, backgroundColor: `${TIKTOK_TEAL}14` }}>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#0f766e' }}>TikTok 1P drop-off</p>
                        <p className="mt-2 text-3xl font-bold" style={{ color: '#0f766e' }}>
                          {(performance.dropOff1p * 100).toFixed(0)}%
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-zinc-700">3P landing page</span>
                          <span className="font-semibold text-zinc-900">{(performance.dropOff3p * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full rounded-full bg-red-500"
                            style={{ width: `${(performance.dropOff3p / maxDropOff) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-zinc-700">TikTok instant form</span>
                          <span className="font-semibold" style={{ color: TIKTOK_TEAL }}>
                            {(performance.dropOff1p * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-zinc-200">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(performance.dropOff1p / maxDropOff) * 100}%`,
                              backgroundColor: TIKTOK_TEAL,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-700">Estimated drop-off reduction</span>
                    <span className="text-2xl font-bold text-green-700">
                      {(performance.estimatedDropOffReduction * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-green-700/80">
                    Moving from the current 3P flow to TikTok 1P cuts modeled abandonment from{' '}
                    {(performance.dropOff3p * 100).toFixed(0)}% to {(performance.dropOff1p * 100).toFixed(0)}%.
                  </p>
                </div>
              </div>
            )}
          </div>

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

      {editingField && fieldDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Edit field</p>
                <h2 className="text-xl font-semibold text-zinc-900">{editingField.label}</h2>
              </div>
              <button type="button" onClick={closeFieldEditor} className="text-zinc-400 hover:text-zinc-700">
                ✕
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Label</span>
                <input
                  type="text"
                  value={fieldDraft.label}
                  onChange={(event) => setFieldDraft({ ...fieldDraft, label: event.target.value })}
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-zinc-700">Placeholder</span>
                <input
                  type="text"
                  value={fieldDraft.placeholder || ''}
                  onChange={(event) => setFieldDraft({ ...fieldDraft, placeholder: event.target.value })}
                  className="w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm text-zinc-900"
                />
              </label>

              <label className="flex items-center gap-3 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={fieldDraft.required}
                  onChange={(event) => setFieldDraft({ ...fieldDraft, required: event.target.checked })}
                />
                Required field
              </label>

              {fieldError && <p className="text-sm text-red-600">{fieldError}</p>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeFieldEditor}
                className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveFieldEdit}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-black"
                style={{ backgroundColor: TIKTOK_TEAL }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-black text-white">
          <div className="text-center space-y-4">
            <div className="w-8 h-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-zinc-400">Loading preview...</p>
          </div>
        </div>
      }
    >
      <PreviewContent />
    </Suspense>
  );
}
