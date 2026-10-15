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
  /** Evidence threshold. Bins below this count remain visible as weak evidence. */
  readonly minimumSamplesPerBin?: number;
  readonly errorDeadband?: number;
  readonly maxRpmRatePerSecond?: number;
  readonly maxLoadRatePerSecond?: number;
  /** Width of the trailing stability window. */
  readonly minimumStableDurationMs?: number;
}

export type FuelingOperatingPointEvidenceStrength = 'weak' | 'moderate' | 'strong';

export interface FuelingOperatingPoint {
  readonly rpmStart: number;
  readonly rpmEnd: number;
  readonly loadStart: number;
  readonly loadEnd: number;
  /** Window-stable samples used for mixture statistics. */
  readonly sampleCount: number;
  /** All valid aligned context-qualified samples observed in this RPM/load bin. */
  readonly observedSampleCount: number;
  readonly stableFraction: number;
  readonly evidenceStrength: FuelingOperatingPointEvidenceStrength;
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
  readonly validAlignedSampleCount: number;
  readonly stableEligibleSampleCount: number;
  /** Valid aligned samples rejected by the trailing RPM/load stability window. */
  readonly transientRejectedSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly observedOperatingPointCount: number;
  readonly weakOperatingPointCount: number;
  readonly moderateOperatingPointCount: number;
  readonly strongOperatingPointCount: number;
  readonly lowEvidenceSampleCount: number;
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

function evidenceStrength(sampleCount: number, evidenceThreshold: number): FuelingOperatingPointEvidenceStrength {
  if (sampleCount < evidenceThreshold) return 'weak';
  if (sampleCount < evidenceThreshold * 3) return 'moderate';
  return 'strong';
}

function binKey(rpm: number, load: number, rpmBinSize: number, loadBinSize: number): { key: string; rpmStart: number; loadStart: number } {
  const rpmStart = Math.floor(rpm / rpmBinSize) * rpmBinSize;
  const loadStart = Math.floor(load / loadBinSize) * loadBinSize;
  return { key: `${rpmStart}:${loadStart}`, rpmStart, loadStart };
}

function linearSlopePerSecond(samples: readonly StableSample[], start: number, end: number, value: (sample: StableSample) => number): number {
  const originMs = samples[start]!.timeMs;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let count = 0;
  for (let index = start; index <= end; index += 1) {
    const entry = samples[index]!;
    const x = (entry.timeMs - originMs) / 1000;
    const y = value(entry);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
    count += 1;
  }
  if (count <= 1) return 0;
  const denominator = count * sumX2 - sumX * sumX;
  if (!(denominator > 0)) return 0;
  return (count * sumXY - sumX * sumY) / denominator;
}

function windowSpan(samples: readonly StableSample[], start: number, end: number, value: (sample: StableSample) => number): number {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = start; index <= end; index += 1) {
    const current = value(samples[index]!);
    minimum = Math.min(minimum, current);
    maximum = Math.max(maximum, current);
  }
  return maximum - minimum;
}

