import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { buildNumericHeatmap } from '../../core/analysis/heatmap';
import {
  axisCellCenterWeight,
  axisInterpolationContributions,
  buildCellCenteredWeightedMean,
} from '../../core/analysis/weighted-cell-mean';

function range(values: readonly number[], startSampleIndex = 0): NumericChannelRange {
  return {
    startSampleIndex,
    values: Float64Array.from(values),
    validity: Uint8Array.from(values.map(() => 1)),
    timeMs: Float64Array.from(values.map((_, index) => index * 10)),
  };
}

describe('MLV-style weighted mean', () => {
  it('retains the legacy center-weight helper for direct diagnostics', () => {
    const heatmap = buildNumericHeatmap(range([0, 5, 10]), range([0, 0, 0]), {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    const first = heatmap.xBins[0]!;
    expect(axisCellCenterWeight(0, first)).toBe(1);
    expect(axisCellCenterWeight(5, first)).toBe(0);
    expect(axisCellCenterWeight(-100, first)).toBe(0);
  });

  it('splits an in-between axis value across neighboring interpolation nodes', () => {
    const heatmap = buildNumericHeatmap(range([0]), range([0]), {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    expect(axisInterpolationContributions(2.5, heatmap.xBins)).toEqual([
      { index: 0, weight: 0.75 },
      { index: 1, weight: 0.25 },
    ]);
  });

  it('clamps beyond the outer breakpoints to the outer interpolation node', () => {
    const heatmap = buildNumericHeatmap(range([0]), range([0]), {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    expect(axisInterpolationContributions(-100, heatmap.xBins)).toEqual([{ index: 0, weight: 1 }]);
    expect(axisInterpolationContributions(100, heatmap.xBins)).toEqual([{ index: 1, weight: 1 }]);
  });

  it('lets one source sample contribute to multiple neighboring cells', () => {
    const x = range([2.5]);
    const y = range([2.5]);
    const z = range([40]);
    const heatmap = buildNumericHeatmap(x, y, {
      xAxisValues: [0, 10],
      yAxisValues: [0, 10],
      clampExplicitAxisEdges: true,
    });
    const result = buildCellCenteredWeightedMean(x, y, z, heatmap);
    expect([...result.cellContributingSampleCounts]).toEqual([1, 1, 1, 1]);
    expect([...result.cellTotalWeights]).toEqual([
      0.75 * 0.75,
      0.25 * 0.75,
      0.75 * 0.25,
      0.25 * 0.25,
    ]);
    expect(result.contributingSampleCount).toBe(1);
    expect(result.contributingHitCount).toBe(4);
    expect([...result.cellValues]).toEqual([40, 40, 40, 40]);
  });

  it('calculates each cell mean from its interpolation-weighted hits', () => {
    const x = range([0, 2.5]);
    const y = range([0, 0]);
    const z = range([10, 30]);
    const heatmap = buildNumericHeatmap(x, y, {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    const result = buildCellCenteredWeightedMean(x, y, z, heatmap);
    // Cell 0 gets weights 1.0 and .75 -> (10 + 22.5) / 1.75.
    expect(result.cellValues[0]).toBeCloseTo(18.5714285714, 8);
    expect(result.cellTotalWeights[0]).toBeCloseTo(1.75, 8);
    expect(result.cellContributingSampleCounts[0]).toBe(2);
    // Cell 1 gets the second sample with .25 authority.
    expect(result.cellValues[1]).toBe(30);
    expect(result.cellTotalWeights[1]).toBeCloseTo(0.25, 8);
    expect(result.cellContributingSampleCounts[1]).toBe(1);
  });

  it('applies individual and accumulated weight thresholds to cell hits', () => {
    const x = range([0, 4]);
    const y = range([0, 0]);
    const z = range([10, 30]);
    const heatmap = buildNumericHeatmap(x, y, {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    const individual = buildCellCenteredWeightedMean(x, y, z, heatmap, { minimumIndividualWeight: 0.5 });
    expect(individual.cellContributingSampleCounts[0]).toBe(2);
    expect(individual.cellContributingSampleCounts[1]).toBe(0);

    const total = buildCellCenteredWeightedMean(x, y, z, heatmap, { minimumTotalWeight: 2 });
    expect(Number.isNaN(total.cellValues[0]!)).toBe(true);
    expect(total.cellTotalWeights[0]).toBeCloseTo(1.6, 8);
  });

  it('retains exact source indices per weighted destination cell', () => {
    const x = range([2.5], 100);
    const y = range([2.5], 100);
    const z = range([40], 100);
    const heatmap = buildNumericHeatmap(x, y, {
      xAxisValues: [0, 10],
      yAxisValues: [0, 10],
      clampExplicitAxisEdges: true,
    });
    const result = buildCellCenteredWeightedMean(x, y, z, heatmap);
    for (const indices of result.cellSampleIndices) expect([...indices]).toEqual([100]);
  });
});
