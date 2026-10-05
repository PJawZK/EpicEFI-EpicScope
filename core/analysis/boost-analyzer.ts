import type { NumericChannelRange } from '../log-model/log-types';
import {
  aggregateNumericSamples,
  type NumericAggregationResult,
} from './numeric-aggregation';

export interface BoostAnalyzerInputs {
  readonly measuredPressure: NumericChannelRange;
  readonly targetPressure?: NumericChannelRange;
  readonly rpm?: NumericChannelRange;
  readonly upperDuty?: NumericChannelRange;
  readonly lowerDuty?: NumericChannelRange;
}

export interface BoostSpoolConfig {
  readonly startPressure: number;
  readonly minimumTargetPressure: number;
  readonly completionFraction?: number;
  readonly minimumDurationMs?: number;
}

export interface BoostSteadyStateConfig {
  readonly maxTargetRatePerSecond: number;
  readonly maxMeasuredRatePerSecond?: number;
  readonly minimumDurationMs: number;
}

export interface BoostAnalyzerOptions {
  readonly sampleIndices?: ArrayLike<number>;
  readonly complete?: boolean;
  readonly spool?: BoostSpoolConfig;
  readonly steadyState?: BoostSteadyStateConfig;
}

export interface BoostTrackingStatistics {
  readonly sampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly meanError: number | undefined;
  readonly meanAbsoluteError: number | undefined;
  readonly rootMeanSquareError: number | undefined;
  readonly maxOvershoot: number | undefined;
  readonly maxUndershoot: number | undefined;
}

export interface BoostSpoolEvent {
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly durationMs: number;
  readonly startPressure: number;
  readonly endPressure: number;
  readonly endTargetPressure: number;
  readonly startRpm: number | undefined;
  readonly endRpm: number | undefined;
}

export interface BoostSteadyStateWindow {
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly durationMs: number;
  readonly sampleCount: number;
  readonly meanTargetPressure: number;
  readonly meanMeasuredPressure: number;
  readonly meanError: number;
  readonly maxOvershoot: number | undefined;
  readonly maxUndershoot: number | undefined;
}

export interface BoostAnalyzerResult {
  readonly inputSampleCount: number;
  readonly measured: NumericAggregationResult;
  readonly target: NumericAggregationResult | undefined;
  readonly upperDuty: NumericAggregationResult | undefined;
  readonly lowerDuty: NumericAggregationResult | undefined;
  readonly tracking: BoostTrackingStatistics | undefined;
  readonly spoolEvents: readonly BoostSpoolEvent[];
  readonly steadyStateWindows: readonly BoostSteadyStateWindow[];
  readonly complete: boolean;
}

interface AlignedValue {
  readonly status: 'valid' | 'invalid' | 'unavailable';
  readonly value?: number;
  readonly timeMs?: number;
}

interface TrackingSample {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly measured: number;
  readonly target: number;
  readonly error: number;
  readonly rpm: number | undefined;
}

function selectedSampleIndices(reference: NumericChannelRange, indices?: ArrayLike<number>): number[] {
  if (!indices) {
    return Array.from({ length: reference.values.length }, (_, index) => reference.startSampleIndex + index);
  }
  const unique = new Set<number>();
  for (let index = 0; index < indices.length; index += 1) {
    const value = indices[index];
    if (value !== undefined && Number.isSafeInteger(value)) unique.add(value);
  }
  return [...unique].sort((a, b) => a - b);
}

function readAligned(range: NumericChannelRange | undefined, sampleIndex: number): AlignedValue {
  if (!range) return { status: 'unavailable' };
  const local = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(local) || local < 0 || local >= range.values.length || local >= range.validity.length || local >= range.timeMs.length) {
    return { status: 'unavailable' };
  }
  const value = range.values[local];
  const timeMs = range.timeMs[local];
  if (range.validity[local] !== 1 || value === undefined || timeMs === undefined || !Number.isFinite(value) || !Number.isFinite(timeMs)) {
    return { status: 'invalid' };
  }
  return { status: 'valid', value, timeMs };
}

function aggregateFor(range: NumericChannelRange | undefined, indices: readonly number[]): NumericAggregationResult | undefined {
  return range ? aggregateNumericSamples(range, { sampleIndices: indices }) : undefined;
}

