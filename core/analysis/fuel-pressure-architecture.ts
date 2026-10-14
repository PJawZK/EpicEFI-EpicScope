import type { NumericChannelRange } from '../log-model/log-types';
import { aggregateNumericSamples, type NumericAggregationResult } from './numeric-aggregation';
import type { ThresholdEvent } from './specialized-analyzers';

export type FuelPressureArchitecture = 'conventional' | 'gdi';
export type FuelPressureEvidenceQualityState = 'usable' | 'constant' | 'constant-zero' | 'no-valid-samples';

export interface FuelPressureEvidenceQuality {
  readonly state: FuelPressureEvidenceQualityState;
  readonly validSampleCount: number;
  readonly negativeSampleCount: number;
  readonly span?: number;
}

export interface FuelPressureArchitectureInput {
  readonly architecture: FuelPressureArchitecture;
  readonly rpm?: NumericChannelRange;
  readonly lowSidePressure?: NumericChannelRange;
  readonly railDifferential?: NumericChannelRange;
  readonly highSidePressure?: NumericChannelRange;
  readonly sampleIndices: ArrayLike<number>;
  readonly minimumRunningRpm?: number;
  readonly conventionalMinimumDifferential?: number;
  readonly gdiMinimumPressure?: number;
}

export interface FuelPressureArchitectureResult {
  readonly architecture: FuelPressureArchitecture;
  readonly activePressure?: NumericAggregationResult;
  readonly lowSidePressure?: NumericAggregationResult;
  readonly railDifferential?: NumericAggregationResult;
  readonly highSidePressure?: NumericAggregationResult;
  readonly activePressureQuality?: FuelPressureEvidenceQuality;
  readonly lowSidePressureQuality?: FuelPressureEvidenceQuality;
  readonly railDifferentialQuality?: FuelPressureEvidenceQuality;
  readonly highSidePressureQuality?: FuelPressureEvidenceQuality;
  readonly pressureEvents: readonly ThresholdEvent[];
  readonly pressureRole: 'rail-differential' | 'high-side' | 'unavailable';
  readonly threshold?: number;
  readonly minimumRunningRpm?: number;
  readonly pressureQualifiedSampleCount: number;
  readonly excludedByRunningGateCount: number;
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

function pressureQuality(range: NumericChannelRange | undefined, indices: readonly number[]): FuelPressureEvidenceQuality | undefined {
  if (!range) return undefined;
  let validSampleCount = 0;
  let negativeSampleCount = 0;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const sampleIndex of indices) {
    const current = sample(range, sampleIndex);
    if (!current) continue;
    validSampleCount += 1;
    if (current.value < 0) negativeSampleCount += 1;
    min = Math.min(min, current.value);
    max = Math.max(max, current.value);
  }
  if (validSampleCount === 0) return { state: 'no-valid-samples', validSampleCount, negativeSampleCount };
  const span = max - min;
  const magnitude = Math.max(1, Math.abs(min), Math.abs(max));
  const effectivelyConstant = span <= Math.max(1e-6, magnitude * 1e-9);
  const effectivelyZero = Math.max(Math.abs(min), Math.abs(max)) <= 1e-6;
  return {
    state: effectivelyConstant ? (effectivelyZero ? 'constant-zero' : 'constant') : 'usable',
    validSampleCount,
    negativeSampleCount,
    span,
  };
}

function pressureIndices(
  indices: readonly number[],
  rpm: NumericChannelRange | undefined,
  minimumRunningRpm: number | undefined,
): { indices: number[]; excluded: number } {
  if (!rpm || minimumRunningRpm === undefined) return { indices: [...indices], excluded: 0 };
  const result: number[] = [];
  let excluded = 0;
  for (const sampleIndex of indices) {
    const current = sample(rpm, sampleIndex);
    if (current && current.value >= minimumRunningRpm) result.push(sampleIndex);
    else excluded += 1;
  }
  return { indices: result, excluded };
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

function qualityAllowsThresholdEvents(quality: FuelPressureEvidenceQuality | undefined): boolean {
  return quality !== undefined && quality.state !== 'constant-zero' && quality.state !== 'no-valid-samples';
}

export function analyzeFuelPressureArchitecture(input: FuelPressureArchitectureInput): FuelPressureArchitectureResult {
  const indices = Array.from({ length: input.sampleIndices.length }, (_, index) => input.sampleIndices[index]).filter((value): value is number => Number.isSafeInteger(value));
  const minimumRunningRpm = input.minimumRunningRpm;
  if (minimumRunningRpm !== undefined && (!Number.isFinite(minimumRunningRpm) || minimumRunningRpm < 0)) {
    throw new RangeError('Minimum running RPM must be finite and non-negative.');
  }
  const qualified = pressureIndices(indices, input.rpm, minimumRunningRpm);
  const qualifiedIndices = qualified.indices;
  const lowSidePressureQuality = pressureQuality(input.lowSidePressure, qualifiedIndices);
  const railDifferentialQuality = pressureQuality(input.railDifferential, qualifiedIndices);
  const highSidePressureQuality = pressureQuality(input.highSidePressure, qualifiedIndices);
  const common = {
    architecture: input.architecture,
    pressureQualifiedSampleCount: qualifiedIndices.length,
    excludedByRunningGateCount: qualified.excluded,
    ...(minimumRunningRpm !== undefined ? { minimumRunningRpm } : {}),
    ...(input.lowSidePressure ? { lowSidePressure: aggregateNumericSamples(input.lowSidePressure, { sampleIndices: qualifiedIndices }) } : {}),
    ...(input.railDifferential ? { railDifferential: aggregateNumericSamples(input.railDifferential, { sampleIndices: qualifiedIndices }) } : {}),
    ...(input.highSidePressure ? { highSidePressure: aggregateNumericSamples(input.highSidePressure, { sampleIndices: qualifiedIndices }) } : {}),
    ...(lowSidePressureQuality ? { lowSidePressureQuality } : {}),
    ...(railDifferentialQuality ? { railDifferentialQuality } : {}),
    ...(highSidePressureQuality ? { highSidePressureQuality } : {}),
  } as const;

  if (input.architecture === 'gdi') {
    const threshold = input.gdiMinimumPressure;
    const usableActive = input.highSidePressure && qualityAllowsThresholdEvents(highSidePressureQuality);
    return {
      ...common,
      pressureRole: usableActive ? 'high-side' : 'unavailable',
      ...(input.highSidePressure ? { activePressure: aggregateNumericSamples(input.highSidePressure, { sampleIndices: qualifiedIndices }) } : {}),
      ...(highSidePressureQuality ? { activePressureQuality: highSidePressureQuality } : {}),
      ...(threshold !== undefined ? { threshold } : {}),
      pressureEvents: usableActive && threshold !== undefined
        ? belowThresholdEvents(input.highSidePressure!, qualifiedIndices, threshold)
        : [],
    };
  }

  const threshold = input.conventionalMinimumDifferential;
  const usableActive = input.railDifferential && qualityAllowsThresholdEvents(railDifferentialQuality);
  return {
    ...common,
    pressureRole: usableActive ? 'rail-differential' : 'unavailable',
    ...(input.railDifferential ? { activePressure: aggregateNumericSamples(input.railDifferential, { sampleIndices: qualifiedIndices }) } : {}),
    ...(railDifferentialQuality ? { activePressureQuality: railDifferentialQuality } : {}),
    ...(threshold !== undefined ? { threshold } : {}),
    pressureEvents: usableActive && threshold !== undefined
      ? belowThresholdEvents(input.railDifferential!, qualifiedIndices, threshold)
      : [],
  };
}
