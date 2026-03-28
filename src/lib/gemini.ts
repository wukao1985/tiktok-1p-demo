// lib/gemini.ts
import { GoogleAuth, type GoogleAuthOptions, type JWTInput } from 'google-auth-library';

import {
  ExtractedField,
  BrandColors,
  GeneratedCopy,
  GenerateRequest,
  GenerateResponse,
  GeminiAnalysisResult,
  PrimaryFormSelection,
} from '@/types';
import {
  ANALYSIS_GEMINI_BUDGET_MS,
  getRemainingAnalysisBudget,
} from './analysis-budget';

const CLOUD_PLATFORM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const VERTEX_MODEL = 'gemini-2.0-flash';

let cachedGoogleAuth: GoogleAuth | null = null;
let cachedGoogleAuthKey = '';

type VertexPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface GeminiResponse {
  extractedFields: Array<{
    id: string;
    label: string;
    type: string;
    required: boolean;
    confidence: number;
    tiktokFieldId: string;
    tiktokFieldType: string;
    sourceSelector: string;
    placeholder?: string;
  }>;
  formBoundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  primaryFormSelection: {
    topCandidateScore: number;
    runnerUpScore: number;
  };
  brandColors: {
    name: string;
    primaryColor: string;
    secondaryColor: string;
    logoUrl?: string;
  };
  generatedCopy: {
    originalHeadline: string;
    tiktokHeadline: string;
    originalCta: string;
    tiktokCta: string;
    benefits: string[];
    explanation: string;
    disclaimerText?: string;
  };
}

interface GeminiCallOptions {
  deadlineMs?: number;
}

interface GeminiRequestConfig {
  headers: Record<string, string>;
  providerName: 'Gemini API' | 'Vertex AI';
  url: string;
}

type JsonRecord = Record<string, unknown>;

const VALID_FIELD_TYPES = new Set<ExtractedField['type']>([
  'text',
  'email',
  'tel',
  'number',
  'zip',
  'dropdown',
  'checkbox',
  'radio',
  'date',
]);
const VALID_TIKTOK_FIELD_TYPES = new Set<ExtractedField['tiktokFieldType']>([
  'FULL_NAME',
  'EMAIL',
  'PHONE_NUMBER',
  'ZIP_POST_CODE',
  'CUSTOM',
]);

export class LLMTimeoutError extends Error {
  readonly code = 'LLM_TIMEOUT';
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
    super(`LLM analysis timed out after ${seconds} seconds`);
    this.name = 'LLMTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export function isLLMTimeoutError(error: unknown): error is LLMTimeoutError {
  return (
    error instanceof LLMTimeoutError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'LLM_TIMEOUT')
  );
}

function describeValueType(value: unknown) {
  if (value === undefined) {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return 'array';
  }

  return typeof value;
}

export class GeminiFormatError extends Error {
  readonly code = 'GEMINI_FORMAT_ERROR';
  readonly fieldPath: string;

  constructor(fieldPath: string, expected: string, actual: unknown) {
    super(
      `Gemini response format error at ${fieldPath}: expected ${expected}, received ${describeValueType(actual)}`
    );
    this.name = 'GeminiFormatError';
    this.fieldPath = fieldPath;
  }
}

export function isGeminiFormatError(error: unknown): error is GeminiFormatError {
  return (
    error instanceof GeminiFormatError ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 'GEMINI_FORMAT_ERROR')
  );
}

function expectObject(value: unknown, fieldPath: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GeminiFormatError(fieldPath, 'object', value);
  }

  return value as JsonRecord;
}

function expectArray(value: unknown, fieldPath: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new GeminiFormatError(fieldPath, 'array', value);
  }

  return value;
}

function expectString(value: unknown, fieldPath: string): string {
  if (typeof value !== 'string') {
    throw new GeminiFormatError(fieldPath, 'string', value);
  }

  return value;
}

function expectOptionalString(value: unknown, fieldPath: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return expectString(value, fieldPath);
}

function expectBoolean(value: unknown, fieldPath: string): boolean {
  if (typeof value !== 'boolean') {
    throw new GeminiFormatError(fieldPath, 'boolean', value);
  }

  return value;
}

function expectNumber(value: unknown, fieldPath: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new GeminiFormatError(fieldPath, 'finite number', value);
  }

  return value;
}

