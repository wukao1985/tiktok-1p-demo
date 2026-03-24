// lib/demo-data.ts

import { AnalyzeResponseData } from '@/types';

export const SONO_BELLO_DEMO: AnalyzeResponseData = {
  analysisId: 'aid_sonobello_fixture',
  landingPageUrl: 'https://www.sonobello.com/consultation/',
  screenshot: {
    status: 'ok',
    url: '/api/screenshot?id=aid_sonobello_fixture'
  },
  isSimulatedData: true,
  createdAt: '2024-03-24T18:30:00Z',
  brandColors: {
    name: 'Sono Bello - SIMULATED DEMO DATA',
    primaryColor: '#E91E63',
    secondaryColor: '#FFFFFF'
  },
  extractedFields: [
    {
      id: 'field_1',
      label: 'First Name',
      type: 'text',
      required: true,
      confidence: 0.98,
      tiktokFieldId: 'first_name',
      tiktokFieldType: 'FULL_NAME',
      sourceSelector: "input[name='firstName']"
    },
    {
      id: 'field_2',
      label: 'Last Name',
      type: 'text',
      required: true,
      confidence: 0.98,
      tiktokFieldId: 'last_name',
      tiktokFieldType: 'FULL_NAME',
      sourceSelector: "input[name='lastName']"
    },
    {
      id: 'field_3',
      label: 'Email',
      type: 'email',
      required: true,
      confidence: 0.99,
      tiktokFieldId: 'email',
      tiktokFieldType: 'EMAIL',
      sourceSelector: "input[type='email']"
    },
    {
      id: 'field_4',
      label: 'Phone',
      type: 'tel',
      required: true,
      confidence: 0.97,
      tiktokFieldId: 'phone',
      tiktokFieldType: 'PHONE_NUMBER',
      sourceSelector: "input[type='tel']"
    },
    {
      id: 'field_5',
      label: 'ZIP Code',
      type: 'zip',
      required: true,
      confidence: 0.95,
      tiktokFieldId: 'zip_code',
      tiktokFieldType: 'ZIP_POST_CODE',
      sourceSelector: "input[name='zip']"
    },
    {
      id: 'field_6',
      label: 'Preferred Location',
      type: 'dropdown',
      required: false,
      confidence: 0.88,
      tiktokFieldId: 'custom_location',
      tiktokFieldType: 'CUSTOM',
      sourceSelector: "select[name='location']"
    }
  ],
  formBoundingBox: {
    x: 680,
    y: 240,
    width: 480,
    height: 520
  },
  generatedCopy: {
    originalHeadline: 'Schedule Your Free Consultation',
    tiktokHeadline: 'Free Body Consult — Results in 30 Min',
    originalCta: 'Submit',
    tiktokCta: 'Claim My Free Spot',
    benefits: [
      'See before & after results from real patients',
      'No commitment required',
      'Limited appointments this month'
    ],
    explanation: 'Specific timeframe (30 min) adds credibility. Changed generic Submit to value-driven CTA with ownership language.',
    disclaimerText: 'Results may vary. Consultation required.'
  },
  performance: {
    estimated3pLoadTime: 5.2,
    estimated1pLoadTime: 0.8,
    dropOff3p: 0.40,
    dropOff1p: 0.12,
    estimatedDropOffReduction: 0.28
  },
  retargeting: {
    totalFormStarts: 1247,
    totalAbandonments: 412,
    fieldBreakdown: {
      phone: { started: 847, abandoned: 312 },
      zip: { started: 600, abandoned: 100 }
    },
    estimatedCtrLift: 0.42
  }
};

export const OPENDOOR_DEMO: AnalyzeResponseData = {
  analysisId: 'aid_opendoor_fixture',
  landingPageUrl: 'https://www.opendoor.com',
  screenshot: {
    status: 'ok',
    url: '/api/screenshot?id=aid_opendoor_fixture'
  },
  isSimulatedData: true,
  createdAt: '2024-03-24T18:30:00Z',
  brandColors: {
    name: 'Opendoor - SIMULATED DEMO DATA',
    primaryColor: '#0B4F99',
    secondaryColor: '#FFFFFF'
  },
  extractedFields: [
    {
      id: 'field_1',
      label: 'Street Address',
      type: 'text',
      required: true,
      confidence: 0.99,
      tiktokFieldId: 'street_address',
      tiktokFieldType: 'CUSTOM',
      sourceSelector: "input[name='address']"
    },
    {
      id: 'field_2',
      label: 'Email',
      type: 'email',
      required: true,
      confidence: 0.98,
      tiktokFieldId: 'email',
      tiktokFieldType: 'EMAIL',
      sourceSelector: "input[type='email']"
    },
    {
      id: 'field_3',
      label: 'ZIP Code',
      type: 'zip',
      placeholder: 'Enter ZIP',
      required: true,
      confidence: 0.97,
      tiktokFieldId: 'zip_code',
      tiktokFieldType: 'ZIP_POST_CODE',
      sourceSelector: "input[name='zip']"
    }
  ],
  formBoundingBox: {
    x: 600,
    y: 200,
    width: 400,
    height: 300
  },
  generatedCopy: {
    originalHeadline: 'Get a competitive cash offer',
    tiktokHeadline: 'See Your Home\'s Value in 24 Hours',
    originalCta: 'Get my offer',
    tiktokCta: 'Get My Free Estimate',
    benefits: [
      'No repairs needed',
      'Close on your timeline',
      'No showings or open houses'
    ],
    explanation: 'Specific timeframe (24 hours) creates urgency. First-person CTA increases ownership.'
  },
  performance: {
    estimated3pLoadTime: 4.8,
    estimated1pLoadTime: 0.8,
    dropOff3p: 0.38,
    dropOff1p: 0.12,
    estimatedDropOffReduction: 0.26
  },
  retargeting: {
    totalFormStarts: 1247,
    totalAbandonments: 412,
    fieldBreakdown: {
      phone: { started: 0, abandoned: 0 },
      zip: { started: 847, abandoned: 312 },
      email: { started: 400, abandoned: 100 }
    },
    estimatedCtrLift: 0.38
  }
};

export function getFallbackData(url: string): AnalyzeResponseData {
  // Determine which demo data to use based on URL
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('sonobello.com') || lowerUrl.includes('consultation') || lowerUrl.includes('clinic') || lowerUrl.includes('med') || lowerUrl.includes('aesthetic')) {
    return { ...SONO_BELLO_DEMO, landingPageUrl: url };
  }
  if (lowerUrl.includes('opendoor.com') || lowerUrl.includes('home') || lowerUrl.includes('house') || lowerUrl.includes('property') || lowerUrl.includes('sell')) {
    return { ...OPENDOOR_DEMO, landingPageUrl: url };
  }
  // Default to Sono Bello
  return { ...SONO_BELLO_DEMO, landingPageUrl: url };
}
