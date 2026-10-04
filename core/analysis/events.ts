import type { NumericChannelRange } from '../log-model/log-types';
import {
  qualifyNumericSamples,
  type NumericQualificationCondition,
  type NumericQualificationRequest,
  type NumericQualificationResult,
  type NumericQualificationTimeRange,
} from './sample-qualification';

export interface NumericEventOptions {
  /** Drop events shorter than this duration after optional gap merging. Defaults to 0. */
  readonly minimumDurationMs?: number;
  /** Merge neighboring qualifying runs when the elapsed gap between them is at most this value. Defaults to 0. */
  readonly maximumMergeGapMs?: number;
}

export interface NumericEventRequest extends NumericQualificationRequest {
  readonly eventOptions?: NumericEventOptions;
}

export type NumericEventKind = 'point' | 'interval';

export interface NumericEvent {
  readonly kind: NumericEventKind;
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  /** Last qualifying sample time minus first qualifying sample time. A one-sample event is 0 ms. */
  readonly durationMs: number;
  /** Samples that satisfied every event condition. */
  readonly qualifyingSampleCount: number;
  /** Reference-grid samples bridged by maximumMergeGapMs between qualifying runs. */
  readonly bridgedGapSampleCount: number;
  /** Inclusive source-index span from startSampleIndex through endSampleIndex. */
  readonly sampleSpanCount: number;
}

export interface NumericEventResult {
  readonly events: readonly NumericEvent[];
  /** Contiguous qualifying runs before optional short-gap merging. */
  readonly rawEventCount: number;
  /** Event count after optional short-gap merging and before minimum-duration filtering. */
  readonly mergedEventCount: number;
  /** Event count retained after minimum-duration filtering. Equal to events.length. */
  readonly retainedEventCount: number;
  readonly minimumDurationMs: number;
  readonly maximumMergeGapMs: number;
  /** Qualification evidence is retained verbatim rather than recomputed by Events. */
  readonly qualification: NumericQualificationResult;
  /** Alias for qualification.complete for event consumers. */
  readonly complete: boolean;
}

interface MutableEventRun {
  startSampleIndex: number;
  endSampleIndex: number;
  startTimeMs: number;
  endTimeMs: number;
  qualifyingSampleCount: number;
  bridgedGapSampleCount: number;
}

function normalizedNonNegative(value: number | undefined, name: string): number {
  if (value === undefined) return 0;
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be a finite non-negative number.`);
  return value;
}

function localIndexForSample(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const localIndex = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(localIndex) || localIndex < 0 || localIndex >= range.timeMs.length) return undefined;
  return localIndex;
}

function eventFromRun(run: MutableEventRun): NumericEvent {
  const sampleSpanCount = Math.max(1, run.endSampleIndex - run.startSampleIndex + 1);
  return {
    kind: run.startSampleIndex === run.endSampleIndex ? 'point' : 'interval',
    startSampleIndex: run.startSampleIndex,
    endSampleIndex: run.endSampleIndex,
    startTimeMs: run.startTimeMs,
    endTimeMs: run.endTimeMs,
    durationMs: Math.max(0, run.endTimeMs - run.startTimeMs),
    qualifyingSampleCount: run.qualifyingSampleCount,
    bridgedGapSampleCount: run.bridgedGapSampleCount,
    sampleSpanCount,
  };
}

function buildRawRuns(
  referenceRange: NumericChannelRange,
  eligibleSampleIndices: Uint32Array,
): MutableEventRun[] {
  const runs: MutableEventRun[] = [];
  let current: MutableEventRun | undefined;

  for (const sampleIndex of eligibleSampleIndices) {
    const localIndex = localIndexForSample(referenceRange, sampleIndex);
    if (localIndex === undefined) {
      throw new RangeError(`Eligible event sample ${sampleIndex} is outside the reference range.`);
    }
    const timeMs = referenceRange.timeMs[localIndex];
    if (timeMs === undefined || !Number.isFinite(timeMs)) {
      throw new RangeError(`Eligible event sample ${sampleIndex} has no finite reference timestamp.`);
    }

    if (current && sampleIndex === current.endSampleIndex + 1) {
      current.endSampleIndex = sampleIndex;
      current.endTimeMs = timeMs;
      current.qualifyingSampleCount += 1;
      continue;
    }

    current = {
      startSampleIndex: sampleIndex,
      endSampleIndex: sampleIndex,
      startTimeMs: timeMs,
      endTimeMs: timeMs,
      qualifyingSampleCount: 1,
      bridgedGapSampleCount: 0,
    };
    runs.push(current);
  }

  return runs;
}

function mergeShortGaps(runs: readonly MutableEventRun[], maximumMergeGapMs: number): MutableEventRun[] {
  if (runs.length <= 1 || maximumMergeGapMs <= 0) return runs.map((run) => ({ ...run }));

  const merged: MutableEventRun[] = [];
  for (const sourceRun of runs) {
    const current = merged[merged.length - 1];
    if (!current) {
      merged.push({ ...sourceRun });
      continue;
    }

    const elapsedGapMs = sourceRun.startTimeMs - current.endTimeMs;
    if (elapsedGapMs <= maximumMergeGapMs) {
      const bridgedSourceSamples = Math.max(0, sourceRun.startSampleIndex - current.endSampleIndex - 1);
      current.endSampleIndex = sourceRun.endSampleIndex;
      current.endTimeMs = sourceRun.endTimeMs;
      current.qualifyingSampleCount += sourceRun.qualifyingSampleCount;
      current.bridgedGapSampleCount += sourceRun.bridgedGapSampleCount + bridgedSourceSamples;
    } else {
      merged.push({ ...sourceRun });
    }
  }
  return merged;
}

export function findNumericEvents(request: NumericEventRequest): NumericEventResult {
  const reference = request.channels.get(request.referenceChannelId);
  if (!reference) throw new RangeError(`Missing reference channel range: ${request.referenceChannelId}`);

  const minimumDurationMs = normalizedNonNegative(request.eventOptions?.minimumDurationMs, 'minimumDurationMs');
  const maximumMergeGapMs = normalizedNonNegative(request.eventOptions?.maximumMergeGapMs, 'maximumMergeGapMs');
  const qualification = qualifyNumericSamples(request);
  const rawRuns = buildRawRuns(reference.range, qualification.eligibleSampleIndices);
  const mergedRuns = mergeShortGaps(rawRuns, maximumMergeGapMs);
  const events = mergedRuns
    .map(eventFromRun)
    .filter((event) => event.durationMs >= minimumDurationMs);

  return {
    events,
    rawEventCount: rawRuns.length,
    mergedEventCount: mergedRuns.length,
    retainedEventCount: events.length,
    minimumDurationMs,
    maximumMergeGapMs,
    qualification,
    complete: qualification.complete,
  };
}

export type {
  NumericQualificationCondition,
  NumericQualificationTimeRange,
};
