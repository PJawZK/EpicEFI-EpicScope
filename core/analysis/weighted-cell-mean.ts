import type { NumericChannelRange } from '../log-model/log-types';
import type { NumericHeatmapAxisBin, NumericHeatmapResult } from './heatmap';

export interface CellCenteredWeightedMeanOptions {
  /** Minimum per-sample combined X/Y weight. MLV-style range: 0..1. */
  readonly minimumIndividualWeight?: number;
  /** Minimum accumulated cell weight required before a value is reported. */
  readonly minimumTotalWeight?: number;
}

export interface CellCenteredWeightedMeanResult {
  readonly cellValues: Float64Array;
  readonly cellTotalWeights: Float64Array;
  readonly cellContributingSampleCounts: Uint32Array;
  readonly cellValueMin: number | undefined;
  readonly cellValueMax: number | undefined;
  readonly contributingSampleCount: number;
  readonly rejectedByWeightSampleCount: number;
  readonly invalidValueSampleCount: number;
  readonly unavailableValueSampleCount: number;
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
 * Gives a hit weight of 1.0 at the cell center and linearly falls to 0.0 at
 * either midpoint boundary. Samples clamped beyond an explicit edge therefore
 * carry zero weight instead of gaining full authority in the edge cell.
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
 * Experimental MLV-style weighted average for an already-binned heatmap.
 *
 * A sample keeps the hard cell membership produced by buildNumericHeatmap,
 * but its authority within that cell is the product of its X and Y center
 * weights. This mirrors the public MLV description that hits near a cell edge
 * have lower weight and a direct center hit has weight 1.0.
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
  const cellValues = new Float64Array(cellCount);
  cellValues.fill(Number.NaN);
  const cellTotalWeights = new Float64Array(cellCount);
  const cellContributingSampleCounts = new Uint32Array(cellCount);

  let contributingSampleCount = 0;
  let rejectedByWeightSampleCount = 0;
  let invalidValueSampleCount = 0;
  let unavailableValueSampleCount = 0;
  let cellValueMin = Number.POSITIVE_INFINITY;
  let cellValueMax = Number.NEGATIVE_INFINITY;
  let finiteCellCount = 0;

  for (let yIndex = 0; yIndex < heatmap.yBins.length; yIndex += 1) {
    const yBin = heatmap.yBins[yIndex]!;
    for (let xIndex = 0; xIndex < heatmap.xBins.length; xIndex += 1) {
      const xBin = heatmap.xBins[xIndex]!;
      const cellIndex = yIndex * heatmap.xBins.length + xIndex;
      const sampleIndices = heatmap.cellSampleIndices[cellIndex] ?? new Uint32Array(0);
      let weightedSum = 0;
      let totalWeight = 0;
      let contributing = 0;

      for (const sampleIndex of sampleIndices) {
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

        const weight = axisCellCenterWeight(x, xBin) * axisCellCenterWeight(y, yBin);
        if (!(weight > 0) || weight < minimumIndividualWeight) {
          rejectedByWeightSampleCount += 1;
          continue;
        }
        weightedSum += value * weight;
        totalWeight += weight;
        contributing += 1;
        contributingSampleCount += 1;
      }

      cellTotalWeights[cellIndex] = totalWeight;
      cellContributingSampleCounts[cellIndex] = contributing;
      if (!(totalWeight > 0) || totalWeight < minimumTotalWeight) continue;
      const weightedMean = weightedSum / totalWeight;
      if (!Number.isFinite(weightedMean)) continue;
      cellValues[cellIndex] = weightedMean;
      cellValueMin = Math.min(cellValueMin, weightedMean);
      cellValueMax = Math.max(cellValueMax, weightedMean);
      finiteCellCount += 1;
    }
  }

  return {
    cellValues,
    cellTotalWeights,
    cellContributingSampleCounts,
    cellValueMin: finiteCellCount > 0 ? cellValueMin : undefined,
    cellValueMax: finiteCellCount > 0 ? cellValueMax : undefined,
    contributingSampleCount,
    rejectedByWeightSampleCount,
    invalidValueSampleCount,
    unavailableValueSampleCount,
  };
}
