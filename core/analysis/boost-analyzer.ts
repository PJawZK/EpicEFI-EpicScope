import type { NumericChannelRange } from '../log-model/log-types';
import {
  aggregateNumericSamples,
  type NumericAggregationResult,
} from './numeric-aggregation';

export interface BoostAnalyzerInputs {
  readonly measuredPressure: NumericChannelRange;
  readonly targetPressure?: NumericChannelRange;
  readonly rpm?: NumericChannelRange;
  readonly tps?: NumericChannelRange;
  readonly upperDuty?: NumericChannelRange;
  readonly lowerDuty?: NumericChannelRange;
}

export interface BoostOperatingPointConfig {
  readonly rpmBinSize: number;
  readonly tpsBinSize: number;
  readonly minimumSamples?: number;
}

export interface BoostOpenLoopSpoolConfig {
  readonly startPressure: number;
  readonly endPressure: number;
  readonly minimumDurationMs?: number;
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
  readonly targetTolerance?: number;
  readonly operatingPoints?: BoostOperatingPointConfig;
  readonly openLoopSpool?: BoostOpenLoopSpoolConfig;
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
  readonly targetTolerance: number | undefined;
  readonly targetAttainmentSampleCount: number | undefined;
  readonly targetAttainmentFraction: number | undefined;
}

export interface BoostOpenLoopSpoolAttainment {
  readonly fraction: 0.1 | 0.5 | 0.9;
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly durationMs: number;
  readonly measuredPressure: number;
  readonly rpm: number | undefined;
  readonly tps: number | undefined;
  readonly upperDuty: number | undefined;
  readonly lowerDuty: number | undefined;
}

export interface BoostOpenLoopSpoolEvent {
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly durationMs: number;
  readonly startPressure: number;
  readonly endPressure: number;
  readonly startRpm: number | undefined;
  readonly endRpm: number | undefined;
  readonly startTps: number | undefined;
  readonly endTps: number | undefined;
  readonly startUpperDuty: number | undefined;
  readonly endUpperDuty: number | undefined;
  readonly startLowerDuty: number | undefined;
  readonly endLowerDuty: number | undefined;
  readonly attainment10: BoostOpenLoopSpoolAttainment | undefined;
  readonly attainment50: BoostOpenLoopSpoolAttainment | undefined;
  readonly attainment90: BoostOpenLoopSpoolAttainment | undefined;
}

