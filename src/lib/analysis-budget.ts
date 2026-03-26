export const ANALYZE_ROUTE_TIMEOUT_MS = 12000;
export const ANALYSIS_INTERNAL_DEADLINE_MS = 10500;
export const ANALYSIS_GEMINI_BUDGET_MS = 1000;
export const ANALYSIS_SCRAPE_BUDGET_MS =
  ANALYSIS_INTERNAL_DEADLINE_MS - ANALYSIS_GEMINI_BUDGET_MS;

export function createAnalysisDeadline(startedAt = Date.now()) {
  return startedAt + ANALYSIS_INTERNAL_DEADLINE_MS;
}

export function getRemainingAnalysisBudget(deadlineMs: number, bufferMs = 0) {
  return deadlineMs - Date.now() - bufferMs;
}
