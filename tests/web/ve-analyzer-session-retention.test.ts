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
    const channel = { id: 'rpm' } as LoggerAnalysisContext['channels'][number];
    const previous = context([channel], {
      aTimeMs: 100,
      bTimeMs: 200,
      savedRanges: [{ label: 'Pull', startMs: 100, endMs: 200 }],
    });
    const next = context([channel], {
      aTimeMs: 100,
      bTimeMs: 200,
      savedRanges: [{ label: 'Pull', startMs: 100, endMs: 200 }],
    });

    expect(sameVeAnalysisContext(previous, next)).toBe(true);
  });

  it('accepts a fresh channels array when it contains the same source objects', () => {
    const channel = { id: 'rpm' } as LoggerAnalysisContext['channels'][number];
    expect(sameVeAnalysisContext(context([channel]), context([channel]))).toBe(true);
  });

  it('invalidates retention when the Logger source channel objects change', () => {
    const previousChannel = { id: 'rpm' } as LoggerAnalysisContext['channels'][number];
    const nextChannel = { id: 'rpm' } as LoggerAnalysisContext['channels'][number];
    expect(sameVeAnalysisContext(context([previousChannel]), context([nextChannel]))).toBe(false);
  });

  it('does not treat two unrelated empty catalogs as the same source', () => {
    expect(sameVeAnalysisContext(context([]), context([]))).toBe(false);
  });

  it('invalidates retention when A/B analysis scope changes', () => {
    const channel = { id: 'rpm' } as LoggerAnalysisContext['channels'][number];
    expect(sameVeAnalysisContext(
      context([channel], { aTimeMs: 100, bTimeMs: 200 }),
      context([channel], { aTimeMs: 110, bTimeMs: 210 }),
    )).toBe(false);
  });
});