function expectStringArray(value: unknown, fieldPath: string): string[] {
  return expectArray(value, fieldPath).map((entry, index) =>
    expectString(entry, `${fieldPath}[${index}]`)
  );
}

function expectEnum<T extends string>(
  value: unknown,
  fieldPath: string,
  allowedValues: ReadonlySet<T>
): T {
  const stringValue = expectString(value, fieldPath);

  if (!allowedValues.has(stringValue as T)) {
    throw new GeminiFormatError(
      fieldPath,
      `one of ${Array.from(allowedValues).join(', ')}`,
      stringValue
    );
  }

  return stringValue as T;
}

function validateGeminiResponse(parsedResult: unknown): GeminiResponse {
  const root = expectObject(parsedResult, 'response');
  const extractedFields = expectArray(root.extractedFields, 'extractedFields').map(
    (field, index) => {
      const fieldPath = `extractedFields[${index}]`;
      const fieldObject = expectObject(field, fieldPath);

      return {
        id: expectString(fieldObject.id, `${fieldPath}.id`),
        label: expectString(fieldObject.label, `${fieldPath}.label`),
        type: expectEnum(fieldObject.type, `${fieldPath}.type`, VALID_FIELD_TYPES),
        required: expectBoolean(fieldObject.required, `${fieldPath}.required`),
        confidence: expectNumber(fieldObject.confidence, `${fieldPath}.confidence`),
        tiktokFieldId: expectString(fieldObject.tiktokFieldId, `${fieldPath}.tiktokFieldId`),
        tiktokFieldType: expectEnum(
          fieldObject.tiktokFieldType,
          `${fieldPath}.tiktokFieldType`,
          VALID_TIKTOK_FIELD_TYPES
        ),
        sourceSelector: expectString(
          fieldObject.sourceSelector,
          `${fieldPath}.sourceSelector`
        ),
        placeholder: expectOptionalString(fieldObject.placeholder, `${fieldPath}.placeholder`),
      };
    }
  );

  const formBoundingBoxObject = expectObject(root.formBoundingBox, 'formBoundingBox');
  const primaryFormSelectionObject = expectObject(
    root.primaryFormSelection,
    'primaryFormSelection'
  );
  const brandColorsObject = expectObject(root.brandColors, 'brandColors');
  const generatedCopyObject = expectObject(root.generatedCopy, 'generatedCopy');

  return {
    extractedFields,
    formBoundingBox: {
      x: expectNumber(formBoundingBoxObject.x, 'formBoundingBox.x'),
      y: expectNumber(formBoundingBoxObject.y, 'formBoundingBox.y'),
      width: expectNumber(formBoundingBoxObject.width, 'formBoundingBox.width'),
      height: expectNumber(formBoundingBoxObject.height, 'formBoundingBox.height'),
    },
    primaryFormSelection: {
      topCandidateScore: expectNumber(
        primaryFormSelectionObject.topCandidateScore,
        'primaryFormSelection.topCandidateScore'
      ),
      runnerUpScore: expectNumber(
        primaryFormSelectionObject.runnerUpScore,
        'primaryFormSelection.runnerUpScore'
      ),
    },
    brandColors: {
      name: expectString(brandColorsObject.name, 'brandColors.name'),
      primaryColor: expectString(brandColorsObject.primaryColor, 'brandColors.primaryColor'),
      secondaryColor: expectString(
        brandColorsObject.secondaryColor,
        'brandColors.secondaryColor'
      ),
      logoUrl: expectOptionalString(brandColorsObject.logoUrl, 'brandColors.logoUrl'),
    },
    generatedCopy: {
      originalHeadline: expectString(
        generatedCopyObject.originalHeadline,
        'generatedCopy.originalHeadline'
      ),
      tiktokHeadline: expectString(
        generatedCopyObject.tiktokHeadline,
        'generatedCopy.tiktokHeadline'
      ),
      originalCta: expectString(generatedCopyObject.originalCta, 'generatedCopy.originalCta'),
      tiktokCta: expectString(generatedCopyObject.tiktokCta, 'generatedCopy.tiktokCta'),
      benefits: expectStringArray(generatedCopyObject.benefits, 'generatedCopy.benefits'),
      explanation: expectString(generatedCopyObject.explanation, 'generatedCopy.explanation'),
      disclaimerText: expectOptionalString(
        generatedCopyObject.disclaimerText,
        'generatedCopy.disclaimerText'
      ),
    },
  };
}

