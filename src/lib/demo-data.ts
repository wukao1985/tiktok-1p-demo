// lib/demo-data.ts

import { AnalyzeResponseData } from '@/types';

export type DemoFixtureKey = 'opendoor' | 'sonobello';

const SONO_BELLO_DEMO_URL = 'https://www.sonobello.com/consultation/';
const OPENDOOR_DEMO_URL = 'https://www.opendoor.com';

export function getDemoFixtureKey(url?: string | null): DemoFixtureKey {
  const normalizedUrl = url?.toLowerCase() || '';

  if (
    normalizedUrl.includes('sonobello.com') ||
    normalizedUrl.includes('consultation') ||
    normalizedUrl.includes('clinic') ||
    normalizedUrl.includes('med') ||
    normalizedUrl.includes('aesthetic')
  ) {
    return 'sonobello';
  }

  if (
    normalizedUrl.includes('opendoor.com') ||
    normalizedUrl.includes('opendoor') ||
    normalizedUrl.includes('home') ||
    normalizedUrl.includes('house') ||
    normalizedUrl.includes('property') ||
    normalizedUrl.includes('sell')
  ) {
    return 'opendoor';
  }

  return 'sonobello';
}

export function getDemoFixtureUrl(fixture: DemoFixtureKey) {
  return fixture === 'opendoor'
    ? OPENDOOR_DEMO_URL
    : SONO_BELLO_DEMO_URL;
}

export const SONO_BELLO_DEMO: AnalyzeResponseData = {
  analysisId: 'demo_sonobello',
  landingPageUrl: 'https://www.sonobello.com/consultation/',
  screenshot: {
    status: 'ok',
    url: '/sonobello-step1.png'
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
      label: 'Body Area of Interest',
      type: 'dropdown',
      required: false,
      confidence: 0.88,
      tiktokFieldId: 'custom_body_area',
      tiktokFieldType: 'CUSTOM',
      sourceSelector: "select[name='bodyArea']"
    }
  ],
  formBoundingBox: {
    x: 180,
    y: 740,
    width: 520,
    height: 150
  },
  primaryFormStepNumber: 1,
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
  },
  // 3-step Sono Bello journey
  journey: [
    {
      stepNumber: 1,
      url: 'https://www.sonobello.com/consultation/',
      title: 'Sono Bello — Body Contouring & Liposuction',
      screenshotUrl: '/sonobello-step1.png',
      fields: [
        {
          id: 'step1_field_1',
          label: 'First Name',
          type: 'text',
          required: true,
          confidence: 0.98,
          tiktokFieldId: 'first_name',
          tiktokFieldType: 'FULL_NAME',
          sourceSelector: "input[name='firstName']"
        },
        {
          id: 'step1_field_2',
          label: 'Last Name',
          type: 'text',
          required: true,
          confidence: 0.98,
          tiktokFieldId: 'last_name',
          tiktokFieldType: 'FULL_NAME',
          sourceSelector: "input[name='lastName']"
        },
        {
          id: 'step1_field_3',
          label: 'Email',
          type: 'email',
          required: true,
          confidence: 0.99,
          tiktokFieldId: 'email',
          tiktokFieldType: 'EMAIL',
          sourceSelector: "input[type='email']"
        },
        {
          id: 'step1_field_4',
          label: 'Phone',
          type: 'tel',
          required: true,
          confidence: 0.97,
          tiktokFieldId: 'phone',
          tiktokFieldType: 'PHONE_NUMBER',
          sourceSelector: "input[type='tel']"
        },
        {
          id: 'step1_field_5',
          label: 'ZIP Code',
          type: 'zip',
          required: true,
          confidence: 0.95,
          tiktokFieldId: 'zip_code',
          tiktokFieldType: 'ZIP_POST_CODE',
          sourceSelector: "input[name='zip']"
        },
        {
          id: 'step1_field_6',
          label: 'Body Area of Interest',
          type: 'dropdown',
          required: false,
          confidence: 0.88,
          tiktokFieldId: 'custom_body_area',
          tiktokFieldType: 'CUSTOM',
          sourceSelector: "select[name='bodyArea']"
        }
      ],
      ctaText: 'See If You Qualify',
      stepType: 'form'
    },
    {
      stepNumber: 2,
      url: 'https://www.sonobello.com/consultation/qualify',
      title: 'Check Your Eligibility — Sono Bello',
      fields: [
        {
          id: 'step2_field_1',
          label: 'First Name',
          type: 'text',
          required: true,
          confidence: 0.98,
          tiktokFieldId: 'first_name',
          tiktokFieldType: 'FULL_NAME',
          sourceSelector: "input[name='firstName']"
        },
        {
          id: 'step2_field_2',
          label: 'Last Name',
          type: 'text',
          required: true,
          confidence: 0.98,
          tiktokFieldId: 'last_name',
          tiktokFieldType: 'FULL_NAME',
          sourceSelector: "input[name='lastName']"
        },
        {
          id: 'step2_field_3',
          label: 'Phone',
          type: 'tel',
          required: true,
          confidence: 0.97,
          tiktokFieldId: 'phone',
          tiktokFieldType: 'PHONE_NUMBER',
          sourceSelector: "input[type='tel']"
        }
      ],
      ctaText: 'Continue',
      stepType: 'form'
    },
    {
      stepNumber: 3,
      url: 'https://www.sonobello.com/consultation/details',
      title: 'Complete Your Consultation Request',
      fields: [
        {
          id: 'step3_field_1',
          label: 'Email',
          type: 'email',
          required: true,
          confidence: 0.99,
          tiktokFieldId: 'email',
          tiktokFieldType: 'EMAIL',
          sourceSelector: "input[type='email']"
        },
        {
          id: 'step3_field_2',
          label: 'ZIP Code',
          type: 'zip',
          required: true,
          confidence: 0.95,
          tiktokFieldId: 'zip_code',
          tiktokFieldType: 'ZIP_POST_CODE',
          sourceSelector: "input[name='zip']"
        },
        {
          id: 'step3_field_3',
          label: 'Body Area of Interest',
          type: 'dropdown',
          required: false,
          confidence: 0.88,
          tiktokFieldId: 'custom_body_area',
          tiktokFieldType: 'CUSTOM',
          sourceSelector: "select[name='bodyArea']"
        }
      ],
      stepType: 'multistep'
    }
  ],
  totalJourneySteps: 3
};

