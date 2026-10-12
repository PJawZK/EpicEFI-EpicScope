import { aggregateNumericSamples, type NumericAggregationResult } from './numeric-aggregation';
import type { NumericChannelRange } from '../log-model/log-types';

interface SampleValue {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly value: number;
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  return Number.isSafeInteger(index) && index >= 0 && index < range.values.length && index < range.validity.length
    ? index
    : undefined;
}

function sample(range: NumericChannelRange | undefined, sampleIndex: number): SampleValue | undefined {
  if (!range) return undefined;
  const index = localIndex(range, sampleIndex);
  if (index === undefined || range.validity[index] !== 1) return undefined;
  const value = range.values[index];
  const timeMs = range.timeMs[index];
  if (value === undefined || timeMs === undefined || !Number.isFinite(value) || !Number.isFinite(timeMs)) return undefined;
  return { sampleIndex, timeMs, value };
}

function selectedIndices(reference: NumericChannelRange, sampleIndices?: ArrayLike<number>): number[] {
  if (sampleIndices) {
    return Array.from({ length: sampleIndices.length }, (_, index) => sampleIndices[index])
      .filter((value): value is number => Number.isSafeInteger(value));
  }
  return Array.from({ length: reference.values.length }, (_, index) => reference.startSampleIndex + index);
}

function percentile(values: readonly number[], p: number): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower];
  const high = sorted[upper];
  if (low === undefined) return undefined;
  if (high === undefined || lower === upper) return low;
  return low + (high - low) * (position - lower);
}

export interface IgnitionTimingStepEvent {
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly durationMs: number;
  readonly advanceBefore: number;
  readonly advanceAfter: number;
  readonly deltaAdvance: number;
  readonly retardOrCorrection?: number;
  readonly dwell?: number;
  readonly rpm?: number;
  readonly load?: number;
}

export interface IgnitionCorrectionEvent {
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly durationMs: number;
  readonly sampleCount: number;
  readonly peakMagnitude: number;
  readonly peakValue: number;
  readonly advanceAtPeak?: number;
  readonly dwellAtPeak?: number;
  readonly rpmAtPeak?: number;
  readonly loadAtPeak?: number;
}

export interface IgnitionTransitionSummary {
  readonly transitionCount: number;
  readonly meanAbsoluteStep: number | undefined;
  readonly p95AbsoluteStep: number | undefined;
  readonly maxAbsoluteStep: number | undefined;
  readonly skippedGapCount: number;
  readonly invalidOrUnavailablePairCount: number;
}

export interface IgnitionBehaviorResult {
  readonly advance: NumericAggregationResult;
  readonly retardOrCorrection?: NumericAggregationResult;
  readonly dwell?: NumericAggregationResult;
  readonly rpm?: NumericAggregationResult;
  readonly load?: NumericAggregationResult;
  readonly transitions: IgnitionTransitionSummary;
  readonly timingStepEvents: readonly IgnitionTimingStepEvent[];
  readonly correctionEvents: readonly IgnitionCorrectionEvent[];
  readonly nonPositiveDwellSampleCount: number;
  readonly complete: boolean;
}

export interface IgnitionBehaviorOptions {
  readonly sampleIndices?: ArrayLike<number>;
  readonly complete?: boolean;
  readonly timingStepThreshold?: number;
  readonly correctionThreshold?: number;
  readonly maxTransitionGapMs?: number;
}

