import type { NumericChannelRange } from '../log-model/log-types';

export interface ViewportEnvelopeColumn {
  readonly x: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly firstTimeMs: number;
  readonly lastTimeMs: number;
}

export interface ViewportEnvelope {
  readonly columns: readonly ViewportEnvelopeColumn[];
  readonly valueMin: number;
  readonly valueMax: number;
  readonly validSampleCount: number;
  readonly invalidSampleCount: number;
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
  const buckets = new Map<number, {
    min: number;
    max: number;
    sum: number;
    count: number;
    first: number;
    last: number;
  }>();
  let valueMin = Number.POSITIVE_INFINITY;
  let valueMax = Number.NEGATIVE_INFINITY;
  let validSampleCount = 0;
  let invalidSampleCount = 0;

  for (let index = 0; index < range.values.length; index += 1) {
    const timeMs = range.timeMs[index];
    const value = range.values[index];
    const valid = range.validity[index] === 1;
    if (timeMs === undefined || value === undefined || timeMs < startMs || timeMs > endMs) {
      continue;
    }
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
      bucket.min = Math.min(bucket.min, value);
      bucket.max = Math.max(bucket.max, value);
      bucket.sum += value;
      bucket.count += 1;
      bucket.last = timeMs;
    } else {
      buckets.set(x, {
        min: value,
        max: value,
        sum: value,
        count: 1,
        first: timeMs,
        last: timeMs,
      });
    }
  }

  return {
    columns: [...buckets.entries()]
      .sort(([left], [right]) => left - right)
      .map(([x, bucket]) => ({
        x,
        min: bucket.min,
        max: bucket.max,
        mean: bucket.sum / bucket.count,
        firstTimeMs: bucket.first,
        lastTimeMs: bucket.last,
      })),
    valueMin: validSampleCount > 0 ? valueMin : 0,
    valueMax: validSampleCount > 0 ? valueMax : 0,
    validSampleCount,
    invalidSampleCount,
  };
}