function buildTrackingSamples(
  inputs: BoostAnalyzerInputs,
  indices: readonly number[],
): { samples: TrackingSample[]; invalid: number; unavailable: number } {
  const samples: TrackingSample[] = [];
  let invalid = 0;
  let unavailable = 0;
  if (!inputs.targetPressure) return { samples, invalid, unavailable };

  for (const sampleIndex of indices) {
    const measured = readAligned(inputs.measuredPressure, sampleIndex);
    const target = readAligned(inputs.targetPressure, sampleIndex);
    if (measured.status === 'unavailable' || target.status === 'unavailable') {
      unavailable += 1;
      continue;
    }
    if (measured.status === 'invalid' || target.status === 'invalid') {
      invalid += 1;
      continue;
    }
    const rpmValue = readAligned(inputs.rpm, sampleIndex);
    samples.push({
      sampleIndex,
      timeMs: measured.timeMs!,
      measured: measured.value!,
      target: target.value!,
      error: measured.value! - target.value!,
      rpm: rpmValue.status === 'valid' ? rpmValue.value : undefined,
    });
  }
  return { samples, invalid, unavailable };
}

function trackingStatistics(samples: readonly TrackingSample[], invalid: number, unavailable: number): BoostTrackingStatistics {
  if (samples.length === 0) {
    return {
      sampleCount: 0,
      invalidSampleCount: invalid,
      unavailableSampleCount: unavailable,
      meanError: undefined,
      meanAbsoluteError: undefined,
      rootMeanSquareError: undefined,
      maxOvershoot: undefined,
      maxUndershoot: undefined,
    };
  }
  let sum = 0;
  let sumAbs = 0;
  let sumSquares = 0;
  let maxOvershoot = Number.NEGATIVE_INFINITY;
  let maxUndershoot = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    sum += sample.error;
    sumAbs += Math.abs(sample.error);
    sumSquares += sample.error * sample.error;
    if (sample.error > 0) maxOvershoot = Math.max(maxOvershoot, sample.error);
    if (sample.error < 0) maxUndershoot = Math.min(maxUndershoot, sample.error);
  }
  return {
    sampleCount: samples.length,
    invalidSampleCount: invalid,
    unavailableSampleCount: unavailable,
    meanError: sum / samples.length,
    meanAbsoluteError: sumAbs / samples.length,
    rootMeanSquareError: Math.sqrt(sumSquares / samples.length),
    maxOvershoot: Number.isFinite(maxOvershoot) ? maxOvershoot : undefined,
    maxUndershoot: Number.isFinite(maxUndershoot) ? maxUndershoot : undefined,
  };
}

function validateSpool(config: BoostSpoolConfig | undefined): Required<BoostSpoolConfig> | undefined {
  if (!config) return undefined;
  const completionFraction = config.completionFraction ?? 0.9;
  const minimumDurationMs = config.minimumDurationMs ?? 0;
  if (!Number.isFinite(config.startPressure) || !Number.isFinite(config.minimumTargetPressure)) throw new RangeError('Boost spool pressure thresholds must be finite.');
  if (!Number.isFinite(completionFraction) || completionFraction <= 0 || completionFraction > 1) throw new RangeError('Boost spool completionFraction must be > 0 and <= 1.');
  if (!Number.isFinite(minimumDurationMs) || minimumDurationMs < 0) throw new RangeError('Boost spool minimumDurationMs must be >= 0.');
  return { ...config, completionFraction, minimumDurationMs };
}

function findSpoolEvents(samples: readonly TrackingSample[], rawConfig: BoostSpoolConfig | undefined): BoostSpoolEvent[] {
  const config = validateSpool(rawConfig);
  if (!config) return [];
  const events: BoostSpoolEvent[] = [];
  let start: TrackingSample | undefined;

  for (const sample of samples) {
    if (!start) {
      if (sample.target >= config.minimumTargetPressure && sample.measured <= config.startPressure) start = sample;
      continue;
    }
    if (sample.target < config.minimumTargetPressure || sample.timeMs < start.timeMs) {
      start = undefined;
      continue;
    }
    if (sample.measured < sample.target * config.completionFraction) continue;
    const durationMs = sample.timeMs - start.timeMs;
    if (durationMs >= config.minimumDurationMs) {
      events.push({
        startSampleIndex: start.sampleIndex,
        endSampleIndex: sample.sampleIndex,
        startTimeMs: start.timeMs,
        endTimeMs: sample.timeMs,
        durationMs,
        startPressure: start.measured,
        endPressure: sample.measured,
        endTargetPressure: sample.target,
        startRpm: start.rpm,
        endRpm: sample.rpm,
      });
    }
    start = undefined;
  }
  return events;
}

