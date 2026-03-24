# TikTok 1P Demo Tool — Implementation Spec

## 1. Demo Overview

The TikTok 1P Demo Tool is a sales enablement web application that demonstrates to TikTok advertisers how AI can automatically convert their existing third-party landing pages into TikTok Instant Forms (1P Lead Generation). The problem: advertisers spend days manually configuring forms, lose 60%+ of users to slow 3P page loads, and have zero visibility into where users drop off. This demo shows, in under 8 seconds end-to-end, how a single URL becomes a fully-configured, instant-loading TikTok form with retargeting capabilities built from field-level abandonment data. It matters because every day an advertiser delays 1P migration is lost high-intent leads and wasted ad spend.

---

## 2. Demo Flow

### Step 1: Landing Page Input
- **User sees**: Clean input page with TikTok branding, single URL field labeled "Enter your landing page URL", and two demo buttons: "Try Opendoor" / "Try Sono Bello"
- **User does**: Pastes `https://www.sonobello.com/consultation/` OR clicks demo button
- **System does**: Validates URL format, normalizes (adds https:// if missing), navigates to `/analyze?url=...` with loading spinner showing "Analyzing page structure..."

### Step 2: Analysis Phase (Loading Page)
- **User sees**: Progress indicator with animated stages: "Scraping page..." → "Analyzing with AI..." → "Finalizing..."
- **System does**:
  - `POST /api/analyze` returns the full `AnalyzeResponseData` inline and stores that exact same JSON payload in Vercel KV under `analysisId`
  - Server-side Puppeteer captures full-page screenshot (1280x900 viewport)
  - Server-side Puppeteer extracts HTML body content (consent banners handled)
  - Vertex AI Gemini performs **single combined analysis**: extracts fields, generates copy, AND extracts brand colors in **one LLM call**
  - Latency budget: screenshot 2s + LLM 5s + format 0.5s + network 0.5s = **8s total**
  - On success, client navigates to `/preview?aid={analysisId}`

### Step 3: Side-by-Side Preview
- **User sees**: Split-screen view at `/preview?aid={analysisId}`
  - **LEFT (40%)**: Landing page screenshot with highlight overlay on the original form
  - **RIGHT (60%)**: Generated TikTok Instant Form preview (mobile frame)
- **User does**: Scrolls to review form fields, clicks "Edit" on any field to open edit modal
- **System does**: Page loads call `GET /api/analyze?aid={analysisId}` to hydrate from KV, so refresh/share uses the same payload as the original POST
- **System shows**: Matched fields with mapping (e.g., "Phone Number → phone_field_1, 98% confidence")

### Step 4: L1→L3 Tab Reveal
- **User sees**: Three tabs across top: "Field Detection" | "AI Copy" | "Performance"
- **User clicks**: Each tab reveals deeper layer:
  - **L1 Field Detection**: List of auto-extracted fields with data types, confidence badges
  - **L2 AI Copy**: Original headline → Generated headline comparison, with "Why this works" tooltip
  - **L3 Performance**: Side-by-side load time simulation (3P: 5.2s → 1P: 0.8s), drop-off percentage

### Step 5: Retargeting Bonus
- **User sees**: "Unlock Retargeting" section below form preview with "SIMULATED DEMO DATA" label
- **User clicks**: "Simulate Drop-off Data" button
- **System navigates to**: `/bonus?aid={analysisId}`
- **System does**: Bonus page calls `GET /api/analyze?aid={analysisId}` and renders the stored analysis payload from KV
- **System shows**: Dashboard with simulated data— "1,247 users started form, 412 abandoned overall; phone shows 847 starts / 312 abandonments and zip shows 600 starts / 100 abandonments → Auto-created audience 'High Intent - Phone Captured' → Est. CTR: +42%"

---

## 3. Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              NEXT.JS APP (Vercel)                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                           FRONTEND LAYER                                 │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │   Index     │  │   Analyze   │  │  Preview    │  │  Retarget   │     │   │
│  │  │   Page      │──│   Page      │──│   Page      │──│   Dashboard │     │   │
│  │  │  (/)        │  │  (/analyze) │  │  (/preview) │  │  (/bonus)   │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  │                                                                          │   │
│  │  Components: UrlInput, LandingPreview, FormPreview, LoadTimeViz,         │   │
│  │              ConfidenceBadge, FieldMapper, RetargetPanel, FieldEditModal │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                      │                                          │
│  ┌───────────────────────────────────┼─────────────────────────────────────┐   │
│  │                         API ROUTES LAYER                                │   │
│  │                           (App Router)                                  │   │
│  │                                                                         │   │
│  │  POST/GET /api/analyze  GET /api/screenshot      POST /api/generate     │   │
│  │       │                       │                       │                 │   │
│  │       ▼                       ▼                       ▼                 │   │
│  │  ┌─────────┐            ┌──────────┐           ┌────────────┐           │   │
│  │  │ scraper │───────────▶│  Gemini  │──────────▶│  response  │           │   │
│  │  │service  │   HTML     │  Vertex  │  fields   │  formatter │           │   │
│  │  └─────────┘            └──────────┘           └────────────┘           │   │
│  │       │                      │                                          │   │
│  └───────┼──────────────────────┼──────────────────────────────────────────┘   │
│          │                      │                                               │
│          ▼                      ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         EXTERNAL SERVICES                                │   │
│  │                                                                          │   │
│  │   ┌─────────────┐           ┌─────────────────────────┐                 │   │
│  │   │  Chromium   │           │  Google Cloud Vertex AI │                 │   │
│  │   │  (@sparticuz│           │  Gemini 2.0 Flash       │                 │   │
│  │   │  /chromium) │           │  - Field extraction     │                 │   │
│  │   │             │           │  - Copy generation      │                 │   │
│  │   │  - Screenshot│          │  - Confidence scores    │                 │   │
│  │   │  - HTML fetch │         │                         │                 │   │
│  │   └─────────────┘           └─────────────────────────┘                 │   │
│  │                                                                          │   │
│  │   ┌─────────────────────────────────────────────┐                       │   │
│  │   │  Vercel KV (State Storage)                  │                       │   │
│  │   │  - analysis:{id} → StoredAnalysis (JSON)    │                       │   │
│  │   │  - screenshot:{id} → PNG (base64)           │                       │   │
│  │   │  - ratelimit:{ip} → Counter (60s TTL)       │                       │   │
│  │   └─────────────────────────────────────────────┘                       │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘

DATA FLOW:
┌─────────┐    ┌──────────┐    ┌─────────┐    ┌──────────┐    ┌─────────────┐
│  URL    │───▶│ Chromium │───▶│  HTML   │───▶│  Gemini  │───▶│   Stored    │
│  Input  │    │ scrape   │    │ + SS    │    │  LLM     │    │   in KV     │
└─────────┘    └──────────┘    └─────────┘    └──────────┘    └──────┬──────┘
                                                                      │
                                                                      ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐
│   React     │◀───│  Client     │◀───│ GET /api/   │◀───│  {aid} lookup       │
│   State     │    │  Render     │    │ analyze?aid │    │  KV: analysis:{id}  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────────────┘
```

### Key Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| Server-side Chromium (@sparticuz/chromium) | Vercel-compatible, avoids CORS, handles JS-rendered pages |
| Vercel KV for state storage | Durable storage keyed by analysisId; survives navigation/refresh |
| Sync full-payload response + KV hydration | `POST /api/analyze` returns full `AnalyzeResponseData` inline, writes the exact same payload to KV, and `/preview` + `/bonus` rehydrate with `GET /api/analyze?aid=` |
| 8-second end-to-end latency budget | Per-step budgets sum to ≤8s: screenshot (2s) + LLM (5s) + formatting (0.5s) + network (0.5s) = 8s total |
| Fallback to demo data | Non-timeout operational failures return 422/503 with `fallbackAvailable:true` so the client can show "Use Demo Data" and load pre-cached Opendoor/Sono Bello fixtures |
| Timeout handling | On >8.0s timeout: auto-return simulated data with `isSimulatedData:true` and `fallbackReason:"timeout"` |
| AbortController + requestId | Cancel in-flight requests, prevent stale response races |

### Vercel Runtime Configuration

```json
{
  "functions": {
    "app/api/analyze/route.ts": {
      "maxDuration": 60,
      "memory": 1024
    },
    "app/api/screenshot/route.ts": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

---

## 4. File Structure

```
/Users/cloud/Documents/claude/tiktok-1p-demo/
├── app/
│   ├── page.tsx                    # Landing page with URL input
│   ├── analyze/
│   │   └── page.tsx                # Loading/analysis progress page
│   ├── preview/
│   │   └── page.tsx                # Side-by-side comparison page
│   ├── bonus/
│   │   └── page.tsx                # Retargeting dashboard page
│   ├── api/
│   │   ├── analyze/
│   │   │   └── route.ts            # POST /api/analyze writes full payload; GET /api/analyze?aid= reads from KV
│   │   ├── screenshot/
│   │   │   └── route.ts            # GET /api/screenshot?id={analysisId}
│   │   └── generate/
│   │       └── route.ts            # POST /api/generate - LLM copy regeneration
│   ├── layout.tsx                  # Root layout with TikTok branding
│   └── globals.css                 # Tailwind + custom TikTok color vars
├── components/
│   ├── ui/                         # shadcn/ui base components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── tabs.tsx
│   │   ├── progress.tsx
│   │   ├── dialog.tsx              # For field edit modal
│   │   └── badge.tsx
│   ├── UrlInput.tsx                # URL entry with validation, demo buttons
│   ├── AnalysisProgress.tsx        # Animated progress stages with cancel
│   ├── LandingPreview.tsx          # Left pane: screenshot with form overlay
│   ├── FormPreview.tsx             # Right pane: TikTok form mockup
│   ├── FieldMapper.tsx             # Field mapping with confidence badges
│   ├── FieldEditModal.tsx          # Modal for editing field properties
│   ├── CopyComparison.tsx          # L2: Original vs AI copy side-by-side
│   ├── LoadTimeViz.tsx             # L3: Animated load time comparison
│   ├── RetargetPanel.tsx           # Bonus: Drop-off visualization
│   ├── MobileFrame.tsx             # TikTok-style phone frame wrapper
│   └── SimulatedDataBanner.tsx     # "SIMULATED DEMO DATA" label component
├── lib/
│   ├── scraper.ts                  # Chromium scraping utilities
│   ├── llm.ts                      # Vertex AI Gemini client
│   ├── kv.ts                       # Vercel KV client
│   ├── cache.ts                    # Analysis result caching (KV wrapper)
│   ├── validators.ts               # URL validation, field type detection
│   ├── demo-data.ts                # Fallback data for Opendoor/Sono Bello
│   └── rate-limit.ts               # Rate limiting utilities
├── types/
│   └── index.ts                    # Canonical TypeScript interfaces
├── prompts/
│   ├── combined-analysis.txt       # Single LLM prompt for fields + copy + brand colors
│   └── copy-regeneration.txt       # LLM prompt for /api/generate copy rewriting
├── public/
│   ├── tiktok-logo.svg
│   └── demo-screenshots/           # Pre-cached demo screenshots
├── next.config.js
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## 5. Tech Stack

| Category | Technology | Version | Rationale |
|----------|------------|---------|-----------|
| Framework | Next.js | 14.2.5 | App Router, API routes, Vercel optimized |
| Runtime | Node.js | nodejs18.x (tested on 18.20.4 LTS) | Vercel serverless functions |
| Language | TypeScript | 5.5.4 | Type safety, maintainability |
| Styling | Tailwind CSS | 3.4.10 | Rapid UI, consistent with Kao's projects |
| UI Components | shadcn/ui | 0.8.0 | Accessible, customizable primitives |
| Animation | Framer Motion | 11.3.31 | Smooth transitions, progress indicators |
| Scraping | puppeteer-core | 23.1.0 | Browser automation (Vercel compatible) |
| Chromium | @sparticuz/chromium | 127.0.0 | Vercel-compatible Chromium binary |
| KV Store | @vercel/kv | 2.0.0 | State storage, rate limiting |
| LLM | @google-cloud/vertexai | 1.8.0 | Gemini 2.0 Flash integration |
| Icons | lucide-react | 0.436.0 | Consistent iconography |
| Deployment | Vercel | — | Serverless functions, edge caching |

### Page Routing Contract

- `/analyze?url=...` submits `POST /api/analyze`.
- Every HTTP 200 from `POST /api/analyze` returns full `AnalyzeResponseData` inline and persists that exact same object to `analysis:{analysisId}` in KV.
- `/preview?aid=...` and `/bonus?aid=...` always hydrate by calling `GET /api/analyze?aid={analysisId}` so refresh, share, and cross-page navigation all use the same stored payload.

### Environment Variables

```bash
# =============================================================================
# GOOGLE CLOUD VERTEX AI
# =============================================================================
# Google Cloud project identifier
GOOGLE_CLOUD_PROJECT_ID=your-project-id

# Vertex AI region (must support Gemini 2.0 Flash)
GOOGLE_CLOUD_LOCATION=us-central1

# Base64-encoded service account JSON key
# Decode at runtime: Buffer.from(env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64')
GOOGLE_APPLICATION_CREDENTIALS_BASE64=ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIsCiAgInByb2plY3RfaWQiOiAiLi4uIgp9

# =============================================================================
# VERCEL KV (State Storage & Rate Limiting)
# =============================================================================
# Connection string from Vercel KV dashboard
KV_URL=redis://default:...@...-upstash.io:6379
KV_REST_API_URL=https://...-upstash.io
KV_REST_API_TOKEN=...

# Analysis result TTL in seconds (default: 300 = 5 minutes)
ANALYSIS_TTL_SECONDS=300

# =============================================================================
# RATE LIMITING
# =============================================================================
# Max requests per minute per IP (default: 10)
RATE_LIMIT_MAX_REQUESTS=10

# Rate limit window in seconds (default: 60)
RATE_LIMIT_WINDOW_SECONDS=60

# IPs exempt from rate limiting (comma-separated, for demo events)
RATE_LIMIT_EXEMPT_IPS=127.0.0.1,::1

# =============================================================================
# SECURITY
# =============================================================================
# CORS is same-origin only - no external domains allowed
# See Section 13 for CSP/CORS configuration
#
# Screenshots are stored in Vercel KV keyed by analysisId (UUID v4)
# Retrieved via GET /api/screenshot?id={analysisId}
# No token signing needed - UUIDs are 128-bit and not guessable

# =============================================================================
# DEMO MODE
# =============================================================================
# Enable fallback to demo data on scraping failure
ENABLE_DEMO_FALLBACK=true

# Force demo mode (always use fixture data, for presentations)
FORCE_DEMO_MODE=false

# =============================================================================
# LOCAL DEVELOPMENT (optional alternatives to base64 credentials)
# =============================================================================
# Path to local service account JSON (used if GOOGLE_APPLICATION_CREDENTIALS_BASE64 not set)
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Service Account Setup Flow

1. Create service account in Google Cloud Console
2. Download JSON key file
3. For local dev: Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json`
4. For production: `cat key.json | base64` and set as `GOOGLE_APPLICATION_CREDENTIALS_BASE64`
5. At runtime, decode: `const credentials = JSON.parse(Buffer.from(env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString())`

---

## 6. API Contracts

### POST /api/analyze

Main orchestration endpoint that scrapes and analyzes a landing page.

On every HTTP 200 response, the server MUST persist `data` verbatim to `analysis:{analysisId}` in Vercel KV before returning the response. `StoredAnalysis` is exactly the same shape as `AnalyzeResponseData`.

**Request:**
```json
{
  "url": "https://www.sonobello.com/consultation/",
  "useCache": true,
  "requestId": "req_abc123xyz"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "analysisId": "aid_abc123xyz",
    "landingPageUrl": "https://www.sonobello.com/consultation/",
    "screenshot": {
      "status": "ok",
      "url": "/api/screenshot?id=aid_abc123xyz"
    },
    "isSimulatedData": false,
    "createdAt": "2024-03-24T18:30:00Z",
    "brandColors": {
      "name": "Sono Bello",
      "primaryColor": "#E91E63",
      "secondaryColor": "#FFFFFF"
    },
    "extractedFields": [
      {
        "id": "field_1",
        "label": "First Name",
        "type": "text",
        "required": true,
        "confidence": 0.98,
        "tiktokFieldId": "first_name",
        "tiktokFieldType": "FULL_NAME",
        "sourceSelector": "input[name='firstName']"
      },
      {
        "id": "field_2",
        "label": "Last Name",
        "type": "text",
        "required": true,
        "confidence": 0.98,
        "tiktokFieldId": "last_name",
        "tiktokFieldType": "FULL_NAME",
        "sourceSelector": "input[name='lastName']"
      },
      {
        "id": "field_3",
        "label": "Email",
        "type": "email",
        "required": true,
        "confidence": 0.99,
        "tiktokFieldId": "email",
        "tiktokFieldType": "EMAIL",
        "sourceSelector": "input[type='email']"
      },
      {
        "id": "field_4",
        "label": "Phone",
        "type": "tel",
        "required": true,
        "confidence": 0.97,
        "tiktokFieldId": "phone",
        "tiktokFieldType": "PHONE_NUMBER",
        "sourceSelector": "input[type='tel']"
      },
      {
        "id": "field_5",
        "label": "ZIP Code",
        "type": "zip",
        "required": true,
        "confidence": 0.95,
        "tiktokFieldId": "zip_code",
        "tiktokFieldType": "ZIP_POST_CODE",
        "sourceSelector": "input[name='zip']"
      },
      {
        "id": "field_6",
        "label": "Preferred Location",
        "type": "dropdown",
        "required": false,
        "confidence": 0.88,
        "tiktokFieldId": "custom_location",
        "tiktokFieldType": "CUSTOM",
        "sourceSelector": "select[name='location']"
      }
    ],
    "formBoundingBox": {
      "x": 680,
      "y": 240,
      "width": 480,
      "height": 520
    },
    "generatedCopy": {
      "originalHeadline": "Schedule Your Free Consultation",
      "tiktokHeadline": "Free Body Consultation — See Results in 30 Min",
      "originalCta": "Submit",
      "tiktokCta": "Claim My Free Spot",
      "benefits": [
        "See before & after results from real patients",
        "No commitment required",
        "Limited appointments this month"
      ],
      "explanation": "Added specificity (30 min) and social proof to headline. Changed generic 'Submit' to value-driven CTA with ownership language ('My').",
      "disclaimerText": "Results may vary. Consultation required."
    },
    "performance": {
      "estimated3pLoadTime": 5.2,
      "estimated1pLoadTime": 0.8,
      "dropOff3p": 0.40,
      "dropOff1p": 0.12,
      "estimatedDropOffReduction": 0.28
    },
    "retargeting": {
      "totalFormStarts": 1247,
      "totalAbandonments": 412,
      "fieldBreakdown": {
        "phone": {"started": 847, "abandoned": 312},
        "zip": {"started": 600, "abandoned": 100}
      },
      "estimatedCtrLift": 0.42
    }
  },
  "requestId": "req_abc123xyz",
  "latencyMs": 3420
}
```

`POST /api/analyze` returns the full payload inline for the initial navigation and stores that identical `data` object in KV for `GET /api/analyze?aid={analysisId}`.

**Timeout Fallback (>8.0s):**
- Server returns HTTP 200 with `{ success: true, data: { ...simulatedPayload, isSimulatedData: true }, fallbackReason: "timeout" }`
- The success payload keeps the normal `AnalyzeResponseData` shape and is also stored in KV under `analysisId`
- Client navigates directly to preview; no "Use Demo Data" button is shown

**Error Responses:**

| Status | Code | Message | Retryable | Headers |
|--------|------|---------|-----------|---------|
| 400 | INVALID_URL | URL format not recognized | No | — |
| 400 | MISSING_URL | Request body missing url field | No | — |
| 422 | SCRAPING_BLOCKED | Target site blocks automated access | No | X-Error-Source: scraper |
| 422 | PAGE_NOT_FOUND | URL returned 404 or DNS failure | No | — |
| 422 | NO_FORM_DETECTED | No form elements found on page | No | — |
| 422 | PRIMARY_FORM_UNCERTAIN | Multiple candidate forms scored too low or too close together to choose a primary form | No | — |
| 429 | RATE_LIMITED | Too many requests | Yes (60s) | Retry-After: 60, X-RateLimit-Limit: 10, X-RateLimit-Remaining: 0 |
| 503 | LLM_ERROR | Gemini API error or malformed JSON | Yes | — |
| 503 | KV_WRITE_ERROR | Failed to store analysis result | Yes | — |

All non-timeout operational failures (scrape fail, no form, LLM error, KV write error) return HTTP 422/503 with `{ success: false, error: { code, message }, fallbackAvailable: true }`. The client shows a **"Use Demo Data"** button only for these 422/503 responses.

**PRIMARY_FORM_UNCERTAIN rule:** After scoring all forms, if `scored[0].score < 60` OR `(scored.length >= 2 AND scored[0].score - scored[1].score < 15)`, return `422 PRIMARY_FORM_UNCERTAIN`.

**Response (Error Example):**
```json
{
  "success": false,
  "error": {
    "code": "SCRAPING_BLOCKED",
    "message": "Target site blocks automated access",
    "retryable": false
  },
  "fallbackAvailable": true,
  "requestId": "req_abc123xyz",
  "timestamp": "2024-03-24T18:30:00Z"
}
```

---

### GET /api/analyze

Hydrates `/preview?aid=...` and `/bonus?aid=...` from Vercel KV using the stored analysis payload written by `POST /api/analyze`.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| aid | string | Yes | Analysis ID to fetch from KV |

**Response (200 OK):**
- Returns the same `ApiResponse<AnalyzeResponseData>` envelope and the exact same `data` shape previously stored at `analysis:{aid}`

**Error Responses:**

| Status | Code | Message | Headers |
|--------|------|---------|---------|
| 400 | MISSING_AID | Query parameter 'aid' is required | — |
| 404 | ANALYSIS_NOT_FOUND | No stored analysis found for analysis ID | X-Analysis-Id: {id} |
| 410 | ANALYSIS_EXPIRED | Stored analysis exceeded TTL and was purged | — |

---

### GET /api/screenshot

Retrieves a stored screenshot by analysis ID. Screenshots are stored in Vercel KV keyed by `analysisId` (UUID v4) and fetched via `GET /api/screenshot?id={analysisId}`. No token signing is needed because UUIDs are 128-bit and not guessable.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | string | Yes | Analysis ID returned from /api/analyze |

**Response (200 OK):**
- Content-Type: `image/png`
- Body: PNG binary data
- Headers:
  - `Cache-Control: public, max-age=300`
  - `X-Analysis-Id: aid_abc123xyz`

**Error Responses:**

| Status | Code | Message | Headers |
|--------|------|---------|---------|
| 400 | MISSING_ID | Query parameter 'id' is required | — |
| 404 | SCREENSHOT_NOT_FOUND | No screenshot found for analysis ID | X-Analysis-Id: {id} |
| 410 | SCREENSHOT_EXPIRED | Screenshot exceeded TTL and was purged | — |

---

### POST /api/generate

Standalone endpoint for regenerating copy with different tones. Reuses the `generatedCopy` portion of the combined analysis prompt.

**Request:**
```json
{
  "context": {
    "originalHeadline": "Schedule Your Free Consultation",
    "originalCta": "Submit",
    "industry": "medical_aesthetics",
    "tone": "urgent",
    "brandName": "Sono Bello"
  },
  "requestId": "req_regen_001"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "tiktokHeadline": "Free Body Consultation — See Results in 30 Min",
    "tiktokCta": "Claim My Free Spot",
    "benefits": [
      "See before & after results from real patients",
      "No commitment required",
      "Limited appointments this month"
    ],
    "explanation": "Added specificity (30 min) and social proof to headline. Changed generic 'Submit' to value-driven CTA.",
    "disclaimerText": "Results may vary. Consultation required."
  },
  "requestId": "req_regen_001",
  "latencyMs": 1240
}
```

**Error Responses:**

| Status | Code | Message | Retryable |
|--------|------|---------|-----------|
| 400 | MISSING_CONTEXT | Request body missing context field | No |
| 400 | INVALID_INDUSTRY | Industry not in allowed list | No |
| 400 | INVALID_TONE | Tone not in allowed list | No |
| 429 | RATE_LIMITED | Too many requests | Yes (60s) |
| 500 | LLM_ERROR | Gemini API error or malformed JSON | Yes |
| 500 | COMPLIANCE_BLOCKED | Generated copy violated compliance rules | No |

---

## 7. TypeScript Schema (Canonical)

All API endpoints, prompts, and frontend components MUST use these types. No deviations allowed.

```typescript
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
```

---

## 8. LLM Prompt Design

### Combined Analysis Prompt (Structured Output)

Uses Gemini function calling/structured output for reliable parsing. `/api/analyze` makes exactly one Gemini call, and that single response returns `extractedFields`, `generatedCopy`, and `brandColors` together.

```json
{
  "systemPrompt": "You are an expert web form analyzer and TikTok ads copywriter. Extract structured form field data from the provided HTML AND generate optimized copy in a single response. Be precise with confidence scores and comply with advertising policies for regulated industries.",
  "inputSchema": {
    "url": "string - The page URL",
    "html": "string - The HTML body content",
    "viewport": {"width": 1280, "height": 900}
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "extractedFields": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "id": {"type": "string", "pattern": "^field_\\d+$"},
            "label": {"type": "string", "maxLength": 100},
            "type": {"enum": ["text", "email", "tel", "number", "zip", "dropdown", "checkbox", "radio", "date"]},
            "required": {"type": "boolean"},
            "confidence": {"type": "number", "minimum": 0, "maximum": 1},
            "tiktokFieldId": {"type": "string"},
            "tiktokFieldType": {"enum": ["FULL_NAME", "EMAIL", "PHONE_NUMBER", "ZIP_POST_CODE", "CUSTOM"]},
            "sourceSelector": {"type": "string"}
          },
          "required": ["id", "label", "type", "required", "confidence", "tiktokFieldId", "tiktokFieldType", "sourceSelector"]
        }
      },
      "formBoundingBox": {
        "type": "object",
        "properties": {
          "x": {"type": "number"},
          "y": {"type": "number"},
          "width": {"type": "number"},
          "height": {"type": "number"}
        },
        "required": ["x", "y", "width", "height"]
      },
      "brandColors": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "primaryColor": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
          "secondaryColor": {"type": "string", "pattern": "^#[0-9A-Fa-f]{6}$"},
          "logoUrl": {"type": "string"}
        },
        "required": ["name", "primaryColor", "secondaryColor"]
      },
      "generatedCopy": {
        "type": "object",
        "properties": {
          "originalHeadline": {"type": "string", "maxLength": 200},
          "tiktokHeadline": {"type": "string", "maxLength": 50},
          "originalCta": {"type": "string", "maxLength": 50},
          "tiktokCta": {"type": "string", "maxLength": 20},
          "benefits": {"type": "array", "items": {"type": "string", "maxLength": 60}, "minItems": 2, "maxItems": 4},
          "explanation": {"type": "string", "maxLength": 200},
          "disclaimerText": {"type": "string", "maxLength": 100}
        },
        "required": ["originalHeadline", "tiktokHeadline", "originalCta", "tiktokCta", "benefits", "explanation"]
      }
    },
    "required": ["extractedFields", "formBoundingBox", "brandColors", "generatedCopy"]
  },
  "fieldExtractionInstructions": [
    "Identify all form input fields (input, select, textarea elements).",
    "For each field, determine label from <label>, placeholder, or nearby text.",
    "If multiple forms exist, select the one most likely to be the primary lead capture form (largest, most fields, prominent position).",
    "Return bounding box coordinates for the primary form only.",
    "Confidence < 0.8 should be rare—use when label is unclear or type is ambiguous.",
    "Map similar fields: 'First' → 'First Name', 'E-mail' → 'Email'.",
    "Sanitize HTML input: strip <script> tags, ignore inline event handlers.",
    "Ignore cookie consent banners, newsletter signups, and search boxes.",
    "Set tiktokFieldType based on field purpose: FULL_NAME for name fields, EMAIL for email, PHONE_NUMBER for phone, ZIP_POST_CODE for zip, CUSTOM for all others."
  ],
  "copyGenerationRules": {
    "headline": [
      "Lead with benefit + urgency or curiosity gap",
      "MAX 50 characters including spaces—MUST validate",
      "Use specific numbers when possible ('24 Hours' not 'Fast')",
      "Avoid superlatives like 'best', 'guaranteed results'"
    ],
    "cta": [
      "Action-oriented, first-person ('Claim My' vs 'Submit')",
      "MAX 20 characters including spaces—MUST validate",
      "Use ownership language ('My', 'Your')"
    ],
    "benefits": [
      "2-4 bullet points",
      "MAX 60 characters each",
      "TikTok-native: short, punchy"
    ],
    "compliance": {
      "medical_aesthetics": [
        "NO claims of guaranteed outcomes",
        "NO before/after images implied to be typical",
        "NO medical advice or diagnosis language",
        "USE 'consultation' not 'treatment'",
        "USE 'may' not 'will' for results",
        "For medical/aesthetic/health verticals set disclaimerText to: Results may vary. Consultation required."
      ],
      "finance": [
        "NO guaranteed approval claims",
        "NO specific interest rates without qualification",
        "Include 'Terms apply' if mentioning rates"
      ],
      "real_estate": [
        "NO guaranteed offer amounts",
        "USE 'estimate' not 'valuation'"
      ]
    }
  },
  "exampleOutput": {
    "extractedFields": [
      {
        "id": "field_1",
        "label": "Phone",
        "type": "tel",
        "required": true,
        "confidence": 0.97,
        "tiktokFieldId": "phone",
        "tiktokFieldType": "PHONE_NUMBER",
        "sourceSelector": "input[type='tel']"
      }
    ],
    "formBoundingBox": {"x": 680, "y": 240, "width": 480, "height": 520},
    "brandColors": {"name": "Sono Bello", "primaryColor": "#E91E63", "secondaryColor": "#FFFFFF"},
    "generatedCopy": {
      "originalHeadline": "Schedule Your Free Consultation",
      "tiktokHeadline": "Free Body Consult — Results in 30 Min",
      "originalCta": "Submit",
      "tiktokCta": "Claim My Spot",
      "benefits": ["See real patient results", "No commitment needed", "Limited spots this month"],
      "explanation": "Specific timeframe (30 min) adds credibility. First-person CTA creates ownership.",
      "disclaimerText": "Results may vary. Consultation required."
    }
  }
}
```

`/api/generate` reuses the `generatedCopy` sub-schema and compliance rules above; it is not part of the `/api/analyze` SLA path.

---

## 9. Async Loading & Race Handling

### Request Lifecycle

1. **Request ID Generation**: Client generates `requestId = 'req_' + uuid()` for every API call
2. **AbortController**: Each in-flight request has an associated `AbortController`
3. **Stale Response Protection**: Component tracks `latestRequestId`, ignores responses with mismatched IDs

### Cancel Flow

```typescript
// Client-side cancellation
const abortController = useRef<AbortController | null>(null);
const latestRequestId = useRef<string>('');

