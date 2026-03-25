// types/index.ts

// ============================================================================
// ENUMS
// ============================================================================

export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'zip'
  | 'dropdown'
  | 'checkbox'
  | 'radio'
  | 'date';

export type StepType = 'landing' | 'form' | 'multistep' | 'confirmation';

export type Industry =
  | 'real_estate'
  | 'medical_aesthetics'
  | 'fitness'
  | 'education'
  | 'finance';

export type Tone = 'urgent' | 'friendly' | 'professional' | 'playful';

export type AnalysisStatus =
  | 'pending'
  | 'scraping'
  | 'analyzing'
  | 'finalizing'
  | 'complete'
  | 'error';

// ============================================================================
// CORE DATA MODELS
// ============================================================================

export type TikTokFieldType =
  | 'FULL_NAME'
  | 'EMAIL'
  | 'PHONE_NUMBER'
  | 'ZIP_POST_CODE'
  | 'CUSTOM';

export interface ExtractedField {
  id: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required: boolean;
  confidence: number; // 0.0 - 1.0
  tiktokFieldId: string;
  tiktokFieldType: TikTokFieldType; // Immutable: mapped TikTok field type
  sourceSelector: string;
}

export interface JourneyStep {
  stepNumber: number;          // 1-based
  url: string;
  title: string;               // page title or step label
  screenshotBase64?: string;   // base64 PNG, may be undefined
  screenshotUrl?: string;      // public URL path (e.g. /sonobello-step1.png)
  fields: ExtractedField[];    // form fields found on this step (may be empty)
  ctaText?: string;            // button text that led to next step
  stepType: StepType;
}

// Field Editing Rules (Section 7B)
// Editable fields: label (max 50 chars, no empty), placeholder, required (boolean)
// Immutable fields: tiktokFieldType, confidence, id, sourceSelector
// Persistence: Edits persist only in client React state (NOT KV storage)
// After Save: FieldMapper re-renders, FormPreview re-renders
// After Cancel: Field state reverts to original values

export interface BrandColors {
  name: string;
  primaryColor: string;   // Hex color code
  secondaryColor: string; // Hex color code
  logoUrl?: string;
}

export interface FormBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PrimaryFormSelection {
  topCandidateScore: number;
  runnerUpScore: number;
}

export interface GeneratedCopy {
  originalHeadline: string;
  tiktokHeadline: string;
  originalCta: string;
  tiktokCta: string;
  benefits: string[];
  explanation: string;
  disclaimerText?: string; // Medical aesthetics compliance text (undefined = no disclaimer needed)
}

export interface PerformanceMetrics {
  estimated3pLoadTime: number;    // seconds
  estimated1pLoadTime: number;    // seconds
  dropOff3p: number;              // 0.0 - 1.0 percentage
  dropOff1p: number;              // 0.0 - 1.0 percentage
  estimatedDropOffReduction: number; // 0.0 - 1.0 percentage
}

export interface FieldBreakdownEntry {
  started: number;
  abandoned: number;
}

export type FieldBreakdown = Record<string, FieldBreakdownEntry>;

export interface RetargetingData {
  totalFormStarts: number;
  totalAbandonments: number;
  fieldBreakdown: FieldBreakdown;
  estimatedCtrLift: number; // 0.0 - 1.0 percentage
}

export interface ScreenshotAsset {
  status: 'ok' | 'failed' | 'pending';
  url?: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface AnalyzeRequest {
  url: string;
  useCache?: boolean;
  requestId?: string;
}

// Success envelope: includes success, data, requestId, latencyMs
// Timeout fallbacks additionally include fallbackReason: 'timeout'
export interface ApiResponse<T> {
  success: true;
  data: T;
  requestId: string;
  latencyMs: number;
  fallbackReason?: 'timeout';
}

export interface AnalyzeResponseData {
  analysisId: string;
  landingPageUrl: string;
  screenshot: ScreenshotAsset;
  isSimulatedData: boolean;
  createdAt: string;
  brandColors: BrandColors;
  extractedFields: ExtractedField[];
  formBoundingBox: FormBoundingBox;
  generatedCopy: GeneratedCopy;
  performance: PerformanceMetrics;
  retargeting: RetargetingData;
  // Journey analysis: full 3P journey steps (1 to N steps)
  journey: JourneyStep[];
  totalJourneySteps: number;
}

export interface GeminiAnalysisResult {
  extractedFields: ExtractedField[];
  formBoundingBox: FormBoundingBox;
  brandColors: BrandColors;
  generatedCopy: GeneratedCopy;
  primaryFormSelection: PrimaryFormSelection;
}

export type AnalyzeResponse = ApiResponse<AnalyzeResponseData>;

export interface GenerateRequest {
  context: {
    originalHeadline: string;
    originalCta: string;
    industry: Industry;
    tone: Tone;
    brandName: string;
    benefits?: string[]; // Existing benefits to inform generation
  };
  requestId?: string;
}

export interface GenerateResponse {
  tiktokHeadline: string;
  tiktokCta: string;
  benefits: string[];
  explanation: string;
  disclaimerText?: string; // Medical aesthetics compliance text (undefined = no disclaimer needed)
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface ErrorResponse {
  success: false;
  error: ApiError;
  fallbackAvailable?: boolean;
  requestId: string;
  timestamp: string;
}

// ============================================================================
// KV STORAGE TYPES
// ============================================================================

// KV stores the exact AnalyzeResponseData payload returned by POST /api/analyze.
export type StoredAnalysis = AnalyzeResponseData;

// ============================================================================
// COMPONENT PROPS
// ============================================================================

export interface UrlInputProps {
  onSubmit: (url: string, requestId: string) => void;
  onDemoSelect: (demo: 'opendoor' | 'sonobello') => void;
  isLoading: boolean;
  error?: ApiError;
}

export interface AnalysisProgressProps {
  stages: Array<{
    id: string;
    label: string;
    status: 'pending' | 'active' | 'complete';
  }>;
  currentStage: string;
  estimatedTimeRemaining: number;
  onCancel: () => void;
  requestId: string;
}

export interface LandingPreviewProps {
  screenshot: ScreenshotAsset;
  formBoundingBox: FormBoundingBox;
  highlightForm: boolean;
}

export interface FormPreviewProps {
  fields: ExtractedField[];
  brandColors: BrandColors;
  copy: GeneratedCopy;
  onFieldClick?: (field: ExtractedField) => void;
  isSimulatedData: boolean;
}

export interface FieldMapperProps {
  fields: ExtractedField[];
  onFieldEdit?: (field: ExtractedField) => void;
}

export interface FieldEditModalProps {
  field: ExtractedField | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedField: ExtractedField) => void;
}

export interface CopyComparisonProps {
  original: {
    headline: string;
    cta: string;
  };
  generated: GeneratedCopy;
  onRegenerate?: (tone: Tone) => void;
  isRegenerating: boolean;
  requestId: string;
}

export interface LoadTimeVizProps {
  loadTime3p: number;
  loadTime1p: number;
  dropOff3p: number;
  dropOff1p: number;
}

export interface RetargetPanelProps {
  totalFormStarts: number;
  totalAbandonments: number;
  fieldBreakdown: FieldBreakdown;
  estimatedCtrLift: number;
  isSimulatedData: boolean;
}

export interface MobileFrameProps {
  children: React.ReactNode;
  device?: 'iphone14' | 'android';
}

export interface SimulatedDataBannerProps {
  isSimulated: boolean;
  originalUrl?: string;
}