function getRequiredVertexEnv(
  envName: 'GOOGLE_CLOUD_PROJECT_ID' | 'GOOGLE_CLOUD_LOCATION'
) {
  const value = process.env[envName]?.trim();

  if (!value) {
    throw new Error(`Vertex AI configuration error: ${envName} is not configured`);
  }

  return value;
}

function decodeBase64Credentials(encodedCredentials: string): JWTInput {
  try {
    const parsed = JSON.parse(
      Buffer.from(encodedCredentials, 'base64').toString('utf8')
    ) as JWTInput;

    if (
      typeof parsed.client_email !== 'string' ||
      typeof parsed.private_key !== 'string'
    ) {
      throw new Error('service account JSON is missing client_email or private_key');
    }

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Vertex AI configuration error: GOOGLE_APPLICATION_CREDENTIALS_BASE64 is invalid (${message})`
    );
  }
}

function getGoogleAuth(projectId: string) {
  const encodedCredentials =
    process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64?.trim() || '';
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || '';
  const cacheKey = [projectId, encodedCredentials, keyFilename].join('::');

  if (cachedGoogleAuth && cachedGoogleAuthKey === cacheKey) {
    return cachedGoogleAuth;
  }

  const authOptions: GoogleAuthOptions = {
    projectId,
    scopes: [CLOUD_PLATFORM_SCOPE],
  };

  if (encodedCredentials) {
    authOptions.credentials = decodeBase64Credentials(encodedCredentials);
  } else if (keyFilename) {
    authOptions.keyFilename = keyFilename;
  } else {
    throw new Error(
      'Vertex AI configuration error: GOOGLE_APPLICATION_CREDENTIALS_BASE64 or GOOGLE_APPLICATION_CREDENTIALS is not configured'
    );
  }

  cachedGoogleAuth = new GoogleAuth(authOptions);
  cachedGoogleAuthKey = cacheKey;

  return cachedGoogleAuth;
}

function getVertexEndpoint(projectId: string, location: string) {
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${VERTEX_MODEL}:generateContent`;
}

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || '';
}