export interface BoostSpoolAttainment {
  readonly fraction: 0.1 | 0.5 | 0.9;
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly durationMs: number;
  readonly measuredPressure: number;
  readonly targetPressure: number;
  readonly rpm: number | undefined;
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
  readonly attainment10: BoostSpoolAttainment | undefined;
  readonly attainment50: BoostSpoolAttainment | undefined;
  readonly attainment90: BoostSpoolAttainment | undefined;
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

export interface BoostOperatingPointTrend {
  readonly direction: 'rising' | 'similar' | 'falling';
  readonly pressureDelta: number;
  readonly pressureDeltaFraction: number;
  readonly upperDutyDelta: number | undefined;
  readonly lowerDutyDelta: number | undefined;
}

export interface BoostOperatingPoint {
  readonly rpmStart: number;
  readonly rpmEnd: number;
  readonly tpsStart: number;
  readonly tpsEnd: number;
  readonly sampleCount: number;
  readonly rpmMean: number;
  readonly tpsMean: number;
  readonly pressureMean: number;
  readonly pressureMin: number;
  readonly pressureMax: number;
  readonly pressureStdDev: number;
  readonly upperDutyMean: number | undefined;
  readonly lowerDutyMean: number | undefined;
  readonly pressureVariationFraction: number;
  readonly evidenceQuality: 'strong' | 'moderate' | 'limited';
  readonly pressureConsistency: 'stable' | 'variable' | 'mixed';
  readonly assessment: 'good-comparison' | 'usable-with-care' | 'mixed-transient-likely' | 'limited-evidence';
  readonly rpmTrend: BoostOperatingPointTrend | undefined;
  readonly loadTrend: BoostOperatingPointTrend | undefined;
}

export interface BoostOperatingPointComparison {
  readonly rpmStart: number;
  readonly rpmEnd: number;
  readonly tpsStart: number;
  readonly tpsEnd: number;
  readonly primarySampleCount: number;
  readonly comparisonSampleCount: number;
  readonly primaryPressureMean: number;
  readonly comparisonPressureMean: number;
  readonly pressureDelta: number;
  readonly pressureDeltaFraction: number;
  readonly pressureDirection: 'rising' | 'similar' | 'falling';
  readonly upperDutyDelta: number | undefined;
  readonly lowerDutyDelta: number | undefined;
  readonly interpretation: 'pressure-only' | 'pressure-changed-similar-duty' | 'duty-changed-little-pressure-response' | 'duty-and-pressure-response' | 'similar-duty-and-pressure';
}

export interface BoostDutyResponseSummary {
  readonly chamber: 'upper' | 'lower';
  readonly qualifyingComparisonCount: number;
  readonly otherDutyUnavailableCount: number;
  readonly higherDutyHigherPressureCount: number;
  readonly higherDutyLowerPressureCount: number;
  readonly similarPressureCount: number;
  readonly association: 'insufficient' | 'higher-duty-higher-pressure' | 'higher-duty-lower-pressure' | 'little-pressure-response' | 'mixed';
}

export interface BoostPeakContext {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly pressure: number;
  readonly rpm: number | undefined;
  readonly tps: number | undefined;
  readonly upperDuty: number | undefined;
  readonly lowerDuty: number | undefined;
}

export interface BoostAnalyzerResult {
  readonly inputSampleCount: number;
  readonly measured: NumericAggregationResult;
  readonly target: NumericAggregationResult | undefined;
  readonly tps: NumericAggregationResult | undefined;
  readonly upperDuty: NumericAggregationResult | undefined;
  readonly lowerDuty: NumericAggregationResult | undefined;
  readonly tracking: BoostTrackingStatistics | undefined;
  readonly peak: BoostPeakContext | undefined;
  readonly operatingPoints: readonly BoostOperatingPoint[];
  readonly openLoopSpoolEvents: readonly BoostOpenLoopSpoolEvent[];
  readonly spoolEvents: readonly BoostSpoolEvent[];
  readonly steadyStateWindows: readonly BoostSteadyStateWindow[];
  readonly complete: boolean;
}

interface AlignedValue {
  readonly status: 'valid' | 'invalid' | 'unavailable';
  readonly value?: number;
  readonly timeMs?: number;
}

interface PhysicalBoostSample {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly measured: number;
  readonly rpm: number | undefined;
  readonly tps: number | undefined;
  readonly upperDuty: number | undefined;
  readonly lowerDuty: number | undefined;
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

function buildPhysicalSamples(inputs: BoostAnalyzerInputs, indices: readonly number[]): PhysicalBoostSample[] {
  const samples: PhysicalBoostSample[] = [];
  for (const sampleIndex of indices) {
    const measured = readAligned(inputs.measuredPressure, sampleIndex);
    if (measured.status !== 'valid') continue;
    const rpm = readAligned(inputs.rpm, sampleIndex);
    const tps = readAligned(inputs.tps, sampleIndex);
    const upperDuty = readAligned(inputs.upperDuty, sampleIndex);
    const lowerDuty = readAligned(inputs.lowerDuty, sampleIndex);
    samples.push({
      sampleIndex,
      timeMs: measured.timeMs!,
      measured: measured.value!,
      rpm: rpm.status === 'valid' ? rpm.value : undefined,
      tps: tps.status === 'valid' ? tps.value : undefined,
      upperDuty: upperDuty.status === 'valid' ? upperDuty.value : undefined,
      lowerDuty: lowerDuty.status === 'valid' ? lowerDuty.value : undefined,
    });
  }
  return samples;
}

function validateOpenLoopSpool(config: BoostOpenLoopSpoolConfig | undefined): Required<BoostOpenLoopSpoolConfig> | undefined {
  if (!config) return undefined;
  const minimumDurationMs = config.minimumDurationMs ?? 0;
  if (!Number.isFinite(config.startPressure) || !Number.isFinite(config.endPressure)) throw new RangeError('Open-loop boost spool pressure thresholds must be finite.');
  if (config.endPressure <= config.startPressure) throw new RangeError('Open-loop boost spool endPressure must be greater than startPressure.');
  if (!Number.isFinite(minimumDurationMs) || minimumDurationMs < 0) throw new RangeError('Open-loop boost spool minimumDurationMs must be >= 0.');
  return { ...config, minimumDurationMs };
}

function findOpenLoopSpoolEvents(samples: readonly PhysicalBoostSample[], rawConfig: BoostOpenLoopSpoolConfig | undefined): BoostOpenLoopSpoolEvent[] {
  const config = validateOpenLoopSpool(rawConfig);
  if (!config) return [];
  const events: BoostOpenLoopSpoolEvent[] = [];
  const rise = config.endPressure - config.startPressure;
  const threshold10 = config.startPressure + rise * 0.1;
  const threshold50 = config.startPressure + rise * 0.5;
  const threshold90 = config.startPressure + rise * 0.9;
  let start: PhysicalBoostSample | undefined;
  let previous: PhysicalBoostSample | undefined;
  let attainment10: BoostOpenLoopSpoolAttainment | undefined;
  let attainment50: BoostOpenLoopSpoolAttainment | undefined;
  let attainment90: BoostOpenLoopSpoolAttainment | undefined;

  const reset = (): void => {
    start = undefined;
    attainment10 = undefined;
    attainment50 = undefined;
    attainment90 = undefined;
  };
  const attainment = (sample: PhysicalBoostSample, fraction: 0.1 | 0.5 | 0.9): BoostOpenLoopSpoolAttainment => ({
    fraction,
    sampleIndex: sample.sampleIndex,
    timeMs: sample.timeMs,
    durationMs: sample.timeMs - start!.timeMs,
    measuredPressure: sample.measured,
    rpm: sample.rpm,
    tps: sample.tps,
    upperDuty: sample.upperDuty,
    lowerDuty: sample.lowerDuty,
  });

  for (const sample of samples) {
    if (previous && (sample.sampleIndex !== previous.sampleIndex + 1 || sample.timeMs <= previous.timeMs)) reset();
    if (sample.measured <= config.startPressure) {
      start = sample;
      attainment10 = undefined;
      attainment50 = undefined;
      attainment90 = undefined;
      previous = sample;
      continue;
    }
    if (!start) {
      previous = sample;
      continue;
    }
    if (!attainment10 && sample.measured >= threshold10) attainment10 = attainment(sample, 0.1);
    if (!attainment50 && sample.measured >= threshold50) attainment50 = attainment(sample, 0.5);
    if (!attainment90 && sample.measured >= threshold90) attainment90 = attainment(sample, 0.9);
    if (sample.measured >= config.endPressure) {
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
          startRpm: start.rpm,
          endRpm: sample.rpm,
          startTps: start.tps,
          endTps: sample.tps,
          startUpperDuty: start.upperDuty,
          endUpperDuty: sample.upperDuty,
          startLowerDuty: start.lowerDuty,
          endLowerDuty: sample.lowerDuty,
          attainment10,
          attainment50,
          attainment90,
        });
      }
      reset();
    }
    previous = sample;
  }
  return events;
}