const startAnalysis = async (url: string) => {
  // Cancel any in-flight request
  if (abortController.current) {
    abortController.current.abort();
  }

  abortController.current = new AbortController();
  const requestId = `req_${uuid()}`;
  latestRequestId.current = requestId;

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url, requestId }),
      signal: abortController.current.signal
    });

    const data = await response.json();

    // Stale response check
    if (requestId !== latestRequestId.current) {
      console.log('Stale response ignored');
      return;
    }

    // Process response...
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Request cancelled');
      return;
    }
    throw error;
  }
};

const handleCancel = () => {
  if (abortController.current) {
    abortController.current.abort();
    abortController.current = null;
  }
  router.push('/');
};
```

### Loading States

| Action | Loading State | Disabled Elements |
|--------|---------------|-------------------|
| Initial analyze | `isAnalyzing: true` | URL input, demo buttons, submit |
| Tab switch | `isLoadingTab: true` | Tab buttons (briefly) |
| Regenerate copy | `isRegenerating: true` | Regenerate button, tone selector |
| Screenshot load | `isScreenshotLoading: true` | Zoom controls until loaded |

---

## 10. DOM Scraping Scope & Consent Handling

### Supported DOM Elements

```typescript
// Primary selectors (in order of priority)
const FIELD_SELECTORS = [
  'input[type="text"]:not([name*="search"]):not([placeholder*="search"])',
  'input[type="email"]',
  'input[type="tel"]',
  'input[type="number"]',
  'input[type="date"]',
  'select',
  'textarea',
  'input[type="checkbox"]',
  'input[type="radio"]'
];