export const OPENDOOR_DEMO: AnalyzeResponseData = {
  analysisId: 'demo_opendoor',
  landingPageUrl: 'https://www.opendoor.com',
  screenshot: {
    status: 'ok',
    url: '/opendoor-step1.png'
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
      label: 'First Name',
      type: 'text',
      required: true,
      confidence: 0.98,
      tiktokFieldId: 'first_name',
      tiktokFieldType: 'FULL_NAME',
      sourceSelector: "input[name='firstName']"
    },
    {
      id: 'field_3',
      label: 'Last Name',
      type: 'text',
      required: true,
      confidence: 0.98,
      tiktokFieldId: 'last_name',
      tiktokFieldType: 'FULL_NAME',
      sourceSelector: "input[name='lastName']"
    },
    {
      id: 'field_4',
      label: 'Email',
      type: 'email',
      required: true,
      confidence: 0.98,
      tiktokFieldId: 'email',
      tiktokFieldType: 'EMAIL',
      sourceSelector: "input[type='email']"
    },
    {
      id: 'field_5',
      label: 'Phone',
      type: 'tel',
      required: true,
      confidence: 0.97,
      tiktokFieldId: 'phone',
      tiktokFieldType: 'PHONE_NUMBER',
      sourceSelector: "input[type='tel']"
    },
    {
      id: 'field_6',
      label: 'ZIP Code',
      type: 'zip',
      placeholder: 'Enter ZIP',
      required: true,
      confidence: 0.97,
      tiktokFieldId: 'zip_code',
      tiktokFieldType: 'ZIP_POST_CODE',
      sourceSelector: "input[name='zip']"
    },
    {
      id: 'field_7',
      label: 'Home Type',
      type: 'dropdown',
      required: false,
      confidence: 0.85,
      tiktokFieldId: 'custom_home_type',
      tiktokFieldType: 'CUSTOM',
      sourceSelector: "select[name='homeType']"
    }
  ],
  formBoundingBox: {
    x: 95,
    y: 560,
    width: 390,
    height: 75
  },
  primaryFormStepNumber: 1,
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
      phone: { started: 847, abandoned: 312 },
      zip: { started: 600, abandoned: 100 },
      email: { started: 400, abandoned: 100 }
    },
    estimatedCtrLift: 0.38
  },
  // 4-step Opendoor journey
  journey: [
    {
      stepNumber: 1,
      url: 'https://www.opendoor.com',
      title: 'Opendoor — Sell Your Home',
      screenshotUrl: '/opendoor-step1.png',
      fields: [
        {
          id: 'step1_field_1',
          label: 'Street Address',
          type: 'text',
          required: true,
          confidence: 0.99,
          tiktokFieldId: 'street_address',
          tiktokFieldType: 'CUSTOM',
          sourceSelector: "input[name='address']"
        }
      ],
      ctaText: 'Get Your Offer',
      stepType: 'form'
    },
    {
      stepNumber: 2,
      url: 'https://www.opendoor.com/sell/address',
      title: 'Enter Your Address — Opendoor',
      fields: [
        {
          id: 'step2_field_1',
          label: 'Street Address',
          type: 'text',
          required: true,
          confidence: 0.99,
          tiktokFieldId: 'street_address',
          tiktokFieldType: 'CUSTOM',
          sourceSelector: "input[name='address']"
        }
      ],
      ctaText: 'Continue',
      stepType: 'form'
    },
    {
      stepNumber: 3,
      url: 'https://www.opendoor.com/sell/contact',
      title: 'Your Contact Information',
      fields: [
        {
          id: 'step3_field_1',
          label: 'First Name',
          type: 'text',
          required: true,
          confidence: 0.98,
          tiktokFieldId: 'first_name',
          tiktokFieldType: 'FULL_NAME',
          sourceSelector: "input[name='firstName']"
        },
        {
          id: 'step3_field_2',
          label: 'Last Name',
          type: 'text',
          required: true,
          confidence: 0.98,
          tiktokFieldId: 'last_name',
          tiktokFieldType: 'FULL_NAME',
          sourceSelector: "input[name='lastName']"
        },
        {
          id: 'step3_field_3',
          label: 'Email',
          type: 'email',
          required: true,
          confidence: 0.98,
          tiktokFieldId: 'email',
          tiktokFieldType: 'EMAIL',
          sourceSelector: "input[type='email']"
        },
        {
          id: 'step3_field_4',
          label: 'Phone',
          type: 'tel',
          required: true,
          confidence: 0.97,
          tiktokFieldId: 'phone',
          tiktokFieldType: 'PHONE_NUMBER',
          sourceSelector: "input[type='tel']"
        }
      ],
      ctaText: 'Next Step',
      stepType: 'multistep'
    },
    {
      stepNumber: 4,
      url: 'https://www.opendoor.com/sell/details',
      title: 'Property Details',
      fields: [
        {
          id: 'step4_field_1',
          label: 'ZIP Code',
          type: 'zip',
          required: true,
          confidence: 0.97,
          tiktokFieldId: 'zip_code',
          tiktokFieldType: 'ZIP_POST_CODE',
          sourceSelector: "input[name='zip']"
        },
        {
          id: 'step4_field_2',
          label: 'Home Type',
          type: 'dropdown',
          required: false,
          confidence: 0.85,
          tiktokFieldId: 'custom_home_type',
          tiktokFieldType: 'CUSTOM',
          sourceSelector: "select[name='homeType']"
        }
      ],
      stepType: 'form'
    }
  ],
  totalJourneySteps: 4
};

export function getFallbackData(url: string): AnalyzeResponseData {
  const fixture = getDemoFixtureKey(url);
  const template = fixture === 'opendoor' ? OPENDOOR_DEMO : SONO_BELLO_DEMO;

  return {
    ...structuredClone(template),
    landingPageUrl: url,
  };
}