function stableSamplesFromSegment(
  segment: readonly StableSample[],
  minimumStableDurationMs: number,
  maxRpmRate: number,
  maxLoadRate: number,
): StableSample[] {
  if (minimumStableDurationMs === 0) return [...segment];
  const accepted: StableSample[] = [];
  let windowStart = 0;
  for (let end = 0; end < segment.length; end += 1) {
    const current = segment[end]!;
    while (windowStart + 1 <= end && current.timeMs - segment[windowStart + 1]!.timeMs >= minimumStableDurationMs) {
      windowStart += 1;
    }
    const windowDurationMs = current.timeMs - segment[windowStart]!.timeMs;
    if (windowDurationMs < minimumStableDurationMs) continue;

    const rpmSlope = Math.abs(linearSlopePerSecond(segment, windowStart, end, (entry) => entry.rpm));
    const loadSlope = Math.abs(linearSlopePerSecond(segment, windowStart, end, (entry) => entry.load));
    if (rpmSlope > maxRpmRate || loadSlope > maxLoadRate) continue;

    // A slope alone can hide a noisy oscillation. The span guard is deliberately looser than
    // the slope threshold so ordinary high-rate logger jitter does not reset qualification.
    const windowSeconds = windowDurationMs / 1000;
    const rpmSpanLimit = maxRpmRate * windowSeconds * 1.5;
    const loadSpanLimit = maxLoadRate * windowSeconds * 1.5;
    if (windowSpan(segment, windowStart, end, (entry) => entry.rpm) > rpmSpanLimit) continue;
    if (windowSpan(segment, windowStart, end, (entry) => entry.load) > loadSpanLimit) continue;

    accepted.push(current);
  }
  return accepted;
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
  const observedCounts = new Map<string, number>();
  const observedBins = new Set<string>();
  let segment: StableSample[] = [];

  const finishSegment = (): void => {
    if (!segment.length) return;
    const accepted = stableSamplesFromSegment(segment, minimumStableDurationMs, maxRpmRate, maxLoadRate);
    for (const sample of accepted) stableSamples.push(sample);
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
    const observed = binKey(current.rpm, current.load, rpmBinSize, loadBinSize);
    observedCounts.set(observed.key, (observedCounts.get(observed.key) ?? 0) + 1);
    observedBins.add(observed.key);

    if (position === 0 || sampleIndex !== indices[position - 1]! + 1) {
      finishSegment();
      segment = [current];
      continue;
    }
    const previous = completeSample(inputs, indices[position - 1]!);
    if (!previous || !(current.timeMs > previous.timeMs)) {
      finishSegment();
      segment = [current];
      continue;
    }
    segment.push(current);
  }
  finishSegment();

  const stableSampleIndices = new Set(stableSamples.map((entry) => entry.sampleIndex));
  const transientRejectedSampleCount = Math.max(0, validAlignedSampleCount - stableSampleIndices.size);
  const bins = new Map<string, MutableBin>();
  for (const current of stableSamples) {
    const { key, rpmStart, loadStart } = binKey(current.rpm, current.load, rpmBinSize, loadBinSize);
    let bin = bins.get(key);
    if (!bin) {
      bin = { rpmStart, loadStart, samples: [] };
      bins.set(key, bin);
    }
    bin.samples.push(current);
  }

  const operatingPoints: FuelingOperatingPoint[] = [];
  let lowEvidenceSampleCount = 0;
  let weakOperatingPointCount = 0;
  let moderateOperatingPointCount = 0;
  let strongOperatingPointCount = 0;
  for (const [key, bin] of bins) {
    const errors = bin.samples.map((entry) => entry.actualAfr - entry.targetAfr);
    const errorMean = mean(errors);
    const leanSampleCount = errors.filter((error) => error > errorDeadband).length;
    const richSampleCount = errors.filter((error) => error < -errorDeadband).length;
    const withinDeadbandSampleCount = errors.length - leanSampleCount - richSampleCount;
    const strength = evidenceStrength(bin.samples.length, minimumSamples);
    if (strength === 'weak') {
      weakOperatingPointCount += 1;
      lowEvidenceSampleCount += bin.samples.length;
    } else if (strength === 'moderate') {
      moderateOperatingPointCount += 1;
    } else {
      strongOperatingPointCount += 1;
    }
    const observedSampleCount = observedCounts.get(key) ?? bin.samples.length;
    operatingPoints.push({
      rpmStart: bin.rpmStart,
      rpmEnd: bin.rpmStart + rpmBinSize,
      loadStart: bin.loadStart,
      loadEnd: bin.loadStart + loadBinSize,
      sampleCount: bin.samples.length,
      observedSampleCount,
      stableFraction: observedSampleCount > 0 ? bin.samples.length / observedSampleCount : 0,
      evidenceStrength: strength,
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
    validAlignedSampleCount,
    stableEligibleSampleCount: stableSampleIndices.size,
    transientRejectedSampleCount,
    invalidSampleCount,
    unavailableSampleCount,
    observedOperatingPointCount: observedBins.size,
    weakOperatingPointCount,
    moderateOperatingPointCount,
    strongOperatingPointCount,
    lowEvidenceSampleCount,
    operatingPoints,
  };
}