function getGeminiApiEndpoint(apiKey: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${VERTEX_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
}

function getRemainingGeminiBudget(deadlineMs?: number) {
  if (deadlineMs === undefined) {
    return ANALYSIS_GEMINI_BUDGET_MS;
  }

  return Math.min(
    ANALYSIS_GEMINI_BUDGET_MS,
    Math.max(0, getRemainingAnalysisBudget(deadlineMs))
  );
}

function createTimeoutError(timeoutMs: number) {
  return new LLMTimeoutError(timeoutMs);
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) {
    throw createTimeoutError(timeoutMs);
  }

  let timeoutId: NodeJS.Timeout | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(createTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function getVertexAccessToken(projectId: string, deadlineMs?: number) {
  try {
    const accessToken = await withTimeout(
      getGoogleAuth(projectId).getAccessToken(),
      getRemainingGeminiBudget(deadlineMs)
    );

    if (!accessToken) {
      throw new Error('empty access token');
    }

    return accessToken;
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.startsWith('Vertex AI configuration error:') ||
        isLLMTimeoutError(error)
      )
    ) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Vertex AI authentication failed: ${message}`);
  }
}

async function getGeminiRequestConfig(
  options: GeminiCallOptions = {}
): Promise<GeminiRequestConfig> {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    return {
      headers: {
        'Content-Type': 'application/json',
      },
      providerName: 'Gemini API',
      url: getGeminiApiEndpoint(apiKey),
    };
  }

  const projectId = getRequiredVertexEnv('GOOGLE_CLOUD_PROJECT_ID');
  const location = getRequiredVertexEnv('GOOGLE_CLOUD_LOCATION');
  const accessToken = await getVertexAccessToken(projectId, options.deadlineMs);

  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    providerName: 'Vertex AI',
    url: getVertexEndpoint(projectId, location),
  };
}

const ANALYSIS_PROMPT = `You are an expert web form analyzer and TikTok ads copywriter. Extract structured form field data from the provided multi-step HTML journey AND generate optimized copy in a single response.

The HTML content contains multiple steps of a user journey (landing page → form steps → confirmation). Analyze ALL steps to understand the complete conversion flow.

Analyze the HTML content and return a JSON object with the following structure:

{
  "extractedFields": [
    {
      "id": "field_1",
      "label": "Field Label",
      "type": "text|email|tel|number|zip|dropdown|checkbox|radio|date",
      "required": true|false,
      "confidence": 0.95,
      "tiktokFieldId": "field_identifier",
      "tiktokFieldType": "FULL_NAME|EMAIL|PHONE_NUMBER|ZIP_POST_CODE|CUSTOM",
      "sourceSelector": "input[name='fieldName']",
      "placeholder": "Optional placeholder text"
    }
  ],
  "formBoundingBox": {
    "x": 680,
    "y": 240,
    "width": 480,
    "height": 520
  },
  "primaryFormSelection": {
    "topCandidateScore": 78,
    "runnerUpScore": 42
  },
  "brandColors": {
    "name": "Brand Name",
    "primaryColor": "#E91E63",
    "secondaryColor": "#FFFFFF",
    "logoUrl": "optional logo URL"
  },
  "generatedCopy": {
    "originalHeadline": "Original headline from the page",
    "tiktokHeadline": "Optimized TikTok headline (max 50 chars)",
    "originalCta": "Original CTA text",
    "tiktokCta": "Optimized TikTok CTA (max 20 chars, use first-person like 'Claim My')",
    "benefits": ["Benefit 1 (max 60 chars)", "Benefit 2", "Benefit 3"],
    "explanation": "Brief explanation of changes made",
    "disclaimerText": "Optional disclaimer for medical/aesthetic verticals"
  }
}

RULES FOR FIELD EXTRACTION:
- Identify ALL form input fields across ALL steps of the journey
- Deduplicate fields that appear on multiple steps (keep only unique fields)
- For each field, determine label from <label>, placeholder, or nearby text
- If multiple forms exist, select the one most likely to be the primary lead capture form
- Score the top candidate form from 0-100 and score the runner-up from 0-100 using the same rubric
- Set runnerUpScore to 0 if there is no meaningful second candidate
- The score should reflect how clearly the form is the primary lead capture experience, not just whether any form exists
- Return bounding box coordinates for the primary form only
- Confidence < 0.8 should be rare—use when label is unclear or type is ambiguous
- Map similar fields: 'First' → 'First Name', 'E-mail' → 'Email'
- Sanitize HTML input: strip <script> tags, ignore inline event handlers
- Ignore cookie consent banners, newsletter signups, and search boxes
- Set tiktokFieldType based on field purpose: FULL_NAME for name fields, EMAIL for email, PHONE_NUMBER for phone, ZIP_POST_CODE for zip, CUSTOM for all others

RULES FOR COPY GENERATION:
- Analyze the COMPLETE journey context (all steps) to understand the offer
- Headline: Lead with benefit + urgency or curiosity gap, MAX 50 characters including spaces, use specific numbers when possible ('24 Hours' not 'Fast'), avoid superlatives like 'best', 'guaranteed results'
- CTA: Action-oriented, first-person ('Claim My' vs 'Submit'), MAX 20 characters including spaces, use ownership language ('My', 'Your')
- Benefits: 2-4 bullet points, MAX 60 characters each, TikTok-native: short, punchy, based on value props from the full journey

COMPLIANCE RULES:
- Medical/aesthetics: NO claims of guaranteed outcomes, NO before/after images implied to be typical, NO medical advice or diagnosis language, USE 'consultation' not 'treatment', USE 'may' not 'will' for results, set disclaimerText to: "Results may vary. Consultation required."
- Finance: NO guaranteed approval claims, NO specific interest rates without qualification, include 'Terms apply' if mentioning rates
- Real estate: NO guaranteed offer amounts, USE 'estimate' not 'valuation'

Return ONLY valid JSON. No markdown, no explanations outside the JSON.`;

const COPY_GENERATION_PROMPT = `You are an expert TikTok lead generation copywriter.

Return ONLY valid JSON with this exact shape:
{
  "tiktokHeadline": "Optimized TikTok headline (max 50 chars)",
  "tiktokCta": "Optimized TikTok CTA (max 20 chars)",
  "benefits": ["Benefit 1", "Benefit 2", "Benefit 3"],
  "explanation": "Brief explanation of what changed and why",
  "disclaimerText": "Optional disclaimer text"
}

Rules:
- Respect the advertiser's industry and requested tone.
- Use first-person CTA language when appropriate.
- Medical aesthetics copy must avoid guaranteed outcomes and include: "Results may vary. Consultation required."
- Real estate copy must avoid guaranteed offer claims and use "estimate" language.
- Finance copy must avoid guaranteed approval or guaranteed rates.
- Benefits should be punchy and 60 characters or fewer.
- Headline should be specific, direct, and TikTok-friendly.`;

function parseJsonResponse<T>(text: string): T {
  const jsonMatch =
    text.match(/```json\n([\s\S]*?)\n```/) ||
    text.match(/```\n([\s\S]*?)\n```/) ||
    [null, text];
  const jsonString = jsonMatch[1] || text;

  try {
    return JSON.parse(jsonString.trim()) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini response parse error: ${message}`);
  }
}