function peakContext(samples: readonly PhysicalBoostSample[]): BoostPeakContext | undefined {
  let peak: PhysicalBoostSample | undefined;
  for (const sample of samples) {
    if (!peak || sample.measured > peak.measured) peak = sample;
  }
  return peak ? {
    sampleIndex: peak.sampleIndex,
    timeMs: peak.timeMs,
    pressure: peak.measured,
    rpm: peak.rpm,
    tps: peak.tps,
    upperDuty: peak.upperDuty,
    lowerDuty: peak.lowerDuty,
  } : undefined;
}

function buildOperatingPoints(samples: readonly PhysicalBoostSample[], rawConfig: BoostOperatingPointConfig | undefined): BoostOperatingPoint[] {
  if (!rawConfig) return [];
  const minimumSamples = rawConfig.minimumSamples ?? 1;
  if (!Number.isFinite(rawConfig.rpmBinSize) || rawConfig.rpmBinSize <= 0) throw new RangeError('Boost operating-point rpmBinSize must be finite and > 0.');
  if (!Number.isFinite(rawConfig.tpsBinSize) || rawConfig.tpsBinSize <= 0) throw new RangeError('Boost operating-point tpsBinSize must be finite and > 0.');
  if (!Number.isSafeInteger(minimumSamples) || minimumSamples < 1) throw new RangeError('Boost operating-point minimumSamples must be an integer >= 1.');

  interface Bucket {
    rpmStart: number; tpsStart: number; count: number; rpmSum: number; tpsSum: number; pressureSum: number; pressureSumSquares: number; pressureMin: number; pressureMax: number; upperSum: number; upperCount: number; lowerSum: number; lowerCount: number;
  }
  const buckets = new Map<string, Bucket>();
  for (const sample of samples) {
    if (sample.rpm === undefined || sample.tps === undefined) continue;
    const rpmStart = Math.floor(sample.rpm / rawConfig.rpmBinSize) * rawConfig.rpmBinSize;
    const tpsStart = Math.floor(sample.tps / rawConfig.tpsBinSize) * rawConfig.tpsBinSize;
    const key = `${rpmStart}|${tpsStart}`;
    const bucket = buckets.get(key) ?? { rpmStart, tpsStart, count: 0, rpmSum: 0, tpsSum: 0, pressureSum: 0, pressureSumSquares: 0, pressureMin: Number.POSITIVE_INFINITY, pressureMax: Number.NEGATIVE_INFINITY, upperSum: 0, upperCount: 0, lowerSum: 0, lowerCount: 0 };
    bucket.count += 1;
    bucket.rpmSum += sample.rpm;
    bucket.tpsSum += sample.tps;
    bucket.pressureSum += sample.measured;
    bucket.pressureSumSquares += sample.measured * sample.measured;
    bucket.pressureMin = Math.min(bucket.pressureMin, sample.measured);
    bucket.pressureMax = Math.max(bucket.pressureMax, sample.measured);
    if (sample.upperDuty !== undefined) { bucket.upperSum += sample.upperDuty; bucket.upperCount += 1; }
    if (sample.lowerDuty !== undefined) { bucket.lowerSum += sample.lowerDuty; bucket.lowerCount += 1; }
    buckets.set(key, bucket);
  }

  const points = [...buckets.values()]
    .filter((bucket) => bucket.count >= minimumSamples)
    .sort((left, right) => left.rpmStart - right.rpmStart || left.tpsStart - right.tpsStart)
    .map((bucket) => {
      const pressureMean = bucket.pressureSum / bucket.count;
      const variance = Math.max(0, bucket.pressureSumSquares / bucket.count - pressureMean * pressureMean);
      const pressureStdDev = Math.sqrt(variance);
      const pressureVariationFraction = pressureStdDev / Math.max(Math.abs(pressureMean), Number.EPSILON);
      const evidenceQuality: BoostOperatingPoint['evidenceQuality'] = bucket.count >= minimumSamples * 3
        ? 'strong'
        : bucket.count >= minimumSamples * 2 ? 'moderate' : 'limited';
      const pressureConsistency: BoostOperatingPoint['pressureConsistency'] = pressureVariationFraction <= 0.03
        ? 'stable'
        : pressureVariationFraction <= 0.08 ? 'variable' : 'mixed';
      const assessment: BoostOperatingPoint['assessment'] = pressureConsistency === 'mixed'
        ? 'mixed-transient-likely'
        : evidenceQuality === 'limited'
          ? 'limited-evidence'
          : pressureConsistency === 'stable' && evidenceQuality === 'strong'
            ? 'good-comparison'
            : 'usable-with-care';
      return {
        rpmStart: bucket.rpmStart,
        rpmEnd: bucket.rpmStart + rawConfig.rpmBinSize,
        tpsStart: bucket.tpsStart,
        tpsEnd: bucket.tpsStart + rawConfig.tpsBinSize,
        sampleCount: bucket.count,
        rpmMean: bucket.rpmSum / bucket.count,
        tpsMean: bucket.tpsSum / bucket.count,
        pressureMean,
        pressureMin: bucket.pressureMin,
        pressureMax: bucket.pressureMax,
        pressureStdDev,
        pressureVariationFraction,
        evidenceQuality,
        pressureConsistency,
        assessment,
        upperDutyMean: bucket.upperCount > 0 ? bucket.upperSum / bucket.upperCount : undefined,
        lowerDutyMean: bucket.lowerCount > 0 ? bucket.lowerSum / bucket.lowerCount : undefined,
        rpmTrend: undefined,
        loadTrend: undefined,
      };
    });

  const byKey = new Map(points.map((point) => [`${point.rpmStart}|${point.tpsStart}`, point]));
  const canCompare = (point: BoostOperatingPoint): boolean => point.assessment !== 'mixed-transient-likely' && point.assessment !== 'limited-evidence';
  const trendFrom = (current: BoostOperatingPoint, previous: BoostOperatingPoint | undefined): BoostOperatingPointTrend | undefined => {
    if (!previous || !canCompare(current) || !canCompare(previous)) return undefined;
    const pressureDelta = current.pressureMean - previous.pressureMean;
    const scale = Math.max((Math.abs(current.pressureMean) + Math.abs(previous.pressureMean)) / 2, Number.EPSILON);
    const pressureDeltaFraction = pressureDelta / scale;
    return {
      direction: pressureDeltaFraction > 0.02 ? 'rising' : pressureDeltaFraction < -0.02 ? 'falling' : 'similar',
      pressureDelta,
      pressureDeltaFraction,
      upperDutyDelta: current.upperDutyMean !== undefined && previous.upperDutyMean !== undefined ? current.upperDutyMean - previous.upperDutyMean : undefined,
      lowerDutyDelta: current.lowerDutyMean !== undefined && previous.lowerDutyMean !== undefined ? current.lowerDutyMean - previous.lowerDutyMean : undefined,
    };
  };

  return points.map((point) => ({
    ...point,
    rpmTrend: trendFrom(point, byKey.get(`${point.rpmStart - rawConfig.rpmBinSize}|${point.tpsStart}`)),
    loadTrend: trendFrom(point, byKey.get(`${point.rpmStart}|${point.tpsStart - rawConfig.tpsBinSize}`)),
  }));
}

