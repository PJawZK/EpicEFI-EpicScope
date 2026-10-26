import { describe, expect, it } from 'vitest';
import { analyzerScopeOptions, analyzerScopeBounds, retainedAnalyzerScopeValue } from '../../apps/web/src/pages/analyzer-scope';
import type { LoggerAnalysisContext } from '../../apps/web/src/pages/logger-page';
const alpha = { label: 'Alpha', startMs: 10, endMs: 20 };
const beta = { label: 'Beta', startMs: 30, endMs: 40 };
const context = (savedRanges: LoggerAnalysisContext['savedRanges'], aTimeMs = 0, bTimeMs = 50): LoggerAnalysisContext => ({
  traces: [], channels: [], loadTraces: async () => [], aTimeMs, bTimeMs, savedRanges,
});
describe('Logger range projection and retained VE selection', () => {
  it('keeps Full Log unbounded instead of inventing source timestamps', () => {
    expect(analyzerScopeOptions(context([]))[0]).toEqual({ value: 'full', kind: 'full', label: 'Full Log' });
    expect(analyzerScopeBounds(analyzerScopeOptions(context([]))[0]!)).toEqual({});
  });
  it('normalizes reversed ranges without changing Logger data', () => {
    const c = context([{ ...alpha, startMs: 20, endMs: 10 }], 50, 0);
    const options = analyzerScopeOptions(c);
    expect(analyzerScopeBounds(options[1]!)).toEqual({ startMs: 0, endMs: 50 });
    expect(analyzerScopeBounds(options[2]!)).toEqual({ startMs: 10, endMs: 20 });
    expect(c.savedRanges[0]!.startMs).toBe(20);
  });
  it('filters nonfinite and empty ranges without reindexing saved identities', () => {
    expect(analyzerScopeOptions(context([{ ...alpha, endMs: NaN }, beta, { ...alpha, endMs: 10 }], Infinity, 0)).map(o => o.value)).toEqual(['full', 'saved:1']);
  });
  it('retains bounds and label across saved-range reordering', () => {
    expect(retainedAnalyzerScopeValue('saved:1', context([alpha, beta]), context([beta, alpha]))).toBe('saved:0');
  });
  it('retains an unambiguous rename at identical bounds', () => {
    expect(retainedAnalyzerScopeValue('saved:0', context([alpha]), context([{ ...alpha, label: 'Renamed' }]))).toBe('saved:0');
  });
  it('falls back to Full when a selected saved range is removed or edited', () => {
    expect(retainedAnalyzerScopeValue('saved:1', context([alpha, beta]), context([alpha]))).toBe('full');
    expect(retainedAnalyzerScopeValue('saved:0', context([alpha]), context([{ ...alpha, endMs: 25 }]))).toBe('full');
  });
  it('does not guess among ambiguous renamed ranges', () => {
    expect(retainedAnalyzerScopeValue('saved:0', context([alpha]), context([{ ...alpha, label: 'X' }, { ...alpha, label: 'Y' }]))).toBe('full');
  });
  it('preserves Full/A-B keys and rejects unavailable saved identities', () => {
    expect(retainedAnalyzerScopeValue('ab', context([]), context([]))).toBe('ab');
    expect(retainedAnalyzerScopeValue('full', context([]), context([]))).toBe('full');
    expect(retainedAnalyzerScopeValue('saved:9', context([]), context([]))).toBe('full');
  });
});
