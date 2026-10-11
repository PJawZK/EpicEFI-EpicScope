import type { NumericChannelRange } from '../log-model/log-types';

export interface BoostPullDetectorInputs {
  readonly measuredPressure: NumericChannelRange;
  readonly rpm: NumericChannelRange;
  readonly load: NumericChannelRange;
  readonly upperDuty?: NumericChannelRange;
  readonly lowerDuty?: NumericChannelRange;
}

export interface BoostPullDetectionConfig {
  readonly startMinimumLoad: number;
  readonly releaseMinimumLoad?: number;
  readonly startMinimumRpm: number;
  readonly releaseMinimumRpm?: number;
  readonly minimumDurationMs?: number;
  readonly minimumSamples?: number;
}

export interface BoostDetectedPull {
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly durationMs: number;
  readonly sampleCount: number;
  readonly startRpm: number;
  readonly endRpm: number;
  readonly minimumRpm: number;
  readonly maximumRpm: number;
  readonly meanRpm: number;
  readonly startLoad: number;
  readonly endLoad: number;
  readonly minimumLoad: number;
  readonly maximumLoad: number;
  readonly meanLoad: number;
  readonly startPressure: number;
  readonly endPressure: number;
  readonly minimumPressure: number;
  readonly maximumPressure: number;
  readonly meanPressure: number;
  readonly meanUpperDuty: number | undefined;
  readonly meanLowerDuty: number | undefined;
}

interface PullSample {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly pressure: number;
  readonly rpm: number;
  readonly load: number;
  readonly upperDuty: number | undefined;
  readonly lowerDuty: number | undefined;
}

interface AlignedValue {
  readonly status: 'valid' | 'invalid' | 'unavailable';
  readonly value?: number;
  readonly timeMs?: number;
}

