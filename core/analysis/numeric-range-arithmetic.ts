import type { NumericChannelRange } from '../log-model/log-types';

export type NumericRangeBinaryOperation = 'subtract';

function localIndexForSample(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const localIndex = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= range.values.length) return undefined;
  if (localIndex >= range.timeMs.length || localIndex >= range.validity.length) return undefined;
  return localIndex;
}

/**
 * Combine two numeric ranges by source sample index.
 *
 * The output covers only the overlapping source-index window. A sample is valid
 * only when both inputs contain finite, valid values for that source index.
 * Timestamps are taken from the left range, whose source-index grid remains the
 * authority for the derived channel.
 */
export function combineNumericRanges(
  left: NumericChannelRange,
  right: NumericChannelRange,
  operation: NumericRangeBinaryOperation,
): NumericChannelRange {
  const startSampleIndex = Math.max(left.startSampleIndex, right.startSampleIndex);
  const leftEnd = left.startSampleIndex + Math.min(left.timeMs.length, left.values.length, left.validity.length);
  const rightEnd = right.startSampleIndex + Math.min(right.timeMs.length, right.values.length, right.validity.length);
  const endSampleIndex = Math.max(startSampleIndex, Math.min(leftEnd, rightEnd));
  const sampleCount = endSampleIndex - startSampleIndex;

  const timeMs = new Float64Array(sampleCount);
  const values = new Float64Array(sampleCount);
  const validity = new Uint8Array(sampleCount);
  values.fill(Number.NaN);

  for (let offset = 0; offset < sampleCount; offset += 1) {
    const sampleIndex = startSampleIndex + offset;
    const leftIndex = localIndexForSample(left, sampleIndex);
    const rightIndex = localIndexForSample(right, sampleIndex);
    if (leftIndex === undefined || rightIndex === undefined) continue;

    const timestamp = left.timeMs[leftIndex];
    const leftValue = left.values[leftIndex];
    const rightValue = right.values[rightIndex];
    timeMs[offset] = timestamp ?? Number.NaN;

    if (
      left.validity[leftIndex] !== 1
      || right.validity[rightIndex] !== 1
      || timestamp === undefined
      || !Number.isFinite(timestamp)
      || leftValue === undefined
      || rightValue === undefined
      || !Number.isFinite(leftValue)
      || !Number.isFinite(rightValue)
    ) {
      continue;
    }

    validity[offset] = 1;
    if (operation === 'subtract') values[offset] = leftValue - rightValue;
  }

  return { startSampleIndex, timeMs, values, validity };
}

export function subtractNumericRanges(
  left: NumericChannelRange,
  right: NumericChannelRange,
): NumericChannelRange {
  return combineNumericRanges(left, right, 'subtract');
}
