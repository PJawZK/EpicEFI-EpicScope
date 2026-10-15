import { describe, expect, it } from 'vitest';
import { sameVeAnalyzerSession } from '../../apps/web/src/pages/ve-analyzer-session-continuity';
import type { LoggerAnalysisContext } from '../../apps/web/src/pages/logger-page';

function context(
  channels: LoggerAnalysisContext['channels'],
  aTimeMs?: number,
): LoggerAnalysisContext {
  return {
    traces: [],
    channels,
    loadTraces: async () => [],
    aTimeMs,
    bTimeMs: undefined,
    savedRanges: [],
  };
}

describe('VE Analyzer same-source session continuity', () => {
  it('preserves a Logger round trip when the cached source catalog is identical', () => {
    const channels: LoggerAnalysisContext['channels'] = [];
    expect(sameVeAnalyzerSession(context(channels), context(channels))).toBe(true);
  });

  it('does not confuse a different source with an identical channel shape', () => {
    const first: LoggerAnalysisContext['channels'] = [];
    const second: LoggerAnalysisContext['channels'] = [];
    expect(sameVeAnalyzerSession(context(first), context(second))).toBe(false);
  });

  it('invalidates when A/B analysis authority changes', () => {
    const channels: LoggerAnalysisContext['channels'] = [];
    expect(sameVeAnalyzerSession(context(channels), context(channels, 1000))).toBe(false);
  });
});
