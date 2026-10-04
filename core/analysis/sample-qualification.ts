import type { NumericChannelRange } from '../log-model/log-types';
import { numericRangeCoversTime } from './range-statistics';

export type NumericQualificationOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export interface NumericQualificationCondition {
  readonly channelId: string;
  readonly operator: NumericQualificationOperator;
  readonly value: number;
}

export interface NumericQualificationChannelRange {
  readonly range: NumericChannelRange;
  /** True only when this range is known to contain the complete source channel. */
  readonly complete: boolean;
}

export interface NumericQualificationTimeRange {
  readonly startMs: number;
  readonly endMs: number;
}

export interface NumericQualificationRequest {
  /** Defines the source sample-index/time grid over which qualification is evaluated. */
  readonly referenceChannelId: string;
  readonly channels: ReadonlyMap<string, NumericQualificationChannelRange>;
  /** Conditions are combined with explicit AND semantics. */
  readonly conditions: readonly NumericQualificationCondition[];
  /** Optional independent time scope, such as the current A/B selection. */
  readonly timeRange?: NumericQualificationTimeRange;
}

export interface NumericQualificationResult {
  /** Source sample indices that passed every condition. */
  readonly eligibleSampleIndices: Uint32Array;
  /** Reference samples inside the requested time scope with a finite timestamp. */
  readonly inputSampleCount: number;
  readonly eligibleSampleCount: number;
  readonly valueRejectedSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  /** True when every required channel is known to cover the requested scope. */
  readonly complete: boolean;
}

export function matchesNumericQualification(
  value: number,
  operator: NumericQualificationOperator,
  target: number,
): boolean {
  if (operator === 'gt') return value > target;
  if (operator === 'gte') return value >= target;
  if (operator === 'lt') return value < target;
  if (operator === 'lte') return value <= target;
  return value === target;
}

function channelCoversScope(
  channel: NumericQualificationChannelRange,
  timeRange: NumericQualificationTimeRange | undefined,
): boolean {
  if (channel.complete) return true;
  if (!timeRange) return false;
  return numericRangeCoversTime(channel.range, timeRange.startMs, timeRange.endMs);
}

function alignedLocalIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const localIndex = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= range.values.length) return undefined;
  if (localIndex >= range.timeMs.length || localIndex >= range.validity.length) return undefined;
  return localIndex;
}

export function qualifyNumericSamples(request: NumericQualificationRequest): NumericQualificationResult {
  if (!request.referenceChannelId) throw new RangeError('referenceChannelId is required.');
  const reference = request.channels.get(request.referenceChannelId);
  if (!reference) throw new RangeError(`Missing reference channel range: ${request.referenceChannelId}`);

  for (const condition of request.conditions) {
    if (!condition.channelId) throw new RangeError('qualification condition channelId is required.');
    if (!Number.isFinite(condition.value)) throw new RangeError('qualification condition value must be finite.');
    if (!request.channels.has(condition.channelId)) {
      throw new RangeError(`Missing qualification channel range: ${condition.channelId}`);
    }
  }

  const lowerMs = request.timeRange
    ? Math.min(request.timeRange.startMs, request.timeRange.endMs)
    : Number.NEGATIVE_INFINITY;
  const upperMs = request.timeRange
    ? Math.max(request.timeRange.startMs, request.timeRange.endMs)
    : Number.POSITIVE_INFINITY;

  const eligible: number[] = [];
  let inputSampleCount = 0;
  let valueRejectedSampleCount = 0;
  let invalidSampleCount = 0;
  let unavailableSampleCount = 0;

  const referenceSampleCount = Math.min(
    reference.range.timeMs.length,
    reference.range.values.length,
    reference.range.validity.length,
  );

  for (let referenceIndex = 0; referenceIndex < referenceSampleCount; referenceIndex += 1) {
    const timeMs = reference.range.timeMs[referenceIndex];
    if (timeMs === undefined || !Number.isFinite(timeMs) || timeMs < lowerMs || timeMs > upperMs) continue;

    inputSampleCount += 1;
    const sampleIndex = reference.range.startSampleIndex + referenceIndex;
    let sampleUnavailable = false;
    let sampleInvalid = false;
    let sampleRejected = false;

    for (const condition of request.conditions) {
      const channel = request.channels.get(condition.channelId);
      if (!channel) {
        sampleUnavailable = true;
        break;
      }
      const localIndex = alignedLocalIndex(channel.range, sampleIndex);
      if (localIndex === undefined) {
        sampleUnavailable = true;
        break;
      }
      const value = channel.range.values[localIndex];
      const conditionTimeMs = channel.range.timeMs[localIndex];
      if (
        channel.range.validity[localIndex] !== 1
        || value === undefined
        || !Number.isFinite(value)
        || conditionTimeMs === undefined
        || !Number.isFinite(conditionTimeMs)
      ) {
        sampleInvalid = true;
        break;
      }
      if (!matchesNumericQualification(value, condition.operator, condition.value)) {
        sampleRejected = true;
        break;
      }
    }

    if (sampleUnavailable) unavailableSampleCount += 1;
    else if (sampleInvalid) invalidSampleCount += 1;
    else if (sampleRejected) valueRejectedSampleCount += 1;
    else eligible.push(sampleIndex);
  }

  const requiredChannelIds = new Set<string>([
    request.referenceChannelId,
    ...request.conditions.map((condition) => condition.channelId),
  ]);
  const complete = unavailableSampleCount === 0 && [...requiredChannelIds].every((channelId) => {
    const channel = request.channels.get(channelId);
    return channel !== undefined && channelCoversScope(channel, request.timeRange);
  });

  return {
    eligibleSampleIndices: Uint32Array.from(eligible),
    inputSampleCount,
    eligibleSampleCount: eligible.length,
    valueRejectedSampleCount,
    invalidSampleCount,
    unavailableSampleCount,
    complete,
  };
}
