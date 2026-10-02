import type { NumericChannelRange } from '../log-model/log-types';

export interface ViewportEnvelopeColumn {
  readonly x: number;
  readonly first: number;
  readonly firstTimeMs: number;
  readonly min: number;
  readonly minTimeMs: number;
  readonly max: number;
  readonly maxTimeMs: number;
  readonly last: number;
  readonly lastTimeMs: number;
}

export interface ViewportEnvelope {
  readonly columns: readonly ViewportEnvelopeColumn[];
  readonly valueMin: number;
  readonly valueMax: number;
  readonly validSampleCount: number;
  readonly invalidSampleCount: number;
}

interface BucketState {
  first: number;
  firstTimeMs: number;
  min: number;
  minTimeMs: number;
  max: number;
  maxTimeMs: number;
  last: number;
  lastTimeMs: number;
}

function lowerBound(values: Float64Array, target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if ((values[mid] ?? Number.POSITIVE_INFINITY) < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

function upperBound(values: Float64Array, target: number): number {
  let low = 0;
  let high = values.length;
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2);
    if ((values[mid] ?? Number.POSITIVE_INFINITY) <= target) low = mid + 1;
    else high = mid;
  }
  return low;
}

export function buildViewportEnvelope(
  range: NumericChannelRange,
  startMs: number,
  endMs: number,
  pixelWidth: number,
): ViewportEnvelope {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new RangeError(`Invalid viewport range ${startMs}..${endMs}.`);
  }
  if (!Number.isSafeInteger(pixelWidth) || pixelWidth <= 0) {
    throw new RangeError(`Invalid viewport width ${pixelWidth}.`);
  }

  const span = Math.max(1e-9, endMs - startMs);
  const buckets = new Map<number, BucketState>();
  let valueMin = Number.POSITIVE_INFINITY;
  let valueMax = Number.NEGATIVE_INFINITY;
  let validSampleCount = 0;
  let invalidSampleCount = 0;

  const startIndex = lowerBound(range.timeMs, startMs);
  const endIndex = upperBound(range.timeMs, endMs);

  for (let index = startIndex; index < endIndex; index += 1) {
    const timeMs = range.timeMs[index];
    const value = range.values[index];
    const valid = range.validity[index] === 1;
    if (timeMs === undefined || value === undefined) continue;
    if (!valid || !Number.isFinite(value)) {
      invalidSampleCount += 1;
      continue;
    }

    validSampleCount += 1;
    valueMin = Math.min(valueMin, value);
    valueMax = Math.max(valueMax, value);
    const normalized = (timeMs - startMs) / span;
    const x = Math.min(pixelWidth - 1, Math.max(0, Math.floor(normalized * pixelWidth)));
    const bucket = buckets.get(x);
    if (bucket) {
      if (value < bucket.min) {
        bucket.min = value;
        bucket.minTimeMs = timeMs;
      }
      if (value > bucket.max) {
        bucket.max = value;
        bucket.maxTimeMs = timeMs;
      }
      bucket.last = value;
      bucket.lastTimeMs = timeMs;
    } else {
      buckets.set(x, {
        first: value,
        firstTimeMs: timeMs,
        min: value,
        minTimeMs: timeMs,
        max: value,
        maxTimeMs: timeMs,
        last: value,
        lastTimeMs: timeMs,
      });
    }
  }

  return {
    columns: [...buckets.entries()]
      .sort(([left], [right]) => left - right)
      .map(([x, bucket]) => ({ x, ...bucket })),
    valueMin: validSampleCount > 0 ? valueMin : 0,
    valueMax: validSampleCount > 0 ? valueMax : 0,
    validSampleCount,
    invalidSampleCount,
  };
}

export interface RawViewportPoint {
  readonly timeMs: number;
  readonly value: number;
  readonly breakBefore: boolean;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/**
 * Returns the actual valid samples inside a viewport in source order.
 *
 * Lines are broken only when source validity is interrupted or when the
 * timestamp spacing is substantially larger than the normal cadence in the
 * visible range. This is intended for high-zoom rendering where pixel-bucket
 * spacing is not evidence of missing data.
 */
export function buildRawViewportSeries(
  range: NumericChannelRange,
  startMs: number,
  endMs: number,
): readonly RawViewportPoint[] {
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    throw new RangeError(`Invalid viewport range ${startMs}..${endMs}.`);
  }

  const startIndex = lowerBound(range.timeMs, startMs);
  const endIndex = upperBound(range.timeMs, endMs);
  const cadenceSamples: number[] = [];
  let previousTime: number | undefined;

  for (let index = startIndex; index < endIndex; index += 1) {
    const timeMs = range.timeMs[index];
    if (timeMs === undefined || !Number.isFinite(timeMs)) continue;
    if (previousTime !== undefined) {
      const delta = timeMs - previousTime;
      if (delta > 0 && Number.isFinite(delta)) cadenceSamples.push(delta);
    }
    previousTime = timeMs;
  }

  const normalCadenceMs = median(cadenceSamples);
  const gapThresholdMs = Math.max(50, normalCadenceMs * 5);
  const points: RawViewportPoint[] = [];
  let forceBreak = true;
  let previousValidTime: number | undefined;

  for (let index = startIndex; index < endIndex; index += 1) {
    const timeMs = range.timeMs[index];
    const value = range.values[index];
    if (
      timeMs === undefined
      || value === undefined
      || range.validity[index] !== 1
      || !Number.isFinite(timeMs)
      || !Number.isFinite(value)
    ) {
      forceBreak = true;
      continue;
    }

    const timeGap = previousValidTime === undefined ? 0 : timeMs - previousValidTime;
    points.push({
      timeMs,
      value,
      breakBefore: forceBreak || previousValidTime === undefined || timeGap > gapThresholdMs,
    });
    forceBreak = false;
    previousValidTime = timeMs;
  }

  return points;
}

