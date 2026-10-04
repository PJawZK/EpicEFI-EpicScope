import type { NumericChannelRange } from '../log-model/log-types';

export interface NumericRangeStatistics {
  readonly validCount: number;
  readonly invalidCount: number;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly mean: number | undefined;
  readonly standardDeviation: number | undefined;
}

export function summarizeNumericRange(
  range: NumericChannelRange,
  startMs = Number.NEGATIVE_INFINITY,
  endMs = Number.POSITIVE_INFINITY,
): NumericRangeStatistics {
  const lowerMs = Math.min(startMs, endMs);
  const upperMs = Math.max(startMs, endMs);
  let validCount = 0;
  let invalidCount = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let mean = 0;
  let m2 = 0;

  for (let index = 0; index < range.values.length; index += 1) {
    const timeMs = range.timeMs[index];
    if (timeMs === undefined || timeMs < lowerMs || timeMs > upperMs) continue;
    const value = range.values[index];
    if (range.validity[index] !== 1 || value === undefined || !Number.isFinite(value)) {
      invalidCount += 1;
      continue;
    }
    validCount += 1;
    min = Math.min(min, value);
    max = Math.max(max, value);
    const delta = value - mean;
    mean += delta / validCount;
    m2 += delta * (value - mean);
  }

  return {
    validCount,
    invalidCount,
    min: validCount > 0 ? min : undefined,
    max: validCount > 0 ? max : undefined,
    mean: validCount > 0 ? mean : undefined,
    standardDeviation: validCount > 1
      ? Math.sqrt(m2 / (validCount - 1))
      : validCount === 1 ? 0 : undefined,
  };
}

export function numericRangeCoversTime(
  range: NumericChannelRange,
  startMs: number,
  endMs: number,
): boolean {
  if (range.timeMs.length === 0) return false;
  const lowerMs = Math.min(startMs, endMs);
  const upperMs = Math.max(startMs, endMs);
  const firstTimeMs = range.timeMs[0];
  const lastTimeMs = range.timeMs[range.timeMs.length - 1];
  return firstTimeMs !== undefined
    && lastTimeMs !== undefined
    && firstTimeMs <= lowerMs
    && lastTimeMs >= upperMs;
}
