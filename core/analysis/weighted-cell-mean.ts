import type { NumericChannelRange } from '../log-model/log-types';
import type { NumericHeatmapAxisBin, NumericHeatmapResult } from './heatmap';

export interface CellCenteredWeightedMeanOptions {
  /** Minimum per-cell hit weight. MLV-style range: 0..1. */
  readonly minimumIndividualWeight?: number;
  /** Minimum accumulated cell weight required before a value is reported. */
  readonly minimumTotalWeight?: number;
}

export interface CellCenteredWeightedMeanResult {
  readonly cellValues: Float64Array;
  readonly cellTotalWeights: Float64Array;
  readonly cellContributingSampleCounts: Uint32Array;
  /** Exact source sample indices contributing non-zero weight to each cell. */
  readonly cellSampleIndices: readonly Uint32Array[];
  readonly cellValueMin: number | undefined;
  readonly cellValueMax: number | undefined;
  readonly contributingSampleCount: number;
  readonly contributingHitCount: number;
  readonly rejectedByWeightSampleCount: number;
  readonly invalidValueSampleCount: number;
  readonly unavailableValueSampleCount: number;
}

interface AxisContribution {
  readonly index: number;
  readonly weight: number;
}

function threshold(value: number | undefined, name: string, maximum?: number): number {
  if (value === undefined) return 0;
  if (!Number.isFinite(value) || value < 0 || (maximum !== undefined && value > maximum)) {
    throw new RangeError(`${name} must be finite and between 0 and ${maximum ?? 'infinity'}.`);
  }
  return value;
}

function localIndexForSample(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const localIndex = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= range.values.length) return undefined;
  if (localIndex >= range.validity.length) return undefined;
  return localIndex;
}

/**
 * Legacy helper retained for direct inspection/testing. Gives a hit weight of
 * 1.0 at one cell center and falls linearly to 0.0 at that cell's midpoint
 * boundary. The MLV-style weighted mean itself now uses interpolation-node
 * contributions instead of hard cell membership.
 */
export function axisCellCenterWeight(value: number, bin: NumericHeatmapAxisBin): number {
  if (!Number.isFinite(value)) return 0;
  const center = bin.centerValue;
  if (value === center) return 1;
  const extent = value < center ? center - bin.lowerBound : bin.upperBound - center;
  if (!(extent > 0) || !Number.isFinite(extent)) return 0;
  return Math.max(0, Math.min(1, 1 - Math.abs(value - center) / extent));
}

/**
 * Returns the linear interpolation-node contributions for one axis.
 *
 * Between two table breakpoints the sample contributes to both neighboring
 * nodes and their weights sum to 1. Beyond either outer breakpoint the outer
 * node receives full weight, matching normal clamped table interpolation.
 */
export function axisInterpolationContributions(
  value: number,
  bins: readonly NumericHeatmapAxisBin[],
): readonly AxisContribution[] {
  if (!Number.isFinite(value) || bins.length === 0) return [];
  if (bins.length === 1) return [{ index: 0, weight: 1 }];

  const first = bins[0]!.centerValue;
  const lastIndex = bins.length - 1;
  const last = bins[lastIndex]!.centerValue;
  if (value <= first) return [{ index: 0, weight: 1 }];
  if (value >= last) return [{ index: lastIndex, weight: 1 }];

  for (let upperIndex = 1; upperIndex < bins.length; upperIndex += 1) {
    const upper = bins[upperIndex]!.centerValue;
    if (value > upper) continue;
    const lowerIndex = upperIndex - 1;
    const lower = bins[lowerIndex]!.centerValue;
    const span = upper - lower;
    if (!(span > 0) || !Number.isFinite(span)) return [];
    const upperWeight = Math.max(0, Math.min(1, (value - lower) / span));
    const lowerWeight = 1 - upperWeight;
    if (upperWeight <= 0) return [{ index: lowerIndex, weight: 1 }];
    if (lowerWeight <= 0) return [{ index: upperIndex, weight: 1 }];
    return [
      { index: lowerIndex, weight: lowerWeight },
      { index: upperIndex, weight: upperWeight },
    ];
  }
  return [];
}

function uniqueSourceSampleIndices(heatmap: Pick<NumericHeatmapResult, 'cellSampleIndices'>): readonly number[] {
  const unique = new Set<number>();
  for (const indices of heatmap.cellSampleIndices) {
    for (const sampleIndex of indices) unique.add(sampleIndex);
  }
  return [...unique];
}

/**
 * Experimental MLV-style weighted average.
 *
 * Each source sample contributes to the neighboring X/Y table breakpoints
 * using linear interpolation weights. In 2D that yields up to four cell hits,
 * with each hit weighted by XWeight * YWeight. This matches the observable MLV
 * behavior much better than hard-binning first: MLV's Cell Hit Count can exceed
 * a nearest-cell count because one source sample may contribute to multiple
 * neighboring cells.
 */