async function callVertex(parts: VertexPart[], options: GeminiCallOptions = {}) {
  const requestConfig = await getGeminiRequestConfig(options);
  const timeoutMs = getRemainingGeminiBudget(options.deadlineMs);

  if (timeoutMs <= 0) {
    throw createTimeoutError(timeoutMs);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(requestConfig.url, {
      method: 'POST',
      headers: requestConfig.headers,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      const responseMessage = responseText ? ` - ${responseText.slice(0, 200)}` : '';

      throw new Error(
        `${requestConfig.providerName} API error: ${response.status} ${response.statusText}${responseMessage}`
      );
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error(
        `Unexpected response format from ${requestConfig.providerName}`
      );
    }

    return text as string;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw createTimeoutError(timeoutMs);
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function analyzeWithGemini(
  htmlContent: string,
  screenshotBase64?: string,
  url?: string,
  options: GeminiCallOptions = {}
): Promise<GeminiAnalysisResult> {
  const content: VertexPart[] = [
    {
      text: `${ANALYSIS_PROMPT}\n\nURL: ${url || 'unknown'}\n\nHTML Content:\n${htmlContent.slice(0, 50000)}`,
    },
  ];

  if (screenshotBase64) {
    content.push({
      inlineData: {
        mimeType: 'image/png',
        data: screenshotBase64,
      },
    });
  }

  const text = await callVertex(content, options);
  const parsedResult = validateGeminiResponse(parseJsonResponse<unknown>(text));

  // Transform the response to match our types
  const extractedFields: ExtractedField[] = parsedResult.extractedFields.map(
    (field) => ({
      id: field.id,
      label: field.label,
      type: field.type as ExtractedField['type'],
      placeholder: field.placeholder,
      required: field.required,
      confidence: field.confidence,
      tiktokFieldId: field.tiktokFieldId,
      tiktokFieldType: field.tiktokFieldType as ExtractedField['tiktokFieldType'],
      sourceSelector: field.sourceSelector,
    })
  );

  const brandColors: BrandColors = {
    name: parsedResult.brandColors.name,
    primaryColor: parsedResult.brandColors.primaryColor,
    secondaryColor: parsedResult.brandColors.secondaryColor,
    logoUrl: parsedResult.brandColors.logoUrl,
  };

  const generatedCopy: GeneratedCopy = {
    originalHeadline: parsedResult.generatedCopy.originalHeadline,
    tiktokHeadline: parsedResult.generatedCopy.tiktokHeadline,
    originalCta: parsedResult.generatedCopy.originalCta,
    tiktokCta: parsedResult.generatedCopy.tiktokCta,
    benefits: parsedResult.generatedCopy.benefits,
    explanation: parsedResult.generatedCopy.explanation,
    disclaimerText: parsedResult.generatedCopy.disclaimerText,
  };

  const primaryFormSelection: PrimaryFormSelection = {
    topCandidateScore: parsedResult.primaryFormSelection.topCandidateScore,
    runnerUpScore: parsedResult.primaryFormSelection.runnerUpScore,
  };

  return {
    extractedFields,
    brandColors,
    generatedCopy,
    formBoundingBox: parsedResult.formBoundingBox,
    primaryFormSelection,
  };
}

export async function generateCopyWithGemini(
  context: GenerateRequest['context'],
  options: GeminiCallOptions = {}
): Promise<GenerateResponse> {
  const prompt = `${COPY_GENERATION_PROMPT}\n\nContext:\n${JSON.stringify(context, null, 2)}`;
  const text = await callVertex([{ text: prompt }], options);
  const result = parseJsonResponse<GenerateResponse>(text);

  return {
    tiktokHeadline: result.tiktokHeadline,
    tiktokCta: result.tiktokCta,
    benefits: result.benefits,
    explanation: result.explanation,
    disclaimerText: result.disclaimerText,
  };
}
