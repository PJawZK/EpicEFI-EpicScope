import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { buildNumericHeatmap } from '../../core/analysis/heatmap';
import {
  axisBreakpointContributions,
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

describe('MLV-style breakpoint weighted mean', () => {
  it('linearly shares a value between adjacent breakpoint nodes', () => {
    const heatmap = buildNumericHeatmap(range([0]), range([0]), {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    expect(axisBreakpointContributions(0, heatmap.xBins)).toEqual([{ index: 0, weight: 1 }]);
    expect(axisBreakpointContributions(2.5, heatmap.xBins)).toEqual([
      { index: 0, weight: 0.75 },
      { index: 1, weight: 0.25 },
    ]);
    expect(axisBreakpointContributions(10, heatmap.xBins)).toEqual([{ index: 1, weight: 1 }]);
  });

  it('clamps beyond outer breakpoints with full edge-node authority', () => {
    const heatmap = buildNumericHeatmap(range([0]), range([0]), {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    expect(axisBreakpointContributions(-100, heatmap.xBins)).toEqual([{ index: 0, weight: 1 }]);
    expect(axisBreakpointContributions(100, heatmap.xBins)).toEqual([{ index: 1, weight: 1 }]);
  });

  it('reproduces breakpoint-node weighted means and per-cell hit counts', () => {
    const x = range([0, 5, 10]);
    const y = range([0, 0, 0]);
    const z = range([10, 20, 30]);
    const heatmap = buildNumericHeatmap(x, y, {
      xAxisValues: [0, 10],
      yAxisValues: [0],
      clampExplicitAxisEdges: true,
    });
    const result = buildCellCenteredWeightedMean(x, y, z, heatmap);

    expect(result.cellValues[0]).toBeCloseTo(13.3333333333, 8);
    expect(result.cellValues[1]).toBeCloseTo(26.6666666667, 8);
    expect(result.cellTotalWeights[0]).toBeCloseTo(1.5, 8);
    expect(result.cellTotalWeights[1]).toBeCloseTo(1.5, 8);
    expect(result.cellContributingSampleCounts[0]).toBe(2);
    expect(result.cellContributingSampleCounts[1]).toBe(2);
    expect([...result.cellSampleIndices[0]!]).toEqual([0, 1]);
    expect([...result.cellSampleIndices[1]!]).toEqual([1, 2]);
  });

  it('multiplies X and Y node weights so one sample can influence four cells', () => {
    const x = range([5]);
    const y = range([5]);
    const z = range([40]);
    const heatmap = buildNumericHeatmap(x, y, {
      xAxisValues: [0, 10],
      yAxisValues: [0, 10],
      clampExplicitAxisEdges: true,
    });
    const result = buildCellCenteredWeightedMean(x, y, z, heatmap);

    expect([...result.cellValues]).toEqual([40, 40, 40, 40]);
    expect([...result.cellTotalWeights]).toEqual([0.25, 0.25, 0.25, 0.25]);
    expect([...result.cellContributingSampleCounts]).toEqual([1, 1, 1, 1]);
  });

  it('applies individual and accumulated weight thresholds to cell contributions', () => {
    const x = range([5]);
    const y = range([5]);
    const z = range([40]);
    const heatmap = buildNumericHeatmap(x, y, {
      xAxisValues: [0, 10],
      yAxisValues: [0, 10],
      clampExplicitAxisEdges: true,
    });

    const individual = buildCellCenteredWeightedMean(x, y, z, heatmap, { minimumIndividualWeight: 0.3 });
    expect([...individual.cellValues].every((value) => Number.isNaN(value))).toBe(true);
    expect([...individual.cellContributingSampleCounts]).toEqual([0, 0, 0, 0]);

    const total = buildCellCenteredWeightedMean(x, y, z, heatmap, { minimumTotalWeight: 0.3 });
    expect([...total.cellValues].every((value) => Number.isNaN(value))).toBe(true);
    expect([...total.cellTotalWeights]).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
});