export function compareBoostOperatingPoints(
  primary: readonly BoostOperatingPoint[],
  comparison: readonly BoostOperatingPoint[],
): BoostOperatingPointComparison[] {
  const trustworthy = (point: BoostOperatingPoint): boolean => point.assessment !== 'mixed-transient-likely' && point.assessment !== 'limited-evidence';
  const comparisonByKey = new Map(comparison.map((point) => [`${point.rpmStart}|${point.tpsStart}`, point]));
  const results: BoostOperatingPointComparison[] = [];
  for (const first of primary) {
    const second = comparisonByKey.get(`${first.rpmStart}|${first.tpsStart}`);
    if (!second || !trustworthy(first) || !trustworthy(second)) continue;
    const pressureDelta = second.pressureMean - first.pressureMean;
    const pressureScale = Math.max((Math.abs(first.pressureMean) + Math.abs(second.pressureMean)) / 2, Number.EPSILON);
    const pressureDeltaFraction = pressureDelta / pressureScale;
    const pressureDirection: BoostOperatingPointComparison['pressureDirection'] = pressureDeltaFraction > 0.02 ? 'rising' : pressureDeltaFraction < -0.02 ? 'falling' : 'similar';
    const upperDutyDelta = first.upperDutyMean !== undefined && second.upperDutyMean !== undefined ? second.upperDutyMean - first.upperDutyMean : undefined;
    const lowerDutyDelta = first.lowerDutyMean !== undefined && second.lowerDutyMean !== undefined ? second.lowerDutyMean - first.lowerDutyMean : undefined;
    const dutyDeltas = [upperDutyDelta, lowerDutyDelta].filter((value): value is number => value !== undefined);
    const dutyChanged = dutyDeltas.some((value) => Math.abs(value) >= 0.5);
    const interpretation: BoostOperatingPointComparison['interpretation'] = dutyDeltas.length === 0
      ? 'pressure-only'
      : !dutyChanged && pressureDirection !== 'similar'
        ? 'pressure-changed-similar-duty'
        : dutyChanged && pressureDirection === 'similar'
          ? 'duty-changed-little-pressure-response'
          : dutyChanged
            ? 'duty-and-pressure-response'
            : 'similar-duty-and-pressure';
    results.push({
      rpmStart: first.rpmStart,
      rpmEnd: first.rpmEnd,
      tpsStart: first.tpsStart,
      tpsEnd: first.tpsEnd,
      primarySampleCount: first.sampleCount,
      comparisonSampleCount: second.sampleCount,
      primaryPressureMean: first.pressureMean,
      comparisonPressureMean: second.pressureMean,
      pressureDelta,
      pressureDeltaFraction,
      pressureDirection,
      upperDutyDelta,
      lowerDutyDelta,
      interpretation,
    });
  }
  return results;
}

