import type { NumericChannelRange } from '../log-model/log-types';

export interface FuelingOperatingMapInputs {
  readonly actualAfr: NumericChannelRange;
  readonly targetAfr: NumericChannelRange;
  readonly rpm: NumericChannelRange;
  readonly load: NumericChannelRange;
}

export interface FuelingOperatingMapConfig {
  readonly rpmBinSize: number;
  readonly loadBinSize: number;
  readonly minimumSamplesPerBin?: number;
  readonly errorDeadband?: number;
  readonly maxRpmRatePerSecond?: number;
  readonly maxLoadRatePerSecond?: number;
  readonly minimumStableDurationMs?: number;
}

export interface FuelingOperatingPoint {
  readonly rpmStart: number;
  readonly rpmEnd: number;
  readonly loadStart: number;
  readonly loadEnd: number;
  readonly sampleCount: number;
  readonly rpmMean: number;
  readonly loadMean: number;
  readonly actualAfrMean: number;
  readonly targetAfrMean: number;
  readonly errorMean: number;
  readonly errorMedian: number;
  readonly errorP10: number;
  readonly errorP90: number;
  readonly errorMeanAbsolute: number;
  readonly errorStdDev: number;
  readonly leanSampleCount: number;
  readonly richSampleCount: number;
  readonly withinDeadbandSampleCount: number;
  readonly bias: 'lean' | 'rich' | 'balanced' | 'within-deadband';
}

export interface FuelingOperatingMapResult {
  readonly inputSampleCount: number;
  readonly stableEligibleSampleCount: number;
  readonly transientRejectedSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly operatingPoints: readonly FuelingOperatingPoint[];
}

interface ValueSample {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly value: number;
}

interface StableSample {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly actualAfr: number;
  readonly targetAfr: number;
  readonly rpm: number;
  readonly load: number;
}

interface MutableBin {
  readonly rpmStart: number;
  readonly loadStart: number;
  readonly samples: StableSample[];
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(index) || index < 0 || index >= range.values.length || index >= range.validity.length) return undefined;
  return index;
}

function sample(range: NumericChannelRange, sampleIndex: number): ValueSample | undefined {
  const index = localIndex(range, sampleIndex);
  if (index === undefined || range.validity[index] !== 1) return undefined;
  const value = range.values[index];
  const timeMs = range.timeMs[index];
  if (value === undefined || timeMs === undefined || !Number.isFinite(value) || !Number.isFinite(timeMs)) return undefined;
  return { sampleIndex, timeMs, value };
}

function selectedIndices(reference: NumericChannelRange, sampleIndices?: ArrayLike<number>): number[] {
  const raw = sampleIndices
    ? Array.from({ length: sampleIndices.length }, (_, index) => sampleIndices[index])
    : Array.from({ length: reference.values.length }, (_, index) => reference.startSampleIndex + index);
  return [...new Set(raw.filter((value): value is number => Number.isSafeInteger(value)))].sort((left, right) => left - right);
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  const position = Math.max(0, Math.min(1, fraction)) * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lower = sorted[lowerIndex]!;
  const upper = sorted[upperIndex]!;
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[], average: number): number {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and > 0.`);
  return value;
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and >= 0.`);
  return value;
}

function completeSample(inputs: FuelingOperatingMapInputs, sampleIndex: number): StableSample | undefined {
  const actual = sample(inputs.actualAfr, sampleIndex);
  const target = sample(inputs.targetAfr, sampleIndex);
  const rpm = sample(inputs.rpm, sampleIndex);
  const load = sample(inputs.load, sampleIndex);
  if (!actual || !target || !rpm || !load) return undefined;
  return {
    sampleIndex,
    timeMs: actual.timeMs,
    actualAfr: actual.value,
    targetAfr: target.value,
    rpm: rpm.value,
    load: load.value,
  };
}

function sameSampleAvailable(inputs: FuelingOperatingMapInputs, sampleIndex: number): boolean {
  return [inputs.actualAfr, inputs.targetAfr, inputs.rpm, inputs.load].every((range) => localIndex(range, sampleIndex) !== undefined);
}

function biasFor(lean: number, rich: number, within: number): FuelingOperatingPoint['bias'] {
  if (lean === 0 && rich === 0 && within > 0) return 'within-deadband';
  if (lean > rich) return 'lean';
  if (rich > lean) return 'rich';
  return 'balanced';
}

