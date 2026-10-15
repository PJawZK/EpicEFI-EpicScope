import { describe, expect, it } from 'vitest';
import type { LoggerAnalysisContext } from '../../apps/web/src/pages/logger-page';
import { sameVeAnalysisContext } from '../../apps/web/src/pages/ve-analyzer-session-retention';

function context(
  channels: LoggerAnalysisContext['channels'],
  overrides: Partial<Pick<LoggerAnalysisContext, 'aTimeMs' | 'bTimeMs' | 'savedRanges'>> = {},
): LoggerAnalysisContext {
  return {
    traces: [],
    channels,
    loadTraces: async () => [],
    aTimeMs: overrides.aTimeMs,
    bTimeMs: overrides.bTimeMs,
    savedRanges: overrides.savedRanges ?? [],
  };
}

describe('VE Analyzer session retention boundary', () => {
  it('recognizes a same-source Logger round trip with unchanged scope state', () => {
    const channels: LoggerAnalysisContext['channels'] = [];
    const previous = context(channels, {
      aTimeMs: 100,
      bTimeMs: 200,
      savedRanges: [{ label: 'Pull', startMs: 100, endMs: 200 }],
    });
    const next = context(channels, {
      aTimeMs: 100,
      bTimeMs: 200,
      savedRanges: [{ label: 'Pull', startMs: 100, endMs: 200 }],
    });

    expect(sameVeAnalysisContext(previous, next)).toBe(true);
  });

  it('invalidates retention when the Logger source identity changes', () => {
    expect(sameVeAnalysisContext(context([]), context([]))).toBe(false);
  });

  it('invalidates retention when A/B analysis scope changes', () => {
    const channels: LoggerAnalysisContext['channels'] = [];
    expect(sameVeAnalysisContext(
      context(channels, { aTimeMs: 100, bTimeMs: 200 }),
      context(channels, { aTimeMs: 110, bTimeMs: 210 }),
    )).toBe(false);
  });
});
