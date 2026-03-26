# Multi-step Navigator + E2E Test

## Goal
Make live scraping actually work for Sono Bello and Opendoor.
Both are modern SPAs - Sono Bello needs CTA click-through, Opendoor needs anti-bot bypass.

## Task 1: Anti-bot improvements in analyze-page.ts
- Use a realistic modern user-agent (Chrome 120+)
- Set realistic viewport (1440x900)
- Add random 500-1500ms delays between navigation steps
- Handle cookie consent banners (click "Accept" or dismiss)
- Disable webdriver detection flags in puppeteer launch args

## Task 2: Multi-step journey navigation
Add `navigateMultiStepJourney(page, startUrl, signal, budgetMs)` function:
1. Navigate to startUrl, wait for networkidle2
2. Screenshot + extract fields from current page (step 1)
3. Find CTA button: look for buttons/links with text matching: "Get Started", "Book Now", "Free Consultation", "Get a Cash Offer", "Continue", "Next", "Submit", "Check Eligibility"
4. If CTA found: click it, wait for navigation (timeout 5s), screenshot + extract fields (step 2)
5. Repeat up to 4 steps total OR until a real form with ≥2 fields is found
6. Return array of JourneyStep objects

## Task 3: Update analyzePage() to use multi-step navigator
Replace the current single-page scrape with navigateMultiStepJourney().
Set the main extracted fields from the step that has the most/best fields.

## Task 4: E2E test script
Create `scripts/e2e-test.ts`:
```
const PRODUCTION_URL = 'https://tiktok-1p-demo-app.vercel.app'
Test cases:
1. POST /api/analyze with url=https://www.sonobello.com/consultation/
   → expect success:true, isSimulatedData:false, extractedFields.length >= 1, screenshot.status === 'ok'
2. POST /api/analyze with url=https://www.opendoor.com
   → expect success:true, isSimulatedData:false, extractedFields.length >= 1
Run with: npx tsx scripts/e2e-test.ts
```

## Acceptance criteria
- [ ] npm run build passes
- [ ] npx tsx scripts/e2e-test.ts passes both test cases
- [ ] Sono Bello: success:true, fields≥1, isSimulatedData:false
- [ ] Opendoor: success:true, fields≥1