function validateSteady(config: BoostSteadyStateConfig | undefined): BoostSteadyStateConfig | undefined {
  if (!config) return undefined;
  if (!Number.isFinite(config.maxTargetRatePerSecond) || config.maxTargetRatePerSecond < 0) throw new RangeError('Boost steady-state maxTargetRatePerSecond must be >= 0.');
  if (config.maxMeasuredRatePerSecond !== undefined && (!Number.isFinite(config.maxMeasuredRatePerSecond) || config.maxMeasuredRatePerSecond < 0)) throw new RangeError('Boost steady-state maxMeasuredRatePerSecond must be >= 0 when provided.');
  if (!Number.isFinite(config.minimumDurationMs) || config.minimumDurationMs < 0) throw new RangeError('Boost steady-state minimumDurationMs must be >= 0.');
  return config;
}

function summarizeSteadySegment(samples: readonly TrackingSample[]): BoostSteadyStateWindow | undefined {
  if (samples.length === 0) return undefined;
  const start = samples[0]!;
  const end = samples[samples.length - 1]!;
  let measured = 0;
  let target = 0;
  let error = 0;
  let over = Number.NEGATIVE_INFINITY;
  let under = Number.POSITIVE_INFINITY;
  for (const sample of samples) {
    measured += sample.measured;
    target += sample.target;
    error += sample.error;
    if (sample.error > 0) over = Math.max(over, sample.error);
    if (sample.error < 0) under = Math.min(under, sample.error);
  }
  return {
    startSampleIndex: start.sampleIndex,
    endSampleIndex: end.sampleIndex,
    startTimeMs: start.timeMs,
    endTimeMs: end.timeMs,
    durationMs: end.timeMs - start.timeMs,
    sampleCount: samples.length,
    meanTargetPressure: target / samples.length,
    meanMeasuredPressure: measured / samples.length,
    meanError: error / samples.length,
    maxOvershoot: Number.isFinite(over) ? over : undefined,
    maxUndershoot: Number.isFinite(under) ? under : undefined,
  };
}

function findSteadyStateWindows(samples: readonly TrackingSample[], rawConfig: BoostSteadyStateConfig | undefined): BoostSteadyStateWindow[] {
  const config = validateSteady(rawConfig);
  if (!config || samples.length < 2) return [];
  const windows: BoostSteadyStateWindow[] = [];
  let segment: TrackingSample[] = [];

  const flush = (): void => {
    const summary = summarizeSteadySegment(segment);
    if (summary && summary.durationMs >= config.minimumDurationMs) windows.push(summary);
    segment = [];
  };

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    const dtMs = current.timeMs - previous.timeMs;
    const contiguous = current.sampleIndex === previous.sampleIndex + 1;
    if (!contiguous || dtMs <= 0) {
      flush();
      continue;
    }
    const seconds = dtMs / 1000;
    const targetRate = Math.abs(current.target - previous.target) / seconds;
    const measuredRate = Math.abs(current.measured - previous.measured) / seconds;
    const steady = targetRate <= config.maxTargetRatePerSecond
      && (config.maxMeasuredRatePerSecond === undefined || measuredRate <= config.maxMeasuredRatePerSecond);
    if (!steady) {
      flush();
      continue;
    }
    if (segment.length === 0) segment.push(previous);
    segment.push(current);
  }
  flush();
  return windows;
}

export function analyzeBoost(
  inputs: BoostAnalyzerInputs,
  options: BoostAnalyzerOptions = {},
): BoostAnalyzerResult {
  const indices = selectedSampleIndices(inputs.measuredPressure, options.sampleIndices);
  const measured = aggregateNumericSamples(inputs.measuredPressure, { sampleIndices: indices });
  const target = aggregateFor(inputs.targetPressure, indices);
  const upperDuty = aggregateFor(inputs.upperDuty, indices);
  const lowerDuty = aggregateFor(inputs.lowerDuty, indices);
  const aligned = buildTrackingSamples(inputs, indices);
  const tracking = inputs.targetPressure ? trackingStatistics(aligned.samples, aligned.invalid, aligned.unavailable) : undefined;
  const spoolEvents = inputs.targetPressure ? findSpoolEvents(aligned.samples, options.spool) : [];
  const steadyStateWindows = inputs.targetPressure ? findSteadyStateWindows(aligned.samples, options.steadyState) : [];

  const aggregates = [measured, target, upperDuty, lowerDuty].filter((value): value is NumericAggregationResult => value !== undefined);
  return {
    inputSampleCount: indices.length,
    measured,
    target,
    upperDuty,
    lowerDuty,
    tracking,
    spoolEvents,
    steadyStateWindows,
    complete: options.complete === true
      && aggregates.every((aggregate) => aggregate.unavailableSampleCount === 0)
      && (tracking?.unavailableSampleCount ?? 0) === 0,
  };
}
