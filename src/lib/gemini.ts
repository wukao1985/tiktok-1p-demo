// lib/gemini.ts

import { AnalyzeResponseData, ExtractedField, BrandColors, GeneratedCopy } from '@/types';

const VERTEX_AI_API_KEY = process.env.VERTEX_AI_API_KEY || 'AQ.Ab8RN6KJK9L-sR2FIEXMQuMp8Tcco4Y4ybKrTPQa--nRQsp32A';
const VERTEX_AI_ENDPOINT = `https://us-central1-aiplatform.googleapis.com/v1/projects/focal-welder-485422-s2/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent?key=${VERTEX_AI_API_KEY}`;

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

const ANALYSIS_PROMPT = `You are an expert web form analyzer and TikTok ads copywriter. Extract structured form field data from the provided HTML AND generate optimized copy in a single response.

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
- Identify all form input fields (input, select, textarea elements)
- For each field, determine label from <label>, placeholder, or nearby text
- If multiple forms exist, select the one most likely to be the primary lead capture form
- Return bounding box coordinates for the primary form only
- Confidence < 0.8 should be rare—use when label is unclear or type is ambiguous
- Map similar fields: 'First' → 'First Name', 'E-mail' → 'Email'
- Sanitize HTML input: strip <script> tags, ignore inline event handlers
- Ignore cookie consent banners, newsletter signups, and search boxes
- Set tiktokFieldType based on field purpose: FULL_NAME for name fields, EMAIL for email, PHONE_NUMBER for phone, ZIP_POST_CODE for zip, CUSTOM for all others

RULES FOR COPY GENERATION:
- Headline: Lead with benefit + urgency or curiosity gap, MAX 50 characters including spaces, use specific numbers when possible ('24 Hours' not 'Fast'), avoid superlatives like 'best', 'guaranteed results'
- CTA: Action-oriented, first-person ('Claim My' vs 'Submit'), MAX 20 characters including spaces, use ownership language ('My', 'Your')
- Benefits: 2-4 bullet points, MAX 60 characters each, TikTok-native: short, punchy

COMPLIANCE RULES:
- Medical/aesthetics: NO claims of guaranteed outcomes, NO before/after images implied to be typical, NO medical advice or diagnosis language, USE 'consultation' not 'treatment', USE 'may' not 'will' for results, set disclaimerText to: "Results may vary. Consultation required."
- Finance: NO guaranteed approval claims, NO specific interest rates without qualification, include 'Terms apply' if mentioning rates
- Real estate: NO guaranteed offer amounts, USE 'estimate' not 'valuation'

Return ONLY valid JSON. No markdown, no explanations outside the JSON.`;

export async function analyzeWithGemini(
  htmlContent: string,
  screenshotBase64?: string,
  url?: string
): Promise<Partial<AnalyzeResponseData>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const content: Array<{ type: string; text?: string; inlineData?: { mimeType: string; data: string } }> = [
      {
        type: 'text',
        text: `${ANALYSIS_PROMPT}\n\nURL: ${url || 'unknown'}\n\nHTML Content:\n${htmlContent.slice(0, 50000)}`
      }
    ];

    if (screenshotBase64) {
      content.push({
        type: 'inlineData',
        inlineData: {
          mimeType: 'image/png',
          data: screenshotBase64
        }
      });
    }

    const response = await fetch(VERTEX_AI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: content
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Vertex AI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Extract the JSON from the response
    let parsedResult: GeminiResponse;

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text;
      // Try to parse JSON from the text (handle markdown code blocks)
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```\n([\s\S]*?)\n```/) || [null, text];
      const jsonString = jsonMatch[1] || text;
      parsedResult = JSON.parse(jsonString.trim());
    } else {
      throw new Error('Unexpected response format from Vertex AI');
    }

    // Transform the response to match our types
    const extractedFields: ExtractedField[] = parsedResult.extractedFields.map(field => ({
      id: field.id,
      label: field.label,
      type: field.type as ExtractedField['type'],
      placeholder: field.placeholder,
      required: field.required,
      confidence: field.confidence,
      tiktokFieldId: field.tiktokFieldId,
      tiktokFieldType: field.tiktokFieldType as ExtractedField['tiktokFieldType'],
      sourceSelector: field.sourceSelector
    }));

    const brandColors: BrandColors = {
      name: parsedResult.brandColors.name,
      primaryColor: parsedResult.brandColors.primaryColor,
      secondaryColor: parsedResult.brandColors.secondaryColor,
      logoUrl: parsedResult.brandColors.logoUrl
    };

    const generatedCopy: GeneratedCopy = {
      originalHeadline: parsedResult.generatedCopy.originalHeadline,
      tiktokHeadline: parsedResult.generatedCopy.tiktokHeadline,
      originalCta: parsedResult.generatedCopy.originalCta,
      tiktokCta: parsedResult.generatedCopy.tiktokCta,
      benefits: parsedResult.generatedCopy.benefits,
      explanation: parsedResult.generatedCopy.explanation,
      disclaimerText: parsedResult.generatedCopy.disclaimerText
    };

    return {
      extractedFields,
      brandColors,
      generatedCopy,
      formBoundingBox: parsedResult.formBoundingBox
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('LLM analysis timed out after 5 seconds');
    }
    throw error;
  }
}
