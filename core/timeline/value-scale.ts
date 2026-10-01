import type { NumericChannelRange } from '../log-model/log-types';

export interface StableValueScale {
  readonly min: number;
  readonly max: number;
}

/**
 * Compute a stable vertical scale from the complete selected channel range.
 * Invalid/non-finite samples are ignored. The returned range is padded once
 * when the channel is selected and is intentionally independent of horizontal
 * viewport zoom/pan state.
 */
export function buildStableValueScale(range: NumericChannelRange): StableValueScale {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let validCount = 0;

  for (let index = 0; index < range.values.length; index += 1) {
    if (range.validity[index] !== 1) continue;
    const value = range.values[index];
    if (value === undefined || !Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
    validCount += 1;
  }

  if (validCount === 0) return { min: 0, max: 1 };

  const rawSpan = max - min;
  const padding = rawSpan > 0
    ? rawSpan * 0.04
    : Math.max(1, Math.abs(max) * 0.04);

  const paddedMin = min >= 0 ? Math.max(0, min - padding) : min - padding;
  const paddedMax = max <= 0 ? Math.min(0, max + padding) : max + padding;

  if (paddedMax > paddedMin) return { min: paddedMin, max: paddedMax };
  return { min: paddedMin, max: paddedMin + 1 };
}
