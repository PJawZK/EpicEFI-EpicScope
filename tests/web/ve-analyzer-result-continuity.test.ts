import { describe, expect, it } from 'vitest';
import {
  sameVeAnalysisContext,
  veMetricsWithCanonicalCurrent,
} from '../../apps/web/src/pages/ve-analyzer-result-continuity';
import { veResultDisplay, type VeRenderedCellMetrics } from '../../apps/web/src/pages/ve-analyzer-result-view';
import type { LoggerAnalysisContext } from '../../apps/web/src/pages/logger-page';

const baseMetrics: VeRenderedCellMetrics = {
  state: 'weak-evidence',
  current: undefined,
  proposed: undefined,
  evidenceCandidate: 55,
  changeValue: undefined,
  changePercent: 10,
  correctionPercent: 8,
  spreadPercent: 2,
  confidence: 'moderate',
  weight: 4,
  samples: 12,
};

function context(aTimeMs?: number): LoggerAnalysisContext {
  return {
    traces: [],
    channels: [],
    loadTraces: async () => [],
    aTimeMs,
    bTimeMs: undefined,
    savedRanges: [],
  };
}

describe('VE Analyzer result/state continuity', () => {
  it('reconstructs VE change from immutable current VE instead of rendered cell text', () => {
    const metrics = veMetricsWithCanonicalCurrent(baseMetrics, 50);
    expect(metrics.current).toBe(50);
    expect(metrics.changeValue).toBe(5);
    expect(veResultDisplay(metrics, 'change').text).toBe('+5');
  });

  it('recognizes a Logger round trip when VE analysis authority is unchanged', () => {
    expect(sameVeAnalysisContext(context(), context())).toBe(true);
  });

  it('requires rebuild when A/B analysis authority changes', () => {
    expect(sameVeAnalysisContext(context(), context(1000))).toBe(false);
  });
});