// Ignored elements (consent, navigation, search)
const IGNORED_SELECTORS = [
  '[class*="cookie"]',
  '[class*="consent"]',
  '[class*="gdpr"]',
  '[class*="newsletter"]',
  '[type="search"]',
  '[name*="search"]',
  'nav input',
  'header input'
];
```

### Consent Banner Handling

```typescript
// Pre-scraping actions
await page.$$eval("button", buttons => {
  // Find and click accept/agree/ok button by text content
  const acceptBtn = buttons.find(b => /accept|agree|ok/i.test(b.innerText));
  if (acceptBtn) acceptBtn.click();
});

// Hide common banner elements
await page.evaluate(() => {
  const bannerSelectors = ['#cookie-banner', '.cookie-consent', '#gdpr-banner'];
  bannerSelectors.forEach(sel => {
    const el = document.querySelector(sel);
    if (el) el.remove();
  });
});
```

### Primary Form Selection Heuristic

```typescript
function selectPrimaryForm(forms: Element[]): Element | null {
  if (forms.length === 0) return null;
  if (forms.length === 1) return forms[0];

  const scored = forms.map(form => {
    const inputs = form.querySelectorAll('input, select, textarea').length;
    const isVisible = form.getBoundingClientRect().width > 0;
    const hasSubmit = !!form.querySelector('button[type="submit"], input[type="submit"]');
    const position = form.getBoundingClientRect().top;

    return {
      form,
      score: (inputs * 10) + (isVisible ? 50 : 0) + (hasSubmit ? 30 : 0) - (position * 0.01)
    };
  });

  scored.sort((a, b) => b.score - a.score);

  if (scored[0].score < 60) return null;
  if (scored.length >= 2 && (scored[0].score - scored[1].score) < 15) return null;

  return scored[0].form;
}
```

After scoring all forms, if `selectPrimaryForm` returns `null` because `scored[0].score < 60` or the top-two delta is `< 15`, the API returns `422 PRIMARY_FORM_UNCERTAIN`.

### iframe Handling

- **Limited support**: ContentDocument access is restricted by CORS
- **Strategy**: Log warning if forms detected in iframes, proceed with main document only
- **Documentation**: Update spec if client requires iframe form support (requires proxy/CDP approach)

---

## 11. Demo Script (Narration-to-UI Mapping)

### Opening (15 seconds)
> "Most advertisers lose 60% of their leads before the page even loads. I'm going to show you how TikTok Instant Forms fix that, and the full flow finishes in under 8 seconds end-to-end."

**UI Action**: Rep is on landing page (`/`).

---

### L1: Field Detection (20 seconds)
> "Here's Sono Bello's landing page. Six fields— name, email, phone, zip, location. Watch this."

**UI Action**: Rep clicks "Try Sono Bello" demo button.

> "The AI just read their page and mapped every field to TikTok's form system. Phone number maps to TikTok's phone field. ZIP code maps to ZIP. All automatically."

**UI Action**: Page navigates to `/analyze?url=...`, progress stages animate. On completion, auto-navigates to `/preview?aid=...` showing split-screen.

**Rep clicks**: "Field Detection" tab (already active by default).

---

### L2: AI Copy (20 seconds)
> "But we don't just copy the form— we make it work better on TikTok. Their headline was 'Schedule Your Free Consultation'— generic. Our AI rewrote it: 'Free Body Consultation — See Results in 30 Min'. Specific, benefit-driven, with urgency. CTA changed from 'Submit' to 'Claim My Free Spot'."

**UI Action**: Rep clicks "AI Copy" tab.

**UI Shows**: Original headline vs. TikTok headline side-by-side, explanation tooltip visible on hover.

---

### L3: Performance Reveal (25 seconds)
> "Here's the real killer. Their current page takes 5.2 seconds to load. On TikTok, that's an eternity— most users bounce. Our Instant Form loads in 0.8 seconds. That's not just faster— that's the difference between a 40% drop-off and a 12% drop-off."

**UI Action**: Rep clicks "Performance" tab.

**UI Shows**: Animated load time bars, drop-off percentages updating.

---

### Retargeting Bonus (20 seconds)
> "And here's what you can't do with any third-party form. When someone fills out their phone number but doesn't submit, TikTok knows. So we automatically create a retargeting audience of high-intent users— people who gave their phone but didn't finish. That's your highest-value lookalike seed."

**UI Action**: Rep scrolls down to "Unlock Retargeting" section, clicks "Simulate Drop-off Data" button.

**UI Navigates to**: `/bonus?aid=...`

> "This is SIMULATED DEMO DATA showing what's possible. 1,247 users started this form. Total abandonments were 412: phone had 847 starts with 312 abandonments, and zip had 600 starts with 100 abandonments. We turned the 312 phone abandonments into a retargeting audience because phone is the highest-drop-off field. Estimated CTR lift: 42%."

**UI Shows**: Dashboard with **"SIMULATED DEMO DATA" banner** prominently displayed. Field breakdown highlights `phone` as the highest-abandonment field at 312.

---

### Close (10 seconds)
> "One URL in. A fully configured, instant-loading, retargeting-enabled form out. That's TikTok 1P."

**UI Action**: Rep is on retargeting dashboard with simulated data banner visible.

---

## 12. Latency Budget & Timeouts

### End-to-End Budget: 8.0 seconds

| Step | Budget | Timeout | Action on Timeout |
|------|--------|---------|-------------------|
| Screenshot capture | 2.0s | 2.0s | AbortController cancels capture; continue without screenshot |
| Single LLM combined analysis call | 5.0s | 5.5s | Return 200 with simulated payload, `fallbackReason: "timeout"` |
| Response formatting | 0.5s | 1.0s | Return 503 with `fallbackAvailable: true` |
| Network overhead | 0.5s | — | — |
| **Total** | **8.0s** | **8.0s** | **Auto-fallback on timeout** |

**API Timeout Behavior:**
- **TIMEOUT (>8s)**: Server auto-returns HTTP 200 with `{ success: true, data: { ...simulatedPayload, isSimulatedData: true }, fallbackReason: "timeout" }`
- **TIMEOUT client behavior**: Client treats this as success, navigates to preview, and does **not** show a "Use Demo Data" button
- **ALL OTHER ERRORS** (scrape fail, LLM error, KV error, no form): Server returns HTTP 422/503 with `{ success: false, error: { code, message }, fallbackAvailable: true }`
- **422/503 client behavior**: Client stays on the error state and shows a **"Use Demo Data"** button

If screenshot capture has not returned within 2.0s, `AbortController` cancels it; analysis continues without screenshot (`screenshot.status="failed"`).

### UI Messaging by Timing

| Elapsed | Message | UI State |
|---------|---------|----------|
| 0-2s | "Scraping page..." | Progress indicator active |
| 2-7s | "Analyzing with AI..." | Progress indicator active |
| 7-8s | "Finalizing..." | Progress indicator active |
| 6s | — | Show "Still working..." message |
| >8s timeout | — | Auto-fallback to simulated success payload; no button shown |
| Any 422/503 error | "Live analysis unavailable" | Show "Use Demo Data" button |

**Acceptance:** Test fixture must complete in <8s wall clock time.

---

## 13. CSP & CORS Policy

### Content Security Policy

```javascript
// next.config.js
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.googleusercontent.com;
  font-src 'self';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: cspHeader.replace(/\n/g, ' ') }
        ]
      }
    ];
  }
};
```

### CORS (API Routes)

```typescript
// All API routes are same-origin only
// For Vercel preview deployments, use https://${process.env.VERCEL_URL}
// For local development, use http://localhost:3000
export const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
```

---

## 14. Rate Limiting Specification

### Endpoints

| Endpoint | Limit | Window | Storage |
|----------|-------|--------|---------|
| POST /api/analyze | 10 req | 60s | Vercel KV: `ratelimit:{ip}` |
| GET /api/analyze | No limit | — | Vercel KV: `analysis:{id}` |
| POST /api/generate | 10 req | 60s | Vercel KV: `ratelimit:{ip}` |
| GET /api/screenshot | No limit | — | — (cached asset) |

### Headers (all responses)

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1711302600
```

