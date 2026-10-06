import { describe, expect, it } from 'vitest';
import { analyzeIdleControlDiagnostics } from '../../core/analysis/idle-control-diagnostics';
import type { NumericChannelRange } from '../../core/log-model/log-types';

function range(values: readonly number[], validity?: readonly number[], startSampleIndex = 0): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * 100)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('analyzeIdleControlDiagnostics', () => {
  it('separates outer RPM-controller effort from inner DC-valve tracking', () => {
    const result = analyzeIdleControlDiagnostics({
      basePosition: range([24, 24, 24, 24]),
      closedLoop: range([0, 4, 10, -2]),
      finalPosition: range([24, 28, 34, 22]),
      pTerm: range([0, 5, 12, -3]),
      iTerm: range([1, 2, 4, 4]),
      dTerm: range([0, -2, 6, -1]),
      dcTarget: range([24, 28, 34, 22]),
      dcPosition: range([24, 26, 31, 23]),
      dcBias: range([20, 22, 26, 19]),
      dcPTerm: range([0, 2, 4, -1]),
      dcITerm: range([1, 1, 2, 2]),
      dcDTerm: range([0, 1, 2, -1]),
      dcOutput: range([21, 26, 34, 19]),
    });

    expect(result.closedLoop?.meanAbsolute).toBe(4);
    expect(result.pTerm?.rootMeanSquare).toBeCloseTo(Math.sqrt(178 / 4));
    expect(result.iTerm?.mean).toBeCloseTo(2.75);
    expect(result.dcTracking?.meanError).toBeCloseTo(-1);
    expect(result.dcTracking?.meanAbsoluteError).toBeCloseTo(1.5);
    expect(result.dcTracking?.rmse).toBeCloseTo(Math.sqrt(14 / 4));
    expect(result.dcTracking?.maxNegativeError).toBe(-3);
    expect(result.dcTracking?.maxPositiveError).toBe(1);
    expect(result.dcBias?.mean).toBeCloseTo(21.75);
    expect(result.dcOutput?.meanAbsolute).toBe(25);
  });

  it('preserves invalid and unavailable tracking provenance for selected source indices', () => {
    const result = analyzeIdleControlDiagnostics({
      sampleIndices: [9, 10, 11, 12, 13],
      dcTarget: range([20, 30, 40], [1, 1, 1], 10),
      dcPosition: range([19, 29], [1, 0], 10),
    });

    expect(result.dcTracking?.sampleCount).toBe(1);
    expect(result.dcTracking?.invalidSampleCount).toBe(1);
    expect(result.dcTracking?.unavailableSampleCount).toBe(3);
    expect(result.dcTracking?.meanError).toBe(-1);
  });
});
