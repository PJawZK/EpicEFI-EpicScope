import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { buildNumericHeatmap } from '../../core/analysis/heatmap';
import { axisCellCenterWeight, buildCellCenteredWeightedMean } from '../../core/analysis/weighted-cell-mean';

function range(values: readonly number[], startSampleIndex = 0): NumericChannelRange {
  return {
    startSampleIndex,
    values: Float64Array.from(values),
    validity: Uint8Array.from(values.map(() => 1)),
    timeMs: Float64Array.from(values.map((_, index) => index * 10)),
  };
}

describe('cell-centered weighted mean', () => {
  it('gives direct center hits weight 1 and midpoint edge hits weight 0', () => {
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

  it('weights values by X and Y distance from the cell center', () => {
    const x = range([0, 2.5]);
    const y = range([0, 0]);
    const z = range([10, 30]);
    const heatmap = buildNumericHeatmap(x, y, {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    const result = buildCellCenteredWeightedMean(x, y, z, heatmap);
    // weights: 1.0 and 0.5 -> (10*1 + 30*.5) / 1.5 = 16.666...
    expect(result.cellValues[0]).toBeCloseTo(16.6666666667, 8);
    expect(result.cellTotalWeights[0]).toBeCloseTo(1.5, 8);
    expect(result.cellContributingSampleCounts[0]).toBe(2);
  });

  it('prevents far clamped edge samples from dominating an edge cell', () => {
    const x = range([-1000, 0]);
    const y = range([0, 0]);
    const z = range([0, 40]);
    const heatmap = buildNumericHeatmap(x, y, {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    expect(heatmap.counts[0]).toBe(2);
    const result = buildCellCenteredWeightedMean(x, y, z, heatmap);
    expect(result.cellValues[0]).toBe(40);
    expect(result.cellContributingSampleCounts[0]).toBe(1);
    expect(result.rejectedByWeightSampleCount).toBe(1);
  });

  it('applies individual and accumulated weight thresholds after center weighting', () => {
    const x = range([0, 4]);
    const y = range([0, 0]);
    const z = range([10, 30]);
    const heatmap = buildNumericHeatmap(x, y, {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    const individual = buildCellCenteredWeightedMean(x, y, z, heatmap, { minimumIndividualWeight: 0.5 });
    expect(individual.cellValues[0]).toBe(10);
    expect(individual.cellContributingSampleCounts[0]).toBe(1);

    const total = buildCellCenteredWeightedMean(x, y, z, heatmap, { minimumTotalWeight: 2 });
    expect(Number.isNaN(total.cellValues[0]!)).toBe(true);
    expect(total.cellTotalWeights[0]).toBeCloseTo(1.2, 8);
  });
});