### Rate Limit Response (429)

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retryable": true
  },
  "requestId": "req_abc123",
  "timestamp": "2024-03-24T18:30:00Z"
}
```

### Demo Bypass

- `FORCE_DEMO_MODE=true` bypasses rate limiting
- IPs in `RATE_LIMIT_EXEMPT_IPS` bypass rate limiting
- UI shows "Demo Mode" badge when bypass active

---

## 15. Acceptance Criteria

### A. Deterministic Fixture Tests (Must Pass)

These tests use pre-cached demo data and MUST pass deterministically.

| # | Test | Fixture | Expected Result | Verification |
|---|------|---------|-----------------|--------------|
| A1 | URL validation accepts https://opendoor.com | — | No inline error | Assert: error state null |
| A2 | Demo button "Try Opendoor" prefills URL | — | Input value = "https://www.opendoor.com" | Assert: input.value === expected |
| A3 | Demo button navigates to /analyze | Click "Try Opendoor" | URL contains /analyze?url= | Assert: router.pathname === '/analyze' |
| A4 | Progress stages render in order | — | Stages: ["Scraping page...", "Analyzing with AI...", "Finalizing..."] | Assert: stages.length === 3 |
| A5 | Cancel button returns to home | Click Cancel | URL = / | Assert: router.pathname === '/' |
| A6 | KV stores analysis with TTL | Post /api/analyze (fixture mode) | KV key exists: `analysis:{id}` | Assert: await kv.get(key) !== null |
| A6b | Preview hydration returns stored payload | POST /api/analyze (fixture mode), then GET /api/analyze?aid={id} | GET response `data` deeply equals KV record at `analysis:{id}` | Assert: deepEqual(json.data, await kv.get(key)) |
| A7 | KV screenshot retrieval | GET /api/screenshot?id={validId} | Content-Type: image/png | Assert: response.headers.get('content-type') === 'image/png' |
| A8 | Simulated data banner displays | Render FormPreview with isSimulatedData=true | Text "SIMULATED DEMO DATA" visible | Assert: screen.getByText('SIMULATED DEMO DATA') |
| A9 | Field confidence badge green | Field with confidence=0.98 | CSS class contains 'bg-green' | Assert: element.classList.contains('bg-green-500') |
| A10 | Field confidence badge yellow | Field with confidence=0.85 | CSS class contains 'bg-yellow' | Assert: element.classList.contains('bg-yellow-500') |
| A11 | Field confidence badge red | Field with confidence=0.75 | CSS class contains 'bg-red' | Assert: element.classList.contains('bg-red-500') |
| A12 | Retargeting shows 1,247 / 412 / 312 / 100 | Render RetargetPanel with fixture data | Text "1,247", "412", "312", and "100" visible | Assert: screen.getByText('1,247') && screen.getByText('412') && screen.getByText('312') && screen.getByText('100') |
| A12b | Screenshot failure shows placeholder | Render LandingPreview with screenshot.status="failed" | Placeholder image and warning text "Screenshot unavailable — showing placeholder" visible | Assert: screen.getByText(/screenshot unavailable/i) |
| A13 | Error response has required fields | POST /api/analyze with invalid URL | Response has success, error.code, error.message, error.retryable | Assert: json.error.code && json.error.retryable !== undefined |
| A13b | API envelope has required fields | POST /api/analyze (fixture mode) | Response has success, data, requestId, latencyMs | Assert: json.success && json.data && json.requestId && json.latencyMs !== undefined |
| A13c | GeneratedCopy has benefits array | POST /api/analyze (fixture mode) | Response data.generatedCopy.benefits is array with >= 2 items | Assert: Array.isArray(json.data.generatedCopy.benefits) |
| A13d | Timeout fallback is seamless | POST /api/analyze with forced >8s timeout | HTTP 200, `data.isSimulatedData === true`, `fallbackReason === "timeout"` | Assert: response.status === 200 && json.fallbackReason === 'timeout' |
| A13e | Operational failures expose demo fallback | POST /api/analyze with forced scraper or LLM failure | HTTP 422/503 and `fallbackAvailable === true` | Assert: [422, 503].includes(response.status) && json.fallbackAvailable === true |
| A13f | Disclaimer text renders below CTA | Render FormPreview with non-empty `copy.disclaimerText` | `<p data-testid="disclaimer">` appears below CTA with exact disclaimer text | Assert: screen.getByTestId('disclaimer').textContent === 'Results may vary. Consultation required.' |
| A13g | Optional logoUrl hides logo slot | Render FormPreview with `brandColors.logoUrl === undefined` | Logo slot is not rendered | Assert: screen.queryByTestId('brand-logo') === null |
| A13h | PRIMARY_FORM_UNCERTAIN threshold fires | Given two forms with scores 55 and 48, POST /api/analyze returns 422 `{error:{code:"PRIMARY_FORM_UNCERTAIN"}}` | 422 returned with exact error code | Assert: response.status === 422 && json.error.code === 'PRIMARY_FORM_UNCERTAIN' |
| A14 | Rate limit headers present | POST /api/analyze | Headers: X-RateLimit-Limit, X-RateLimit-Remaining | Assert: headers.has('X-RateLimit-Limit') |
| A15 | AbortController cancels request | Call abort() on in-flight request | fetch throws AbortError | Assert: error.name === 'AbortError' |

### B. Best-Effort Live Smoke Tests (Should Pass)

These tests make live external calls and may fail due to third-party changes. A failure is informational, not blocking.

| # | Test | Live Target | Pass Condition | Notes |
|---|------|-------------|----------------|-------|
| B1 | Live screenshot of Opendoor | https://www.opendoor.com | Response 200, Content-Type: image/png | May 403 due to bot detection—expected, not a bug |
| B2 | Live screenshot of Sono Bello | https://www.sonobello.com/consultation/ | Response 200, Content-Type: image/png | May 403—expected |
| B3 | Live field extraction from Opendoor | https://www.opendoor.com | Response contains >= 2 fields | May fail if site redesigns |
| B4 | Live field extraction from Sono Bello | https://www.sonobello.com/consultation/ | Response contains >= 4 fields | May fail if site redesigns |
| B5 | Live copy generation | Gemini API | Response time < 3000ms, valid JSON schema | May fail if API throttled |
| B6 | End-to-end latency < 8s | Full flow | Wall clock from submit to preview < 8000ms | Network dependent |

### C. UI Interaction Tests

**Field Editing Rules (MAJOR 1):**
- Editable fields: `label` (max 50 chars, no empty), `placeholder`, `required` (boolean)
- Immutable fields: `tiktokFieldType`, `confidence`, `id`, `sourceSelector`
- Validation: Label max 50 characters, cannot be empty
- Persistence: Edits persist only in client React state (NOT KV storage)
- After Save: FieldMapper re-renders, FormPreview re-renders
- After Cancel: Field state reverts to original values

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| C1 | Tab switching works | Click "AI Copy" tab | Active tab = "AI Copy", content visible |
| C2 | Field edit modal opens | Click "Edit" on field | Modal visible with field data pre-filled |
| C3 | Field edit saves | Change label, click Save | Modal closes, field updated in list, FormPreview re-renders |
| C4 | Field edit cancels | Change label, click Cancel | Modal closes, field unchanged |
| C5 | Field edit validation | Clear label, click Save | Error "Label is required" displayed, field not saved |
| C6 | Field edit max length | Enter 60 char label, click Save | Error "Label max 50 characters" displayed |
| C7 | Regenerate copy | Click "Regenerate", select tone | New copy displayed, loading state during fetch |
| C8 | Zoom screenshot | Click 1.5x zoom | Screenshot scales to 1.5x |

---

## 16. Known Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Scraping blocked by target site** | High | High | Return 422/503 with `fallbackAvailable: true`; client shows "Use Demo Data" button; on click, load pre-cached Opendoor/Sono Bello data with "SIMULATED DEMO DATA" banner |
| **JS-rendered pages fail to load** | Medium | High | Chromium waits for networkidle2; 5s navigation timeout; fallback to error response with `fallbackAvailable: true` |
| **LLM hallucinates fields** | Medium | Medium | Confidence threshold filtering (<80% flagged); human-in-the-loop field verification UI; structured output schema validation |
| **LLM response timeout** | Low | Medium | Single combined LLM call capped at 5s; if the overall `/api/analyze` path exceeds 8.0s, auto-return simulated data with `fallbackReason: "timeout"` |
| **Vertex AI quota exceeded** | Low | High | Vercel KV with 5-min TTL; rate limiting (10 req/min per IP); graceful degradation to cached/demo responses |
| **Screenshot capture fails** | Medium | Medium | Abort after 2.0s with `AbortController`; continue analysis with `screenshot.status="failed"` and render placeholder in preview |
| **Brand color extraction fails** | Medium | Low | Default to TikTok brand colors (#FE2C55, #25F4EE) |
| **Vercel serverless timeout** | Medium | High | maxDuration=60s; 8s end-to-end latency budget; sync full-payload response; KV-backed page hydration |
| **Sensitive data in forms** | Low | High | No data persistence beyond 5-min KV TTL; URL query params sanitized; no PII logging |
| **Compliance violation in generated copy** | Low | High | Hard compliance rules in prompt; post-generation validation; fallback to template copy on violation |

### Fallback Strategy

**Two distinct fallback paths based on failure type:**

1. **TIMEOUT (>8s) — Automatic:**
   - Server auto-returns 200 with `{ success: true, data: { ...simulatedPayload, isSimulatedData: true }, fallbackReason: "timeout" }`
   - No error shown to user; seamless experience with "SIMULATED DEMO DATA" banner
   - Client treats as successful response

2. **ALL OTHER ERRORS (scrape block, LLM fail, etc.) — User-triggered:**
   - Server returns 422/503 with `{ success: false, error: { code, message }, fallbackAvailable: true }`
   - Client shows error message + "Use Demo Data" button
   - User clicks button to load pre-cached Opendoor/Sono Bello data
   - UI shows "SIMULATED DEMO DATA" banner

**Fallback Data Selection:**
- For medical/aesthetic-looking URLs (contains "consultation", "clinic", "med", "aesthetic"): Use Sono Bello fixture
- For real-estate-looking URLs (contains "home", "house", "property", "sell"): Use Opendoor fixture
- All others: Default to Sono Bello fixture

---

## Appendix A: Demo Data (Canonical Fixtures)

Each fixture must keep `totalFormStarts: 1247` and `totalAbandonments: 412`, but field-level retargeting data MUST match the extracted fields present in that specific fixture.

### Opendoor Fallback

```json
{
  "analysisId": "aid_opendoor_fixture",
  "landingPageUrl": "https://www.opendoor.com",
  "screenshot": {
    "status": "ok",
    "url": "/api/screenshot?id=aid_opendoor_fixture"
  },
  "isSimulatedData": true,
  "createdAt": "2024-03-24T18:30:00Z",
  "brandColors": {
    "name": "Opendoor",
    "primaryColor": "#0B4F99",
    "secondaryColor": "#FFFFFF"
  },
  "extractedFields": [
    {
      "id": "field_1",
      "label": "Street Address",
      "type": "text",
      "required": true,
      "confidence": 0.99,
      "tiktokFieldId": "street_address",
      "tiktokFieldType": "CUSTOM",
      "sourceSelector": "input[name='address']"
    },
    {
      "id": "field_2",
      "label": "Email",
      "type": "email",
      "required": true,
      "confidence": 0.98,
      "tiktokFieldId": "email",
      "tiktokFieldType": "EMAIL",
      "sourceSelector": "input[type='email']"
    },
    {
      "id": "field_3",
      "label": "ZIP Code",
      "type": "zip",
      "placeholder": "Enter ZIP",
      "required": true,
      "confidence": 0.97,
      "tiktokFieldId": "zip_code",
      "tiktokFieldType": "ZIP_POST_CODE",
      "sourceSelector": "input[name='zip']"
    }
  ],
  "formBoundingBox": {
    "x": 600,
    "y": 200,
    "width": 400,
    "height": 300
  },
  "generatedCopy": {
    "originalHeadline": "Get a competitive cash offer",
    "tiktokHeadline": "See Your Home's Value in 24 Hours",
    "originalCta": "Get my offer",
    "tiktokCta": "Get My Free Estimate",
    "benefits": [
      "No repairs needed",
      "Close on your timeline",
      "No showings or open houses"
    ],
    "explanation": "Specific timeframe (24 hours) creates urgency. First-person CTA increases ownership."
  },
  "performance": {
    "estimated3pLoadTime": 4.8,
    "estimated1pLoadTime": 0.8,
    "dropOff3p": 0.38,
    "dropOff1p": 0.12,
    "estimatedDropOffReduction": 0.26
  },
  "retargeting": {
    "totalFormStarts": 1247,
    "totalAbandonments": 412,
    "fieldBreakdown": {
      "phone": {"started": 0, "abandoned": 0},
      "zip": {"started": 847, "abandoned": 312},
      "email": {"started": 400, "abandoned": 100}
    },
    "estimatedCtrLift": 0.38
  }
}
```

### Sono Bello Fallback

```json
{
  "analysisId": "aid_sonobello_fixture",
  "landingPageUrl": "https://www.sonobello.com/consultation/",
  "screenshot": {
    "status": "ok",
    "url": "/api/screenshot?id=aid_sonobello_fixture"
  },
  "isSimulatedData": true,
  "createdAt": "2024-03-24T18:30:00Z",
  "brandColors": {
    "name": "Sono Bello",
    "primaryColor": "#E91E63",
    "secondaryColor": "#FFFFFF"
  },
  "extractedFields": [
    {
      "id": "field_1",
      "label": "First Name",
      "type": "text",
      "required": true,
      "confidence": 0.98,
      "tiktokFieldId": "first_name",
      "tiktokFieldType": "FULL_NAME",
      "sourceSelector": "input[name='firstName']"
    },
    {
      "id": "field_2",
      "label": "Last Name",
      "type": "text",
      "required": true,
      "confidence": 0.98,
      "tiktokFieldId": "last_name",
      "tiktokFieldType": "FULL_NAME",
      "sourceSelector": "input[name='lastName']"
    },
    {
      "id": "field_3",
      "label": "Email",
      "type": "email",
      "required": true,
      "confidence": 0.99,
      "tiktokFieldId": "email",
      "tiktokFieldType": "EMAIL",
      "sourceSelector": "input[type='email']"
    },
    {
      "id": "field_4",
      "label": "Phone",
      "type": "tel",
      "required": true,
      "confidence": 0.97,
      "tiktokFieldId": "phone",
      "tiktokFieldType": "PHONE_NUMBER",
      "sourceSelector": "input[type='tel']"
    },
    {
      "id": "field_5",
      "label": "ZIP Code",
      "type": "zip",
      "required": true,
      "confidence": 0.95,
      "tiktokFieldId": "zip_code",
      "tiktokFieldType": "ZIP_POST_CODE",
      "sourceSelector": "input[name='zip']"
    },
    {
      "id": "field_6",
      "label": "Preferred Location",
      "type": "dropdown",
      "required": false,
      "confidence": 0.88,
      "tiktokFieldId": "custom_location",
      "tiktokFieldType": "CUSTOM",
      "sourceSelector": "select[name='location']"
    }
  ],
  "formBoundingBox": {
    "x": 680,
    "y": 240,
    "width": 480,
    "height": 520
  },
  "generatedCopy": {
    "originalHeadline": "Schedule Your Free Consultation",
    "tiktokHeadline": "Free Body Consult — Results in 30 Min",
    "originalCta": "Submit",
    "tiktokCta": "Claim My Free Spot",
    "benefits": [
      "See before & after results from real patients",
      "No commitment required",
      "Limited appointments this month"
    ],
    "explanation": "Specific timeframe (30 min) adds credibility. Changed generic 'Submit' to value-driven CTA with ownership language.",
    "disclaimerText": "Results may vary. Consultation required."
  },
  "performance": {
    "estimated3pLoadTime": 5.2,
    "estimated1pLoadTime": 0.8,
    "dropOff3p": 0.40,
    "dropOff1p": 0.12,
    "estimatedDropOffReduction": 0.28
  },
  "retargeting": {
    "totalFormStarts": 1247,
    "totalAbandonments": 412,
    "fieldBreakdown": {
      "phone": {"started": 847, "abandoned": 312},
      "zip": {"started": 600, "abandoned": 100}
    },
    "estimatedCtrLift": 0.42
  }
}
```
