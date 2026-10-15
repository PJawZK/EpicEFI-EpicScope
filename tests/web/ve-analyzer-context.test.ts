import { describe, expect, it } from 'vitest';
import { sameVeSourceContext } from '../../apps/web/src/pages/ve-analyzer-view-v2';
import type { LoggerAnalysisContext } from '../../apps/web/src/pages/logger-page';

function context(): LoggerAnalysisContext {
  return {
    source: { identity: {}, sampleCount: 100, revision: 0 },
    traces: [], channels: [{ id: 'rpm', sourceName: 'RPM', displayName: 'RPM', valueType: 'number', unit: 'rpm' }],
    loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [],
  };
}

describe('VE source context identity', () => {
  it('ignores refreshed navigation callbacks and equivalent catalog objects', () => {
    const left = context();
    expect(sameVeSourceContext(left, {
      ...left, channels: left.channels.map((channel) => ({ ...channel })),
      loadTraces: async () => [], openSamplesInLogger: () => {},
      aTimeMs: 10, bTimeMs: 20, savedRanges: [{ label: 'new range', startMs: 10, endMs: 20 }],
    })).toBe(true);
  });

  it('detects another source with identical catalog and sample count', () => {
    const left = context();
    expect(sameVeSourceContext(left, { ...left, source: { ...left.source!, identity: {} } })).toBe(false);
  });

  it.each(['sampleCount', 'revision'] as const)('detects a source %s change', (key) => {
    const left = context();
    expect(sameVeSourceContext(left, { ...left, source: { ...left.source!, [key]: left.source![key] + 1 } })).toBe(false);
  });

  it('detects catalog changes that affect role or mixture interpretation', () => {
    const left = context();
    expect(sameVeSourceContext(left, { ...left, channels: [{ ...left.channels[0]!, unit: '%' }] })).toBe(false);
    expect(sameVeSourceContext(left, { ...left, channels: [] })).toBe(false);
  });

  it('conservatively uses the loader identity for callers without source metadata', () => {
    const { source: _source, ...left } = context();
    expect(sameVeSourceContext(left, { ...left })).toBe(true);
    expect(sameVeSourceContext(left, { ...left, loadTraces: async () => [] })).toBe(false);
  });
});