export function summarizeBoostDutyResponse(
  comparisons: readonly BoostOperatingPointComparison[],
  chamber: 'upper' | 'lower',
  minimumDutyDelta = 0.5,
): BoostDutyResponseSummary {
  if (!Number.isFinite(minimumDutyDelta) || minimumDutyDelta < 0) throw new RangeError('Boost duty response minimumDutyDelta must be finite and >= 0.');
  let qualifyingComparisonCount = 0;
  let otherDutyUnavailableCount = 0;
  let higherDutyHigherPressureCount = 0;
  let higherDutyLowerPressureCount = 0;
  let similarPressureCount = 0;
  for (const comparison of comparisons) {
    const selectedDelta = chamber === 'upper' ? comparison.upperDutyDelta : comparison.lowerDutyDelta;
    const otherDelta = chamber === 'upper' ? comparison.lowerDutyDelta : comparison.upperDutyDelta;
    if (selectedDelta === undefined || Math.abs(selectedDelta) < minimumDutyDelta) continue;
    if (otherDelta !== undefined && Math.abs(otherDelta) >= minimumDutyDelta) continue;
    qualifyingComparisonCount += 1;
    if (otherDelta === undefined) otherDutyUnavailableCount += 1;
    if (comparison.pressureDirection === 'similar') {
      similarPressureCount += 1;
      continue;
    }
    const higherDuty = selectedDelta > 0;
    const higherPressure = comparison.pressureDelta > 0;
    if (higherDuty === higherPressure) higherDutyHigherPressureCount += 1;
    else higherDutyLowerPressureCount += 1;
  }
  let association: BoostDutyResponseSummary['association'] = 'insufficient';
  if (qualifyingComparisonCount >= 2) {
    if (similarPressureCount / qualifyingComparisonCount >= 0.6) association = 'little-pressure-response';
    else if (higherDutyHigherPressureCount / qualifyingComparisonCount >= 0.7) association = 'higher-duty-higher-pressure';
    else if (higherDutyLowerPressureCount / qualifyingComparisonCount >= 0.7) association = 'higher-duty-lower-pressure';
    else association = 'mixed';
  }
  return {
    chamber,
    qualifyingComparisonCount,
    otherDutyUnavailableCount,
    higherDutyHigherPressureCount,
    higherDutyLowerPressureCount,
    similarPressureCount,
    association,
  };
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

function trackingStatistics(samples: readonly TrackingSample[], invalid: number, unavailable: number, targetTolerance: number | undefined): BoostTrackingStatistics {
  if (targetTolerance !== undefined && (!Number.isFinite(targetTolerance) || targetTolerance < 0)) throw new RangeError('Boost targetTolerance must be finite and >= 0 when provided.');
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
      targetTolerance,
      targetAttainmentSampleCount: targetTolerance === undefined ? undefined : 0,
      targetAttainmentFraction: targetTolerance === undefined ? undefined : 0,
    };
  }
  let sum = 0;
  let sumAbs = 0;
  let sumSquares = 0;
  let maxOvershoot = Number.NEGATIVE_INFINITY;
  let maxUndershoot = Number.POSITIVE_INFINITY;
  let targetAttainmentSampleCount = 0;
  for (const sample of samples) {
    sum += sample.error;
    sumAbs += Math.abs(sample.error);
    sumSquares += sample.error * sample.error;
    if (sample.error > 0) maxOvershoot = Math.max(maxOvershoot, sample.error);
    if (sample.error < 0) maxUndershoot = Math.min(maxUndershoot, sample.error);
    if (targetTolerance !== undefined && Math.abs(sample.error) <= targetTolerance) targetAttainmentSampleCount += 1;
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
    targetTolerance,
    targetAttainmentSampleCount: targetTolerance === undefined ? undefined : targetAttainmentSampleCount,
    targetAttainmentFraction: targetTolerance === undefined ? undefined : targetAttainmentSampleCount / samples.length,
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
  let attainment10: BoostSpoolAttainment | undefined;
  let attainment50: BoostSpoolAttainment | undefined;
  let attainment90: BoostSpoolAttainment | undefined;

  const reset = (): void => {
    start = undefined;
    attainment10 = undefined;
    attainment50 = undefined;
    attainment90 = undefined;
  };

  const attainment = (sample: TrackingSample, fraction: 0.1 | 0.5 | 0.9): BoostSpoolAttainment => ({
    fraction,
    sampleIndex: sample.sampleIndex,
    timeMs: sample.timeMs,
    durationMs: sample.timeMs - start!.timeMs,
    measuredPressure: sample.measured,
    targetPressure: sample.target,
    rpm: sample.rpm,
  });

  for (const sample of samples) {
    if (!start) {
      if (sample.target >= config.minimumTargetPressure && sample.measured <= config.startPressure) {
        start = sample;
        if (sample.measured >= sample.target * 0.1) attainment10 = attainment(sample, 0.1);
        if (sample.measured >= sample.target * 0.5) attainment50 = attainment(sample, 0.5);
        if (sample.measured >= sample.target * 0.9) attainment90 = attainment(sample, 0.9);
      }
      continue;
    }
    if (sample.target < config.minimumTargetPressure || sample.timeMs < start.timeMs) {
      reset();
      continue;
    }
    if (!attainment10 && sample.measured >= sample.target * 0.1) attainment10 = attainment(sample, 0.1);
    if (!attainment50 && sample.measured >= sample.target * 0.5) attainment50 = attainment(sample, 0.5);
    if (!attainment90 && sample.measured >= sample.target * 0.9) attainment90 = attainment(sample, 0.9);
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
        attainment10,
        attainment50,
        attainment90,
      });
    }
    reset();
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
  const tps = aggregateFor(inputs.tps, indices);
  const upperDuty = aggregateFor(inputs.upperDuty, indices);
  const lowerDuty = aggregateFor(inputs.lowerDuty, indices);
  const physicalSamples = buildPhysicalSamples(inputs, indices);
  const peak = peakContext(physicalSamples);
  const operatingPoints = buildOperatingPoints(physicalSamples, options.operatingPoints);
  const aligned = buildTrackingSamples(inputs, indices);
  const tracking = inputs.targetPressure ? trackingStatistics(aligned.samples, aligned.invalid, aligned.unavailable, options.targetTolerance) : undefined;
  const openLoopSpoolEvents = findOpenLoopSpoolEvents(physicalSamples, options.openLoopSpool);
  const spoolEvents = inputs.targetPressure ? findSpoolEvents(aligned.samples, options.spool) : [];
  const steadyStateWindows = inputs.targetPressure ? findSteadyStateWindows(aligned.samples, options.steadyState) : [];

  const aggregates = [measured, target, tps, upperDuty, lowerDuty].filter((value): value is NumericAggregationResult => value !== undefined);
  return {
    inputSampleCount: indices.length,
    measured,
    target,
    tps,
    upperDuty,
    lowerDuty,
    tracking,
    peak,
    operatingPoints,
    openLoopSpoolEvents,
    spoolEvents,
    steadyStateWindows,
    complete: options.complete === true
      && aggregates.every((aggregate) => aggregate.unavailableSampleCount === 0)
      && (tracking?.unavailableSampleCount ?? 0) === 0,
  };
}