export function analyzeIgnitionBehavior(inputs: {
  readonly advance: NumericChannelRange;
  readonly retardOrCorrection?: NumericChannelRange;
  readonly dwell?: NumericChannelRange;
  readonly rpm?: NumericChannelRange;
  readonly load?: NumericChannelRange;
}, options: IgnitionBehaviorOptions = {}): IgnitionBehaviorResult {
  const indices = selectedIndices(inputs.advance, options.sampleIndices);
  const timingStepThreshold = options.timingStepThreshold ?? 5;
  const correctionThreshold = options.correctionThreshold ?? 0.5;
  const maxTransitionGapMs = options.maxTransitionGapMs ?? 100;
  if (!(timingStepThreshold > 0)) throw new RangeError('Ignition timing-step threshold must be > 0.');
  if (correctionThreshold < 0) throw new RangeError('Ignition correction threshold must be >= 0.');
  if (!(maxTransitionGapMs > 0)) throw new RangeError('Ignition max transition gap must be > 0.');

  const absoluteSteps: number[] = [];
  const timingStepEvents: IgnitionTimingStepEvent[] = [];
  let skippedGapCount = 0;
  let invalidOrUnavailablePairCount = 0;

  for (let position = 1; position < indices.length; position += 1) {
    const previousIndex = indices[position - 1]!;
    const currentIndex = indices[position]!;
    const previous = sample(inputs.advance, previousIndex);
    const current = sample(inputs.advance, currentIndex);
    if (!previous || !current) {
      invalidOrUnavailablePairCount += 1;
      continue;
    }
    const gapMs = current.timeMs - previous.timeMs;
    if (!(gapMs > 0) || gapMs > maxTransitionGapMs) {
      skippedGapCount += 1;
      continue;
    }
    const deltaAdvance = current.value - previous.value;
    absoluteSteps.push(Math.abs(deltaAdvance));
    if (Math.abs(deltaAdvance) < timingStepThreshold) continue;
    const retard = sample(inputs.retardOrCorrection, currentIndex);
    const dwell = sample(inputs.dwell, currentIndex);
    const rpm = sample(inputs.rpm, currentIndex);
    const load = sample(inputs.load, currentIndex);
    timingStepEvents.push({
      startSampleIndex: previousIndex,
      endSampleIndex: currentIndex,
      startTimeMs: previous.timeMs,
      endTimeMs: current.timeMs,
      durationMs: gapMs,
      advanceBefore: previous.value,
      advanceAfter: current.value,
      deltaAdvance,
      ...(retard ? { retardOrCorrection: retard.value } : {}),
      ...(dwell ? { dwell: dwell.value } : {}),
      ...(rpm ? { rpm: rpm.value } : {}),
      ...(load ? { load: load.value } : {}),
    });
  }

  const correctionEvents: IgnitionCorrectionEvent[] = [];
  if (inputs.retardOrCorrection) {
    let startPosition: number | undefined;
    let peakPosition: number | undefined;
    let peakMagnitude = Number.NEGATIVE_INFINITY;
    let peakValue = 0;

    const closeEvent = (endPosition: number): void => {
      if (startPosition === undefined || peakPosition === undefined || endPosition < startPosition) return;
      const startIndex = indices[startPosition]!;
      const endIndex = indices[endPosition]!;
      const peakIndex = indices[peakPosition]!;
      const first = sample(inputs.retardOrCorrection, startIndex);
      const last = sample(inputs.retardOrCorrection, endIndex);
      if (!first || !last) return;
      const advance = sample(inputs.advance, peakIndex);
      const dwell = sample(inputs.dwell, peakIndex);
      const rpm = sample(inputs.rpm, peakIndex);
      const load = sample(inputs.load, peakIndex);
      correctionEvents.push({
        startSampleIndex: startIndex,
        endSampleIndex: endIndex,
        startTimeMs: first.timeMs,
        endTimeMs: last.timeMs,
        durationMs: last.timeMs - first.timeMs,
        sampleCount: endPosition - startPosition + 1,
        peakMagnitude,
        peakValue,
        ...(advance ? { advanceAtPeak: advance.value } : {}),
        ...(dwell ? { dwellAtPeak: dwell.value } : {}),
        ...(rpm ? { rpmAtPeak: rpm.value } : {}),
        ...(load ? { loadAtPeak: load.value } : {}),
      });
    };

    for (let position = 0; position <= indices.length; position += 1) {
      const index = position < indices.length ? indices[position]! : undefined;
      const current = index === undefined ? undefined : sample(inputs.retardOrCorrection, index);
      const previousIndex = position > 0 ? indices[position - 1] : undefined;
      const previous = previousIndex === undefined ? undefined : sample(inputs.retardOrCorrection, previousIndex);
      const gapBreak = current && previous
        ? current.timeMs <= previous.timeMs || current.timeMs - previous.timeMs > maxTransitionGapMs
        : false;
      const active = current !== undefined && !gapBreak && Math.abs(current.value) > correctionThreshold;

      if (active) {
        if (startPosition === undefined) startPosition = position;
        const magnitude = Math.abs(current.value);
        if (magnitude > peakMagnitude) {
          peakMagnitude = magnitude;
          peakValue = current.value;
          peakPosition = position;
        }
        continue;
      }

      if (startPosition !== undefined) closeEvent(position - 1);
      startPosition = undefined;
      peakPosition = undefined;
      peakMagnitude = Number.NEGATIVE_INFINITY;
      peakValue = 0;

      if (current && gapBreak && Math.abs(current.value) > correctionThreshold) {
        startPosition = position;
        peakPosition = position;
        peakMagnitude = Math.abs(current.value);
        peakValue = current.value;
      }
    }
  }

  let nonPositiveDwellSampleCount = 0;
  if (inputs.dwell) {
    for (const index of indices) {
      const dwell = sample(inputs.dwell, index);
      if (dwell && dwell.value <= 0) nonPositiveDwellSampleCount += 1;
    }
  }

  const meanAbsoluteStep = absoluteSteps.length
    ? absoluteSteps.reduce((sum, value) => sum + value, 0) / absoluteSteps.length
    : undefined;

  return {
    advance: aggregateNumericSamples(inputs.advance, { sampleIndices: indices }),
    transitions: {
      transitionCount: absoluteSteps.length,
      meanAbsoluteStep,
      p95AbsoluteStep: percentile(absoluteSteps, 0.95),
      maxAbsoluteStep: absoluteSteps.length ? Math.max(...absoluteSteps) : undefined,
      skippedGapCount,
      invalidOrUnavailablePairCount,
    },
    timingStepEvents,
    correctionEvents,
    nonPositiveDwellSampleCount,
    complete: options.complete === true,
    ...(inputs.retardOrCorrection ? { retardOrCorrection: aggregateNumericSamples(inputs.retardOrCorrection, { sampleIndices: indices }) } : {}),
    ...(inputs.dwell ? { dwell: aggregateNumericSamples(inputs.dwell, { sampleIndices: indices }) } : {}),
    ...(inputs.rpm ? { rpm: aggregateNumericSamples(inputs.rpm, { sampleIndices: indices }) } : {}),
    ...(inputs.load ? { load: aggregateNumericSamples(inputs.load, { sampleIndices: indices }) } : {}),
  };
}
