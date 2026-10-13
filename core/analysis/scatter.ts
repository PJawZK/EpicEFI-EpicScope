import type { NumericChannelRange } from '../log-model/log-types';

export interface NumericScatterOptions {
  /** Optional source sample indices, for example qualification output. */
  readonly sampleIndices?: ArrayLike<number>;
}

export interface NumericScatterResult {
  /** Source sample indices for every returned point. */
  readonly sampleIndices: Uint32Array;
  readonly xValues: Float64Array;
  readonly yValues: Float64Array;
  readonly inputSampleCount: number;
  readonly validPairSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly xMin: number | undefined;
  readonly xMax: number | undefined;
  readonly yMin: number | undefined;
  readonly yMax: number | undefined;
}

export interface NumericScatterRegion {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

export interface NumericScatterRegionSelection {
  /** Source sample indices whose valid X/Y pair lies inside the inclusive region. */
  readonly sampleIndices: Uint32Array;
  readonly selectedPairCount: number;
}

export interface NumericScatterRegionRun {
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly sampleCount: number;
}

export interface NumericScatterRegionRunSummary {
  readonly runs: readonly NumericScatterRegionRun[];
  readonly runCount: number;
  readonly strongestRun: NumericScatterRegionRun | undefined;
}

function localIndexForSample(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const localIndex = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= range.values.length) return undefined;
  if (localIndex >= range.validity.length) return undefined;
  return localIndex;
}

function forEachSelectedSampleIndex(
  referenceRange: NumericChannelRange,
  sampleIndices: ArrayLike<number> | undefined,
  visitor: (sampleIndex: number) => void,
): number {
  if (sampleIndices) {
    for (let index = 0; index < sampleIndices.length; index += 1) {
      const sampleIndex = sampleIndices[index];
      if (sampleIndex !== undefined && Number.isSafeInteger(sampleIndex) && sampleIndex >= 0) {
        visitor(sampleIndex);
      }
    }
    return sampleIndices.length;
  }

  for (let localIndex = 0; localIndex < referenceRange.values.length; localIndex += 1) {
    visitor(referenceRange.startSampleIndex + localIndex);
  }
  return referenceRange.values.length;
}

export function buildNumericScatter(
  xRange: NumericChannelRange,
  yRange: NumericChannelRange,
  options: NumericScatterOptions = {},
): NumericScatterResult {
  const sourceIndices: number[] = [];
  const xValues: number[] = [];
  const yValues: number[] = [];
  let invalidSampleCount = 0;
  let unavailableSampleCount = 0;
  let xMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;

  const inputSampleCount = forEachSelectedSampleIndex(xRange, options.sampleIndices, (sampleIndex) => {
    const xLocal = localIndexForSample(xRange, sampleIndex);
    const yLocal = localIndexForSample(yRange, sampleIndex);
    if (xLocal === undefined || yLocal === undefined) {
      unavailableSampleCount += 1;
      return;
    }

    const x = xRange.values[xLocal];
    const y = yRange.values[yLocal];
    if (
      xRange.validity[xLocal] !== 1
      || yRange.validity[yLocal] !== 1
      || x === undefined
      || y === undefined
      || !Number.isFinite(x)
      || !Number.isFinite(y)
    ) {
      invalidSampleCount += 1;
      return;
    }

    sourceIndices.push(sampleIndex);
    xValues.push(x);
    yValues.push(y);
    xMin = Math.min(xMin, x);
    xMax = Math.max(xMax, x);
    yMin = Math.min(yMin, y);
    yMax = Math.max(yMax, y);
  });

  return {
    sampleIndices: Uint32Array.from(sourceIndices),
    xValues: Float64Array.from(xValues),
    yValues: Float64Array.from(yValues),
    inputSampleCount,
    validPairSampleCount: sourceIndices.length,
    invalidSampleCount,
    unavailableSampleCount,
    xMin: sourceIndices.length > 0 ? xMin : undefined,
    xMax: sourceIndices.length > 0 ? xMax : undefined,
    yMin: sourceIndices.length > 0 ? yMin : undefined,
    yMax: sourceIndices.length > 0 ? yMax : undefined,
  };
}


/** Select evidence from the complete scatter result, independent of any UI render stride. */
export function selectNumericScatterRegion(
  result: NumericScatterResult,
  region: NumericScatterRegion,
): NumericScatterRegionSelection {
  const xMin = Math.min(region.xMin, region.xMax);
  const xMax = Math.max(region.xMin, region.xMax);
  const yMin = Math.min(region.yMin, region.yMax);
  const yMax = Math.max(region.yMin, region.yMax);
  const selected: number[] = [];

  for (let index = 0; index < result.validPairSampleCount; index += 1) {
    const x = result.xValues[index];
    const y = result.yValues[index];
    const sampleIndex = result.sampleIndices[index];
    if (x === undefined || y === undefined || sampleIndex === undefined) continue;
    if (x < xMin || x > xMax || y < yMin || y > yMax) continue;
    selected.push(sampleIndex);
  }

  return {
    sampleIndices: Uint32Array.from(selected),
    selectedPairCount: selected.length,
  };
}

/** Group selected source samples into contiguous visits through a scatter region. */
export function summarizeNumericScatterRegionRuns(
  selection: NumericScatterRegionSelection,
  maxGapSamples = 1,
): NumericScatterRegionRunSummary {
  const indices = [...selection.sampleIndices].sort((left, right) => left - right);
  const runs: NumericScatterRegionRun[] = [];
  const allowedGap = Math.max(1, Math.floor(maxGapSamples));
  let start: number | undefined;
  let previous: number | undefined;
  let count = 0;

  const flush = (): void => {
    if (start === undefined || previous === undefined || count === 0) return;
    runs.push({ startSampleIndex: start, endSampleIndex: previous, sampleCount: count });
  };

  for (const sampleIndex of indices) {
    if (start === undefined || previous === undefined) {
      start = sampleIndex; previous = sampleIndex; count = 1; continue;
    }
    if (sampleIndex - previous <= allowedGap) {
      previous = sampleIndex; count += 1; continue;
    }
    flush();
    start = sampleIndex; previous = sampleIndex; count = 1;
  }
  flush();

  let strongestRun: NumericScatterRegionRun | undefined;
  for (const run of runs) {
    if (!strongestRun || run.sampleCount > strongestRun.sampleCount) strongestRun = run;
  }
  return { runs, runCount: runs.length, strongestRun };
}
