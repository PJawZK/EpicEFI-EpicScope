import { describe, expect, it } from 'vitest';
import type { LoggerAnalysisContext } from '../../apps/web/src/pages/logger-page';
import {
  sameAnalyzerChannelCatalog,
  sameVeAnalysisContext,
} from '../../apps/web/src/pages/ve-analyzer-session-identity';

const channel = { id: 'ini:RPMValue' } as LoggerAnalysisContext['channels'][number];

function context(overrides: Partial<LoggerAnalysisContext> = {}): LoggerAnalysisContext {
  return {
    traces: [],
    channels: [channel],
    loadTraces: async () => [],
    aTimeMs: undefined,
    bTimeMs: undefined,
    sourceSampleCount: 100,
    savedRanges: [],
    ...overrides,
  };
}

describe('VE Analyzer session identity', () => {
  it('treats equivalent Logger context snapshots as the same VE session', () => {
    const left = context({ savedRanges: [{ label: 'Pull', startMs: 100, endMs: 200 }] });
    const right = context({ savedRanges: [{ label: 'Pull', startMs: 100, endMs: 200 }] });

    expect(sameVeAnalysisContext(left, right)).toBe(true);
    expect(sameVeAnalysisContext(
      context({ sourceSampleCount: undefined }),
      context({ sourceSampleCount: undefined }),
    )).toBe(true);
  });

  it('invalidates when a growing source exposes a different sample count', () => {
    expect(sameVeAnalysisContext(context({ sourceSampleCount: 100 }), context({ sourceSampleCount: 101 }))).toBe(false);
  });

  it('invalidates when analysis scope markers or saved ranges change', () => {
    expect(sameVeAnalysisContext(context({ aTimeMs: 10, bTimeMs: 20 }), context({ aTimeMs: 10, bTimeMs: 21 }))).toBe(false);
    expect(sameVeAnalysisContext(
      context({ savedRanges: [{ label: 'Pull', startMs: 100, endMs: 200 }] }),
      context({ savedRanges: [{ label: 'Pull', startMs: 100, endMs: 201 }] }),
    )).toBe(false);
  });

  it('uses channel object identity so a rebound source/catalog invalidates even when names match', () => {
    const replacement = { id: 'ini:RPMValue' } as LoggerAnalysisContext['channels'][number];

    expect(sameAnalyzerChannelCatalog([channel], [channel])).toBe(true);
    expect(sameAnalyzerChannelCatalog([channel], [replacement])).toBe(false);
    expect(sameVeAnalysisContext(context(), context({ channels: [replacement] }))).toBe(false);
  });
});