export function buildCellCenteredWeightedMean(
  xRange: NumericChannelRange,
  yRange: NumericChannelRange,
  valueRange: NumericChannelRange,
  heatmap: Pick<NumericHeatmapResult, 'xBins' | 'yBins' | 'cellSampleIndices'>,
  options: CellCenteredWeightedMeanOptions = {},
): CellCenteredWeightedMeanResult {
  const minimumIndividualWeight = threshold(options.minimumIndividualWeight, 'minimumIndividualWeight', 1);
  const minimumTotalWeight = threshold(options.minimumTotalWeight, 'minimumTotalWeight');
  const cellCount = heatmap.xBins.length * heatmap.yBins.length;
  const weightedSums = new Float64Array(cellCount);
  const cellTotalWeights = new Float64Array(cellCount);
  const cellContributingSampleCounts = new Uint32Array(cellCount);
  const cellSampleIndices: number[][] = Array.from({ length: cellCount }, () => []);
  const cellValues = new Float64Array(cellCount);
  cellValues.fill(Number.NaN);

  let contributingSampleCount = 0;
  let contributingHitCount = 0;
  let rejectedByWeightSampleCount = 0;
  let invalidValueSampleCount = 0;
  let unavailableValueSampleCount = 0;
  let cellValueMin = Number.POSITIVE_INFINITY;
  let cellValueMax = Number.NEGATIVE_INFINITY;
  let finiteCellCount = 0;

  for (const sampleIndex of uniqueSourceSampleIndices(heatmap)) {
    const xLocal = localIndexForSample(xRange, sampleIndex);
    const yLocal = localIndexForSample(yRange, sampleIndex);
    const valueLocal = localIndexForSample(valueRange, sampleIndex);
    if (xLocal === undefined || yLocal === undefined || valueLocal === undefined) {
      unavailableValueSampleCount += 1;
      continue;
    }
    const x = xRange.values[xLocal];
    const y = yRange.values[yLocal];
    const value = valueRange.values[valueLocal];
    if (
      xRange.validity[xLocal] !== 1
      || yRange.validity[yLocal] !== 1
      || valueRange.validity[valueLocal] !== 1
      || x === undefined
      || y === undefined
      || value === undefined
      || !Number.isFinite(x)
      || !Number.isFinite(y)
      || !Number.isFinite(value)
    ) {
      invalidValueSampleCount += 1;
      continue;
    }

    const xContributions = axisInterpolationContributions(x, heatmap.xBins);
    const yContributions = axisInterpolationContributions(y, heatmap.yBins);
    let sampleContributed = false;
    for (const yContribution of yContributions) {
      for (const xContribution of xContributions) {
        const weight = xContribution.weight * yContribution.weight;
        if (!(weight > 0) || weight < minimumIndividualWeight) {
          rejectedByWeightSampleCount += 1;
          continue;
        }
        const cellIndex = yContribution.index * heatmap.xBins.length + xContribution.index;
        weightedSums[cellIndex] = (weightedSums[cellIndex] ?? 0) + value * weight;
        cellTotalWeights[cellIndex] = (cellTotalWeights[cellIndex] ?? 0) + weight;
        cellContributingSampleCounts[cellIndex] = (cellContributingSampleCounts[cellIndex] ?? 0) + 1;
        cellSampleIndices[cellIndex]!.push(sampleIndex);
        contributingHitCount += 1;
        sampleContributed = true;
      }
    }
    if (sampleContributed) contributingSampleCount += 1;
  }

  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const totalWeight = cellTotalWeights[cellIndex] ?? 0;
    if (!(totalWeight > 0) || totalWeight < minimumTotalWeight) continue;
    const weightedMean = weightedSums[cellIndex]! / totalWeight;
    if (!Number.isFinite(weightedMean)) continue;
    cellValues[cellIndex] = weightedMean;
    cellValueMin = Math.min(cellValueMin, weightedMean);
    cellValueMax = Math.max(cellValueMax, weightedMean);
    finiteCellCount += 1;
  }

  return {
    cellValues,
    cellTotalWeights,
    cellContributingSampleCounts,
    cellSampleIndices: cellSampleIndices.map((indices) => Uint32Array.from(indices)),
    cellValueMin: finiteCellCount > 0 ? cellValueMin : undefined,
    cellValueMax: finiteCellCount > 0 ? cellValueMax : undefined,
    contributingSampleCount,
    contributingHitCount,
    rejectedByWeightSampleCount,
    invalidValueSampleCount,
    unavailableValueSampleCount,
  };
}
