import { aggregateNumericSamples, type NumericAggregationResult } from './numeric-aggregation';
import type { NumericChannelRange } from '../log-model/log-types';

export interface IdleControlTrackingSummary {
  readonly sampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly meanError: number | undefined;
  readonly meanAbsoluteError: number | undefined;
  readonly rmse: number | undefined;
  readonly maxPositiveError: number | undefined;
  readonly maxNegativeError: number | undefined;
}

export interface IdleControlDiagnosticsInput {
  readonly sampleIndices?: ArrayLike<number>;
  readonly basePosition?: NumericChannelRange;
  readonly closedLoop?: NumericChannelRange;
  readonly finalPosition?: NumericChannelRange;
  readonly pTerm?: NumericChannelRange;
  readonly iTerm?: NumericChannelRange;
  readonly dTerm?: NumericChannelRange;
  readonly dcTarget?: NumericChannelRange;
  readonly dcPosition?: NumericChannelRange;
  readonly dcBias?: NumericChannelRange;
  readonly dcPTerm?: NumericChannelRange;
  readonly dcITerm?: NumericChannelRange;
  readonly dcDTerm?: NumericChannelRange;
  readonly dcOutput?: NumericChannelRange;
}

export interface IdleControlDiagnosticsResult {
  readonly basePosition?: NumericAggregationResult;
  readonly closedLoop?: NumericAggregationResult;
  readonly finalPosition?: NumericAggregationResult;
  readonly pTerm?: NumericAggregationResult;
  readonly iTerm?: NumericAggregationResult;
  readonly dTerm?: NumericAggregationResult;
  readonly dcTarget?: NumericAggregationResult;
  readonly dcPosition?: NumericAggregationResult;
  readonly dcTracking?: IdleControlTrackingSummary;
  readonly dcBias?: NumericAggregationResult;
  readonly dcPTerm?: NumericAggregationResult;
  readonly dcITerm?: NumericAggregationResult;
  readonly dcDTerm?: NumericAggregationResult;
  readonly dcOutput?: NumericAggregationResult;
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  return Number.isSafeInteger(index) && index >= 0 && index < range.values.length && index < range.validity.length
    ? index
    : undefined;
}

function tracking(
  actual: NumericChannelRange,
  target: NumericChannelRange,
  sampleIndices?: ArrayLike<number>,
): IdleControlTrackingSummary {
  const indices = sampleIndices
    ? Array.from({ length: sampleIndices.length }, (_, index) => sampleIndices[index])
    : Array.from({ length: target.values.length }, (_, index) => target.startSampleIndex + index);
  let sampleCount = 0;
  let invalidSampleCount = 0;
  let unavailableSampleCount = 0;
  let sumError = 0;
  let sumAbsolute = 0;
  let sumSquares = 0;
  let maxPositive = Number.NEGATIVE_INFINITY;
  let maxNegative = Number.POSITIVE_INFINITY;

  for (const sampleIndex of indices) {
    if (sampleIndex === undefined || !Number.isSafeInteger(sampleIndex)) {
      unavailableSampleCount += 1;
      continue;
    }
    const actualIndex = localIndex(actual, sampleIndex);
    const targetIndex = localIndex(target, sampleIndex);
    if (actualIndex === undefined || targetIndex === undefined) {
      unavailableSampleCount += 1;
      continue;
    }
    const actualValue = actual.values[actualIndex];
    const targetValue = target.values[targetIndex];
    if (
      actual.validity[actualIndex] !== 1 ||
      target.validity[targetIndex] !== 1 ||
      actualValue === undefined ||
      targetValue === undefined ||
      !Number.isFinite(actualValue) ||
      !Number.isFinite(targetValue)
    ) {
      invalidSampleCount += 1;
      continue;
    }

    const error = actualValue - targetValue;
    sampleCount += 1;
    sumError += error;
    sumAbsolute += Math.abs(error);
    sumSquares += error * error;
    maxPositive = Math.max(maxPositive, error);
    maxNegative = Math.min(maxNegative, error);
  }

  return {
    sampleCount,
    invalidSampleCount,
    unavailableSampleCount,
    meanError: sampleCount ? sumError / sampleCount : undefined,
    meanAbsoluteError: sampleCount ? sumAbsolute / sampleCount : undefined,
    rmse: sampleCount ? Math.sqrt(sumSquares / sampleCount) : undefined,
    maxPositiveError: sampleCount ? Math.max(0, maxPositive) : undefined,
    maxNegativeError: sampleCount ? Math.min(0, maxNegative) : undefined,
  };
}

function aggregate(range: NumericChannelRange, sampleIndices?: ArrayLike<number>): NumericAggregationResult {
  return aggregateNumericSamples(range, { ...(sampleIndices ? { sampleIndices } : {}) });
}

export function analyzeIdleControlDiagnostics(input: IdleControlDiagnosticsInput): IdleControlDiagnosticsResult {
  const sampleIndices = input.sampleIndices;
  return {
    ...(input.basePosition ? { basePosition: aggregate(input.basePosition, sampleIndices) } : {}),
    ...(input.closedLoop ? { closedLoop: aggregate(input.closedLoop, sampleIndices) } : {}),
    ...(input.finalPosition ? { finalPosition: aggregate(input.finalPosition, sampleIndices) } : {}),
    ...(input.pTerm ? { pTerm: aggregate(input.pTerm, sampleIndices) } : {}),
    ...(input.iTerm ? { iTerm: aggregate(input.iTerm, sampleIndices) } : {}),
    ...(input.dTerm ? { dTerm: aggregate(input.dTerm, sampleIndices) } : {}),
    ...(input.dcTarget ? { dcTarget: aggregate(input.dcTarget, sampleIndices) } : {}),
    ...(input.dcPosition ? { dcPosition: aggregate(input.dcPosition, sampleIndices) } : {}),
    ...(input.dcTarget && input.dcPosition ? { dcTracking: tracking(input.dcPosition, input.dcTarget, sampleIndices) } : {}),
    ...(input.dcBias ? { dcBias: aggregate(input.dcBias, sampleIndices) } : {}),
    ...(input.dcPTerm ? { dcPTerm: aggregate(input.dcPTerm, sampleIndices) } : {}),
    ...(input.dcITerm ? { dcITerm: aggregate(input.dcITerm, sampleIndices) } : {}),
    ...(input.dcDTerm ? { dcDTerm: aggregate(input.dcDTerm, sampleIndices) } : {}),
    ...(input.dcOutput ? { dcOutput: aggregate(input.dcOutput, sampleIndices) } : {}),
  };
}
