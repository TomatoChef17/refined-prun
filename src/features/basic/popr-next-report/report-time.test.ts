import { describe, expect, it } from 'vitest';
import { REPORT_PERIOD_MS, getNextReport, parseReportAge } from './report-time';

const H = 60 * 60 * 1000;
const D = 24 * H;

describe('parseReportAge', () => {
  it('reads days and hours', () => {
    expect(parseReportAge('Report #149 / 3 days 17h ago')).toEqual({
      ms: 3 * D + 17 * H,
      precisionMs: H,
    });
  });

  it('reads one day', () => {
    expect(parseReportAge('Report #111 / 1 day 2h ago')).toEqual({ ms: D + 2 * H, precisionMs: H });
  });

  it('reads hours and minutes', () => {
    expect(parseReportAge('Report #12 / 20h 42m ago')).toEqual({
      ms: 20 * H + 42 * 60000,
      precisionMs: 60000,
    });
  });

  it('ignores other text', () => {
    expect(parseReportAge('Population')).toBeUndefined();
  });
});

describe('getNextReport', () => {
  it('adds one week to a recent report', () => {
    expect(getNextReport(1000, 1000 + 3 * D)).toBe(1000 + REPORT_PERIOD_MS);
  });

  it('skips past weeks for an old report', () => {
    expect(getNextReport(1000, 1000 + 10 * D)).toBe(1000 + 2 * REPORT_PERIOD_MS);
  });
});
