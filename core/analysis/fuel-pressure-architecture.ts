import type { NumericChannelRange } from '../log-model/log-types';
import { aggregateNumericSamples, type NumericAggregationResult } from './numeric-aggregation';
import type { ThresholdEvent } from './specialized-analyzers';

export type FuelPressureArchitecture = 'conventional' | 'gdi';

export interface FuelPressureArchitectureInput {
  readonly architecture: FuelPressureArchitecture;
  readonly lowSidePressure?: NumericChannelRange;
  readonly railDifferential?: NumericChannelRange;
  readonly highSidePressure?: NumericChannelRange;
  readonly sampleIndices: ArrayLike<number>;
  readonly conventionalMinimumDifferential?: number;
  readonly gdiMinimumPressure?: number;
}

export interface FuelPressureArchitectureResult {
  readonly architecture: FuelPressureArchitecture;
  readonly activePressure?: NumericAggregationResult;
  readonly lowSidePressure?: NumericAggregationResult;
  readonly railDifferential?: NumericAggregationResult;
  readonly highSidePressure?: NumericAggregationResult;
  readonly pressureEvents: readonly ThresholdEvent[];
  readonly pressureRole: 'rail-differential' | 'high-side' | 'unavailable';
  readonly threshold?: number;
}

interface SampleValue {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly value: number;
}

function sample(range: NumericChannelRange, sampleIndex: number): SampleValue | undefined {
  const index = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(index) || index < 0 || index >= range.values.length || index >= range.validity.length) return undefined;
  if (range.validity[index] !== 1) return undefined;
  const value = range.values[index];
  const timeMs = range.timeMs[index];
  if (value === undefined || timeMs === undefined || !Number.isFinite(value) || !Number.isFinite(timeMs)) return undefined;
  return { sampleIndex, timeMs, value };
}

function belowThresholdEvents(range: NumericChannelRange, indices: readonly number[], threshold: number): ThresholdEvent[] {
  const events: ThresholdEvent[] = [];
  let first: SampleValue | undefined;
  let last: SampleValue | undefined;
  let minimum: SampleValue | undefined;

  const finish = (): void => {
    if (!first || !last || !minimum) return;
    events.push({
      startSampleIndex: first.sampleIndex,
      endSampleIndex: last.sampleIndex,
      startTimeMs: first.timeMs,
      endTimeMs: last.timeMs,
      durationMs: last.timeMs - first.timeMs,
      sampleCount: last.sampleIndex - first.sampleIndex + 1,
      extremeValue: minimum.value,
      extremeSampleIndex: minimum.sampleIndex,
      extremeTimeMs: minimum.timeMs,
    });
    first = undefined;
    last = undefined;
    minimum = undefined;
  };

  for (const index of indices) {
    const current = sample(range, index);
    const qualifying = current && current.value < threshold;
    const continuous = !last || current?.sampleIndex === last.sampleIndex + 1;
    if (!qualifying || !continuous) {
      finish();
      if (!qualifying) continue;
    }
    if (!first) first = current;
    last = current;
    if (!minimum || current.value < minimum.value) minimum = current;
  }
  finish();
  return events;
}

export function analyzeFuelPressureArchitecture(input: FuelPressureArchitectureInput): FuelPressureArchitectureResult {
  const indices = Array.from({ length: input.sampleIndices.length }, (_, index) => input.sampleIndices[index]).filter((value): value is number => Number.isSafeInteger(value));
  const common = {
    architecture: input.architecture,
    ...(input.lowSidePressure ? { lowSidePressure: aggregateNumericSamples(input.lowSidePressure, { sampleIndices: indices }) } : {}),
    ...(input.railDifferential ? { railDifferential: aggregateNumericSamples(input.railDifferential, { sampleIndices: indices }) } : {}),
    ...(input.highSidePressure ? { highSidePressure: aggregateNumericSamples(input.highSidePressure, { sampleIndices: indices }) } : {}),
  } as const;

  if (input.architecture === 'gdi') {
    const threshold = input.gdiMinimumPressure;
    return {
      ...common,
      pressureRole: input.highSidePressure ? 'high-side' : 'unavailable',
      ...(input.highSidePressure ? { activePressure: aggregateNumericSamples(input.highSidePressure, { sampleIndices: indices }) } : {}),
      ...(threshold !== undefined ? { threshold } : {}),
      pressureEvents: input.highSidePressure && threshold !== undefined
        ? belowThresholdEvents(input.highSidePressure, indices, threshold)
        : [],
    };
  }

  const threshold = input.conventionalMinimumDifferential;
  return {
    ...common,
    pressureRole: input.railDifferential ? 'rail-differential' : 'unavailable',
    ...(input.railDifferential ? { activePressure: aggregateNumericSamples(input.railDifferential, { sampleIndices: indices }) } : {}),
    ...(threshold !== undefined ? { threshold } : {}),
    pressureEvents: input.railDifferential && threshold !== undefined
      ? belowThresholdEvents(input.railDifferential, indices, threshold)
      : [],
  };
}