export function buildFuelingOperatingMap(
  inputs: FuelingOperatingMapInputs,
  config: FuelingOperatingMapConfig,
  sampleIndices?: ArrayLike<number>,
): FuelingOperatingMapResult {
  const rpmBinSize = finitePositive(config.rpmBinSize, 'Fueling RPM bin size');
  const loadBinSize = finitePositive(config.loadBinSize, 'Fueling load bin size');
  const minimumSamples = config.minimumSamplesPerBin ?? 10;
  if (!Number.isInteger(minimumSamples) || minimumSamples < 1) throw new RangeError('Fueling minimum samples per bin must be an integer >= 1.');
  const errorDeadband = finiteNonNegative(config.errorDeadband ?? 0.2, 'Fueling error deadband');
  const maxRpmRate = finiteNonNegative(config.maxRpmRatePerSecond ?? 500, 'Fueling max RPM rate');
  const maxLoadRate = finiteNonNegative(config.maxLoadRatePerSecond ?? 25, 'Fueling max load rate');
  const minimumStableDurationMs = finiteNonNegative(config.minimumStableDurationMs ?? 300, 'Fueling minimum stable duration');

  const indices = selectedIndices(inputs.actualAfr, sampleIndices);
  let invalidSampleCount = 0;
  let unavailableSampleCount = 0;
  let validAlignedSampleCount = 0;
  const stableSamples: StableSample[] = [];
  let segment: StableSample[] = [];

  const finishSegment = (): void => {
    if (segment.length === 0) return;
    const startTimeMs = segment[0]!.timeMs;
    for (const current of segment) {
      if (current.timeMs - startTimeMs >= minimumStableDurationMs) stableSamples.push(current);
    }
    segment = [];
  };

  for (let position = 0; position < indices.length; position += 1) {
    const sampleIndex = indices[position]!;
    const current = completeSample(inputs, sampleIndex);
    if (!current) {
      finishSegment();
      if (sameSampleAvailable(inputs, sampleIndex)) invalidSampleCount += 1;
      else unavailableSampleCount += 1;
      continue;
    }
    validAlignedSampleCount += 1;

    if (position === 0 || sampleIndex !== indices[position - 1]! + 1) {
      finishSegment();
      segment = [current];
      continue;
    }

    const previous = completeSample(inputs, indices[position - 1]!);
    if (!previous) {
      finishSegment();
      segment = [current];
      continue;
    }
    const deltaTimeMs = current.timeMs - previous.timeMs;
    if (!(deltaTimeMs > 0)) {
      finishSegment();
      segment = [current];
      continue;
    }
    const seconds = deltaTimeMs / 1000;
    const rpmRate = Math.abs(current.rpm - previous.rpm) / seconds;
    const loadRate = Math.abs(current.load - previous.load) / seconds;
    const stableTransition = rpmRate <= maxRpmRate && loadRate <= maxLoadRate;
    if (!stableTransition) {
      finishSegment();
      segment = [current];
      continue;
    }
    if (segment.length === 0) segment.push(previous);
    segment.push(current);
  }
  finishSegment();

  const stableSampleIndices = new Set(stableSamples.map((entry) => entry.sampleIndex));
  const transientRejectedSampleCount = Math.max(0, validAlignedSampleCount - stableSampleIndices.size);
  const bins = new Map<string, MutableBin>();
  for (const current of stableSamples) {
    const rpmStart = Math.floor(current.rpm / rpmBinSize) * rpmBinSize;
    const loadStart = Math.floor(current.load / loadBinSize) * loadBinSize;
    const key = `${rpmStart}:${loadStart}`;
    let bin = bins.get(key);
    if (!bin) {
      bin = { rpmStart, loadStart, samples: [] };
      bins.set(key, bin);
    }
    bin.samples.push(current);
  }

  const operatingPoints: FuelingOperatingPoint[] = [];
  for (const bin of bins.values()) {
    if (bin.samples.length < minimumSamples) continue;
    const errors = bin.samples.map((entry) => entry.actualAfr - entry.targetAfr);
    const errorMean = mean(errors);
    const leanSampleCount = errors.filter((error) => error > errorDeadband).length;
    const richSampleCount = errors.filter((error) => error < -errorDeadband).length;
    const withinDeadbandSampleCount = errors.length - leanSampleCount - richSampleCount;
    operatingPoints.push({
      rpmStart: bin.rpmStart,
      rpmEnd: bin.rpmStart + rpmBinSize,
      loadStart: bin.loadStart,
      loadEnd: bin.loadStart + loadBinSize,
      sampleCount: bin.samples.length,
      rpmMean: mean(bin.samples.map((entry) => entry.rpm)),
      loadMean: mean(bin.samples.map((entry) => entry.load)),
      actualAfrMean: mean(bin.samples.map((entry) => entry.actualAfr)),
      targetAfrMean: mean(bin.samples.map((entry) => entry.targetAfr)),
      errorMean,
      errorMedian: percentile(errors, 0.5),
      errorP10: percentile(errors, 0.1),
      errorP90: percentile(errors, 0.9),
      errorMeanAbsolute: mean(errors.map((error) => Math.abs(error))),
      errorStdDev: standardDeviation(errors, errorMean),
      leanSampleCount,
      richSampleCount,
      withinDeadbandSampleCount,
      bias: biasFor(leanSampleCount, richSampleCount, withinDeadbandSampleCount),
    });
  }

  operatingPoints.sort((left, right) => left.rpmStart - right.rpmStart || left.loadStart - right.loadStart);
  return {
    inputSampleCount: indices.length,
    stableEligibleSampleCount: stableSampleIndices.size,
    transientRejectedSampleCount,
    invalidSampleCount,
    unavailableSampleCount,
    operatingPoints,
  };
}