interface NormalizedBoostPullDetectionConfig {
  readonly startMinimumLoad: number;
  readonly releaseMinimumLoad: number;
  readonly startMinimumRpm: number;
  readonly releaseMinimumRpm: number;
  readonly minimumDurationMs: number;
  readonly minimumSamples: number;
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
  return [...unique].sort((left, right) => left - right);
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

function normalizeConfig(config: BoostPullDetectionConfig): NormalizedBoostPullDetectionConfig {
  const releaseMinimumLoad = config.releaseMinimumLoad ?? config.startMinimumLoad;
  const releaseMinimumRpm = config.releaseMinimumRpm ?? config.startMinimumRpm;
  const minimumDurationMs = config.minimumDurationMs ?? 0;
  const minimumSamples = config.minimumSamples ?? 2;

  for (const value of [config.startMinimumLoad, releaseMinimumLoad, config.startMinimumRpm, releaseMinimumRpm, minimumDurationMs]) {
    if (!Number.isFinite(value)) throw new RangeError('Boost pull thresholds and duration must be finite.');
  }
  if (releaseMinimumLoad > config.startMinimumLoad) throw new RangeError('Boost pull releaseMinimumLoad must be <= startMinimumLoad.');
  if (releaseMinimumRpm > config.startMinimumRpm) throw new RangeError('Boost pull releaseMinimumRpm must be <= startMinimumRpm.');
  if (minimumDurationMs < 0) throw new RangeError('Boost pull minimumDurationMs must be >= 0.');
  if (!Number.isSafeInteger(minimumSamples) || minimumSamples < 1) throw new RangeError('Boost pull minimumSamples must be an integer >= 1.');

  return {
    startMinimumLoad: config.startMinimumLoad,
    releaseMinimumLoad,
    startMinimumRpm: config.startMinimumRpm,
    releaseMinimumRpm,
    minimumDurationMs,
    minimumSamples,
  };
}

function alignedPullSample(inputs: BoostPullDetectorInputs, sampleIndex: number): PullSample | undefined {
  const pressure = readAligned(inputs.measuredPressure, sampleIndex);
  const rpm = readAligned(inputs.rpm, sampleIndex);
  const load = readAligned(inputs.load, sampleIndex);
  if (pressure.status !== 'valid' || rpm.status !== 'valid' || load.status !== 'valid') return undefined;

  const upperDuty = readAligned(inputs.upperDuty, sampleIndex);
  const lowerDuty = readAligned(inputs.lowerDuty, sampleIndex);
  return {
    sampleIndex,
    timeMs: pressure.timeMs!,
    pressure: pressure.value!,
    rpm: rpm.value!,
    load: load.value!,
    upperDuty: upperDuty.status === 'valid' ? upperDuty.value : undefined,
    lowerDuty: lowerDuty.status === 'valid' ? lowerDuty.value : undefined,
  };
}

function summarizePull(samples: readonly PullSample[], config: NormalizedBoostPullDetectionConfig): BoostDetectedPull | undefined {
  if (samples.length < config.minimumSamples) return undefined;
  const start = samples[0]!;
  const end = samples[samples.length - 1]!;
  const durationMs = end.timeMs - start.timeMs;
  if (durationMs < config.minimumDurationMs) return undefined;

  let rpmSum = 0;
  let loadSum = 0;
  let pressureSum = 0;
  let minimumRpm = Number.POSITIVE_INFINITY;
  let maximumRpm = Number.NEGATIVE_INFINITY;
  let minimumLoad = Number.POSITIVE_INFINITY;
  let maximumLoad = Number.NEGATIVE_INFINITY;
  let minimumPressure = Number.POSITIVE_INFINITY;
  let maximumPressure = Number.NEGATIVE_INFINITY;
  let upperDutySum = 0;
  let upperDutyCount = 0;
  let lowerDutySum = 0;
  let lowerDutyCount = 0;

  for (const sample of samples) {
    rpmSum += sample.rpm;
    loadSum += sample.load;
    pressureSum += sample.pressure;
    minimumRpm = Math.min(minimumRpm, sample.rpm);
    maximumRpm = Math.max(maximumRpm, sample.rpm);
    minimumLoad = Math.min(minimumLoad, sample.load);
    maximumLoad = Math.max(maximumLoad, sample.load);
    minimumPressure = Math.min(minimumPressure, sample.pressure);
    maximumPressure = Math.max(maximumPressure, sample.pressure);
    if (sample.upperDuty !== undefined) {
      upperDutySum += sample.upperDuty;
      upperDutyCount += 1;
    }
    if (sample.lowerDuty !== undefined) {
      lowerDutySum += sample.lowerDuty;
      lowerDutyCount += 1;
    }
  }

  return {
    startSampleIndex: start.sampleIndex,
    endSampleIndex: end.sampleIndex,
    startTimeMs: start.timeMs,
    endTimeMs: end.timeMs,
    durationMs,
    sampleCount: samples.length,
    startRpm: start.rpm,
    endRpm: end.rpm,
    minimumRpm,
    maximumRpm,
    meanRpm: rpmSum / samples.length,
    startLoad: start.load,
    endLoad: end.load,
    minimumLoad,
    maximumLoad,
    meanLoad: loadSum / samples.length,
    startPressure: start.pressure,
    endPressure: end.pressure,
    minimumPressure,
    maximumPressure,
    meanPressure: pressureSum / samples.length,
    meanUpperDuty: upperDutyCount > 0 ? upperDutySum / upperDutyCount : undefined,
    meanLowerDuty: lowerDutyCount > 0 ? lowerDutySum / lowerDutyCount : undefined,
  };
}

export function detectBoostPulls(
  inputs: BoostPullDetectorInputs,
  config: BoostPullDetectionConfig,
  sampleIndices?: ArrayLike<number>,
): BoostDetectedPull[] {
  const normalized = normalizeConfig(config);
  const indices = selectedSampleIndices(inputs.measuredPressure, sampleIndices);
  const pulls: BoostDetectedPull[] = [];
  let active: PullSample[] = [];
  let previousSelectedIndex: number | undefined;
  let previousTimeMs: number | undefined;

  const finish = (): void => {
    if (active.length > 0) {
      const pull = summarizePull(active, normalized);
      if (pull) pulls.push(pull);
    }
    active = [];
  };

  for (const sampleIndex of indices) {
    const sample = alignedPullSample(inputs, sampleIndex);
    if (!sample) {
      finish();
      previousSelectedIndex = sampleIndex;
      previousTimeMs = undefined;
      continue;
    }

    const contiguous = previousSelectedIndex === undefined || sampleIndex === previousSelectedIndex + 1;
    const monotonicTime = previousTimeMs === undefined || sample.timeMs > previousTimeMs;
    if (!contiguous || !monotonicTime) finish();

    const canStart = sample.load >= normalized.startMinimumLoad && sample.rpm >= normalized.startMinimumRpm;
    const canContinue = sample.load >= normalized.releaseMinimumLoad && sample.rpm >= normalized.releaseMinimumRpm;

    if (active.length === 0) {
      if (canStart) active = [sample];
    } else if (canContinue) {
      active.push(sample);
    } else {
      finish();
      if (canStart) active = [sample];
    }

    previousSelectedIndex = sampleIndex;
    previousTimeMs = sample.timeMs;
  }

  finish();
  return pulls;
}
