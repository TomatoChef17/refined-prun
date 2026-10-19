export const REPORT_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

const UNIT_MS: Record<string, number> = {
  d: 24 * 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  m: 60 * 1000,
  s: 1000,
};

export interface ReportAge {
  // Age of the report, rounded down by the game to the smallest unit shown.
  ms: number;
  // Size of the smallest unit shown: the real age is up to this much larger.
  precisionMs: number;
}

// Reads the age in "Report #149 / 3 days 17h ago".
export function parseReportAge(text: string): ReportAge | undefined {
  const match = /#\s*\d+\s*\/\s*(.+?)\s+ago/i.exec(text);
  if (!match) {
    return undefined;
  }
  const parts = match[1].matchAll(
    /(\d+)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/gi,
  );
  let ms = 0;
  let precisionMs = 0;
  let found = false;
  for (const [, amount, unit] of parts) {
    const unitMs = UNIT_MS[unit[0].toLowerCase()];
    ms += Number(amount) * unitMs;
    precisionMs = precisionMs === 0 ? unitMs : Math.min(precisionMs, unitMs);
    found = true;
  }
  return found ? { ms, precisionMs } : undefined;
}

// The first report time after now, for a planet that reported at the given time.
export function getNextReport(lastReport: number, now: number) {
  if (lastReport > now) {
    return lastReport;
  }
  const periods = Math.floor((now - lastReport) / REPORT_PERIOD_MS) + 1;
  return lastReport + periods * REPORT_PERIOD_MS;
}
