import type { NumericChannelRange } from '../log-model/log-types';
import type { NumericHeatmapAxisBin, NumericHeatmapResult } from './heatmap';

export interface CellCenteredWeightedMeanOptions {
  /** Minimum per-cell contribution weight. MLV-style range: 0..1. */
  readonly minimumIndividualWeight?: number;
  /** Minimum accumulated cell weight required before a value is reported. */
  readonly minimumTotalWeight?: number;
}

export interface CellCenteredWeightedMeanResult {
  readonly cellValues: Float64Array;
  readonly cellTotalWeights: Float64Array;
  readonly cellContributingSampleCounts: Uint32Array;
  readonly cellSampleIndices: readonly Uint32Array[];
  readonly cellValueMin: number | undefined;
  readonly cellValueMax: number | undefined;
  readonly contributingSampleCount: number;
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
 * MLV-style breakpoint-node influence for one axis.
 *
 * A value between two table breakpoints contributes to both nodes linearly.
 * Values beyond the outermost breakpoint retain full authority in the nearest
 * outer node. This is the same geometry used by a clamped 1D table lookup.
 */
export function axisBreakpointContributions(
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

  let low = 0;
  let high = lastIndex;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (value < bins[mid]!.centerValue) high = mid;
    else low = mid;
  }

  const lowCenter = bins[low]!.centerValue;
  const highCenter = bins[high]!.centerValue;
  const span = highCenter - lowCenter;
  if (!(span > 0) || !Number.isFinite(span)) return [];
  const highWeight = (value - lowCenter) / span;
  const lowWeight = 1 - highWeight;
  const result: AxisContribution[] = [];
  if (lowWeight > 0) result.push({ index: low, weight: lowWeight });
  if (highWeight > 0) result.push({ index: high, weight: highWeight });
  return result;
}

/**
 * Backward-compatible helper retained for callers/tests that want one node's
 * influence. The supplied bin must belong to the full axis to be meaningful;
 * buildCellCenteredWeightedMean uses axisBreakpointContributions directly.
 */
export function axisCellCenterWeight(value: number, bin: NumericHeatmapAxisBin): number {
  if (!Number.isFinite(value)) return 0;
  if (value === bin.centerValue) return 1;
  if (value < bin.lowerBound || value > bin.upperBound) return 0;
  const extent = value < bin.centerValue
    ? bin.centerValue - bin.lowerBound
    : bin.upperBound - bin.centerValue;
  if (!(extent > 0) || !Number.isFinite(extent)) return 0;
  return Math.max(0, Math.min(1, 1 - Math.abs(value - bin.centerValue) / extent));
}

/**
 * Weighted table-node average matching MegaLogViewer's observed Histogram
 * behaviour on explicit tune-table axes.
 *
 * Every eligible source sample contributes to up to two X nodes and two Y
 * nodes. The combined cell hit weight is X weight * Y weight. The outermost
 * nodes clamp beyond the tune-table edge with full axis authority. A sample is
 * counted as a cell hit whenever its combined weight is > 0 and passes the
 * optional individual-weight threshold.
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
  const xCount = heatmap.xBins.length;
  const yCount = heatmap.yBins.length;
  const cellCount = xCount * yCount;
  const weightedSums = new Float64Array(cellCount);
  const cellTotalWeights = new Float64Array(cellCount);
  const cellContributingSampleCounts = new Uint32Array(cellCount);
  const sampleLists: number[][] = Array.from({ length: cellCount }, () => []);
  const cellValues = new Float64Array(cellCount);
  cellValues.fill(Number.NaN);

  // Hard heatmap membership is exclusive, so concatenating the lists gives
  // the complete eligible source set once each while preserving qualification.
  const eligibleSampleIndices: number[] = [];
  for (const indices of heatmap.cellSampleIndices) {
    for (const sampleIndex of indices) eligibleSampleIndices.push(sampleIndex);
  }

  let contributingSampleCount = 0;
  let rejectedByWeightSampleCount = 0;
  let invalidValueSampleCount = 0;
  let unavailableValueSampleCount = 0;

  for (const sampleIndex of eligibleSampleIndices) {
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

    const xContributions = axisBreakpointContributions(x, heatmap.xBins);
    const yContributions = axisBreakpointContributions(y, heatmap.yBins);
    let contributed = false;
    let rejected = false;
    for (const yContribution of yContributions) {
      for (const xContribution of xContributions) {
        const weight = xContribution.weight * yContribution.weight;
        if (!(weight > 0) || weight < minimumIndividualWeight) {
          if (weight > 0) rejected = true;
          continue;
        }
        const cellIndex = yContribution.index * xCount + xContribution.index;
        weightedSums[cellIndex] = (weightedSums[cellIndex] ?? 0) + value * weight;
        cellTotalWeights[cellIndex] = (cellTotalWeights[cellIndex] ?? 0) + weight;
        cellContributingSampleCounts[cellIndex] = (cellContributingSampleCounts[cellIndex] ?? 0) + 1;
        sampleLists[cellIndex]!.push(sampleIndex);
        contributed = true;
      }
    }
    if (contributed) contributingSampleCount += 1;
    else if (rejected) rejectedByWeightSampleCount += 1;
  }

  let cellValueMin = Number.POSITIVE_INFINITY;
  let cellValueMax = Number.NEGATIVE_INFINITY;
  let finiteCellCount = 0;
  for (let cellIndex = 0; cellIndex < cellCount; cellIndex += 1) {
    const totalWeight = cellTotalWeights[cellIndex] ?? 0;
    if (!(totalWeight > 0) || totalWeight < minimumTotalWeight) continue;
    const weightedMean = (weightedSums[cellIndex] ?? 0) / totalWeight;
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
    cellSampleIndices: sampleLists.map((indices) => Uint32Array.from(indices)),
    cellValueMin: finiteCellCount > 0 ? cellValueMin : undefined,
    cellValueMax: finiteCellCount > 0 ? cellValueMax : undefined,
    contributingSampleCount,
    rejectedByWeightSampleCount,
    invalidValueSampleCount,
    unavailableValueSampleCount,
  };
}
