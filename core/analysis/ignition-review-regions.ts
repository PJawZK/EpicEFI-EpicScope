import type { NumericChannelRange } from '../log-model/log-types';

export type IgnitionReviewReason =
  | 'timing-steps'
  | 'timing-variability'
  | 'correction-activity'
  | 'adjacent-transition';

export type IgnitionReviewEvidenceStrength = 'moderate' | 'strong';

export interface IgnitionReviewRegionInputs {
  readonly advance: NumericChannelRange;
  readonly rpm: NumericChannelRange;
  readonly load: NumericChannelRange;
  readonly correction?: NumericChannelRange;
  readonly dwell?: NumericChannelRange;
}

export interface IgnitionReviewRegionConfig {
  readonly rpmBinSize?: number;
  readonly loadBinSize?: number;
  readonly minimumSamplesPerRegion?: number;
  readonly minimumStableDurationMs?: number;
  readonly maxRpmRatePerSecond?: number;
  readonly maxLoadRatePerSecond?: number;
  readonly timingStepThreshold?: number;
  readonly correctionThreshold?: number;
  readonly maxTransitionGapMs?: number;
}

export interface IgnitionReviewArea {
  readonly rpmStart: number;
  readonly rpmEnd: number;
  readonly loadStart: number;
  readonly loadEnd: number;
  readonly stableSampleCount: number;
  readonly visitCount: number;
  readonly evidenceStrength: IgnitionReviewEvidenceStrength;
  readonly reasons: readonly IgnitionReviewReason[];
  readonly advanceMean: number;
  readonly advanceP10: number;
  readonly advanceP90: number;
  readonly advanceSpread: number;
  readonly timingTransitionCount: number;
  readonly timingStepCount: number;
  readonly maxTimingStep: number;
  readonly correctionActiveSampleCount: number;
  readonly correctionActiveFraction: number;
  readonly correctionEpisodeCount: number;
  readonly correctionPeakMagnitude?: number;
  readonly dwellMean?: number;
  readonly dwellP10?: number;
  readonly dwellP90?: number;
  readonly adjacentAdvanceDifference?: number;
  readonly adjacentRpmStart?: number;
  readonly adjacentRpmEnd?: number;
  readonly adjacentLoadStart?: number;
  readonly adjacentLoadEnd?: number;
  readonly evidenceStartSampleIndex: number;
  readonly evidenceEndSampleIndex: number;
  readonly evidenceStartTimeMs: number;
  readonly evidenceEndTimeMs: number;
}

export interface IgnitionReviewRegionResult {
  readonly inputSampleCount: number;
  readonly validAlignedSampleCount: number;
  readonly stableSampleCount: number;
  readonly transientRejectedSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly evaluatedRegionCount: number;
  readonly reviewAreaCount: number;
  readonly timingStepAreaCount: number;
  readonly timingVariabilityAreaCount: number;
  readonly correctionActivityAreaCount: number;
  readonly adjacentTransitionAreaCount: number;
  readonly areas: readonly IgnitionReviewArea[];
}

interface ValueSample {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly value: number;
}

interface StableSample {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly advance: number;
  readonly rpm: number;
  readonly load: number;
  readonly correction?: number;
  readonly dwell?: number;
}

interface MutableRegion {
  readonly key: string;
  readonly rpmIndex: number;
  readonly loadIndex: number;
  readonly rpmStart: number;
  readonly loadStart: number;
  readonly samples: StableSample[];
}

interface RegionVisit {
  readonly startSampleIndex: number;
  readonly endSampleIndex: number;
  readonly startTimeMs: number;
  readonly endTimeMs: number;
  readonly sampleCount: number;
  readonly maxTimingStep: number;
  readonly correctionActiveSampleCount: number;
}

interface RegionStats {
  readonly region: MutableRegion;
  readonly stableSampleCount: number;
  readonly visitCount: number;
  readonly visits: readonly RegionVisit[];
  readonly advanceMean: number;
  readonly advanceP10: number;
  readonly advanceP90: number;
  readonly advanceSpread: number;
  readonly timingTransitionCount: number;
  readonly timingStepCount: number;
  readonly maxTimingStep: number;
  readonly correctionActiveSampleCount: number;
  readonly correctionActiveFraction: number;
  readonly correctionEpisodeCount: number;
  readonly correctionPeakMagnitude?: number;
  readonly dwellMean?: number;
  readonly dwellP10?: number;
  readonly dwellP90?: number;
  readonly evidenceStrength?: IgnitionReviewEvidenceStrength;
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  if (!Number.isSafeInteger(index) || index < 0 || index >= range.values.length || index >= range.validity.length) return undefined;
  return index;
}

function sample(range: NumericChannelRange | undefined, sampleIndex: number): ValueSample | undefined {
  if (!range) return undefined;
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

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and > 0.`);
  return value;
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and >= 0.`);
  return value;
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

function completeSample(inputs: IgnitionReviewRegionInputs, sampleIndex: number): StableSample | undefined {
  const advance = sample(inputs.advance, sampleIndex);
  const rpm = sample(inputs.rpm, sampleIndex);
  const load = sample(inputs.load, sampleIndex);
  if (!advance || !rpm || !load) return undefined;
  const correction = sample(inputs.correction, sampleIndex);
  const dwell = sample(inputs.dwell, sampleIndex);
  return {
    sampleIndex,
    timeMs: advance.timeMs,
    advance: advance.value,
    rpm: rpm.value,
    load: load.value,
    ...(correction ? { correction: correction.value } : {}),
    ...(dwell ? { dwell: dwell.value } : {}),
  };
}

function sameRequiredSamplesAvailable(inputs: IgnitionReviewRegionInputs, sampleIndex: number): boolean {
  return [inputs.advance, inputs.rpm, inputs.load].every((range) => localIndex(range, sampleIndex) !== undefined);
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

    const windowSeconds = windowDurationMs / 1000;
    if (windowSpan(segment, windowStart, end, (entry) => entry.rpm) > maxRpmRate * windowSeconds * 1.5) continue;
    if (windowSpan(segment, windowStart, end, (entry) => entry.load) > maxLoadRate * windowSeconds * 1.5) continue;
    accepted.push(current);
  }
  return accepted;
}

function binCoordinates(rpm: number, load: number, rpmBinSize: number, loadBinSize: number) {
  const rpmIndex = Math.floor(rpm / rpmBinSize);
  const loadIndex = Math.floor(load / loadBinSize);
  return {
    key: `${rpmIndex}:${loadIndex}`,
    rpmIndex,
    loadIndex,
    rpmStart: rpmIndex * rpmBinSize,
    loadStart: loadIndex * loadBinSize,
  };
}

function evidenceStrength(sampleCount: number, visitCount: number, minimumSamples: number): IgnitionReviewEvidenceStrength | undefined {
  if (sampleCount < minimumSamples) return undefined;
  if (sampleCount >= minimumSamples * 3 && visitCount >= 2) return 'strong';
  return 'moderate';
}

function regionStats(
  region: MutableRegion,
  config: {
    timingStepThreshold: number;
    correctionThreshold: number;
    maxTransitionGapMs: number;
    minimumSamples: number;
  },
): RegionStats {
  const advances = region.samples.map((entry) => entry.advance);
  const dwellValues = region.samples.flatMap((entry) => entry.dwell === undefined ? [] : [entry.dwell]);
  const correctionValues = region.samples.flatMap((entry) => entry.correction === undefined ? [] : [entry.correction]);
  let timingTransitionCount = 0;
  let timingStepCount = 0;
  let maxTimingStep = 0;
  let correctionActiveSampleCount = 0;
  let correctionEpisodeCount = 0;
  let correctionPeakMagnitude = 0;
  const visits: RegionVisit[] = [];

  let visitStart = 0;
  let visitMaxStep = 0;
  let visitCorrectionCount = 0;
  let previousCorrectionActive = false;

  const closeVisit = (end: number): void => {
    if (end < visitStart) return;
    const first = region.samples[visitStart]!;
    const last = region.samples[end]!;
    visits.push({
      startSampleIndex: first.sampleIndex,
      endSampleIndex: last.sampleIndex,
      startTimeMs: first.timeMs,
      endTimeMs: last.timeMs,
      sampleCount: end - visitStart + 1,
      maxTimingStep: visitMaxStep,
      correctionActiveSampleCount: visitCorrectionCount,
    });
  };

  for (let position = 0; position < region.samples.length; position += 1) {
    const current = region.samples[position]!;
    const previous = position > 0 ? region.samples[position - 1] : undefined;
    const contiguous = previous !== undefined
      && current.sampleIndex === previous.sampleIndex + 1
      && current.timeMs > previous.timeMs
      && current.timeMs - previous.timeMs <= config.maxTransitionGapMs;

    if (position > 0 && !contiguous) {
      closeVisit(position - 1);
      visitStart = position;
      visitMaxStep = 0;
      visitCorrectionCount = 0;
      previousCorrectionActive = false;
    }

    if (contiguous && previous) {
      const step = Math.abs(current.advance - previous.advance);
      timingTransitionCount += 1;
      visitMaxStep = Math.max(visitMaxStep, step);
      maxTimingStep = Math.max(maxTimingStep, step);
      if (step >= config.timingStepThreshold) timingStepCount += 1;
    }

    const correctionActive = current.correction !== undefined && Math.abs(current.correction) > config.correctionThreshold;
    if (correctionActive) {
      correctionActiveSampleCount += 1;
      visitCorrectionCount += 1;
      correctionPeakMagnitude = Math.max(correctionPeakMagnitude, Math.abs(current.correction!));
      if (!previousCorrectionActive) correctionEpisodeCount += 1;
    }
    previousCorrectionActive = correctionActive;
  }
  if (region.samples.length) closeVisit(region.samples.length - 1);

  const p10 = percentile(advances, 0.1);
  const p90 = percentile(advances, 0.9);
  const visitCount = visits.length;
  return {
    region,
    stableSampleCount: region.samples.length,
    visitCount,
    visits,
    advanceMean: mean(advances),
    advanceP10: p10,
    advanceP90: p90,
    advanceSpread: p90 - p10,
    timingTransitionCount,
    timingStepCount,
    maxTimingStep,
    correctionActiveSampleCount,
    correctionActiveFraction: correctionValues.length > 0 ? correctionActiveSampleCount / correctionValues.length : 0,
    correctionEpisodeCount,
    ...(correctionValues.length > 0 ? { correctionPeakMagnitude } : {}),
    ...(dwellValues.length > 0 ? {
      dwellMean: mean(dwellValues),
      dwellP10: percentile(dwellValues, 0.1),
      dwellP90: percentile(dwellValues, 0.9),
    } : {}),
    ...(evidenceStrength(region.samples.length, visitCount, config.minimumSamples)
      ? { evidenceStrength: evidenceStrength(region.samples.length, visitCount, config.minimumSamples)! }
      : {}),
  };
}

function representativeVisit(stats: RegionStats, timingStepThreshold: number): RegionVisit {
  let best = stats.visits[0]!;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const visit of stats.visits) {
    const score = visit.maxTimingStep / timingStepThreshold
      + Math.min(4, visit.correctionActiveSampleCount)
      + Math.min(1.5, visit.sampleCount / 40);
    if (score > bestScore) {
      best = visit;
      bestScore = score;
    }
  }
  return best;
}

export function analyzeIgnitionReviewRegions(
  inputs: IgnitionReviewRegionInputs,
  config: IgnitionReviewRegionConfig = {},
  sampleIndices?: ArrayLike<number>,
): IgnitionReviewRegionResult {
  const rpmBinSize = finitePositive(config.rpmBinSize ?? 250, 'Ignition review RPM bin size');
  const loadBinSize = finitePositive(config.loadBinSize ?? 10, 'Ignition review load bin size');
  const minimumSamples = config.minimumSamplesPerRegion ?? 10;
  if (!Number.isInteger(minimumSamples) || minimumSamples < 1) throw new RangeError('Ignition review minimum samples must be an integer >= 1.');
  const minimumStableDurationMs = finiteNonNegative(config.minimumStableDurationMs ?? 300, 'Ignition review stable duration');
  const maxRpmRate = finiteNonNegative(config.maxRpmRatePerSecond ?? 500, 'Ignition review max RPM rate');
  const maxLoadRate = finiteNonNegative(config.maxLoadRatePerSecond ?? 25, 'Ignition review max load rate');
  const timingStepThreshold = finitePositive(config.timingStepThreshold ?? 5, 'Ignition review timing-step threshold');
  const correctionThreshold = finiteNonNegative(config.correctionThreshold ?? 0.5, 'Ignition review correction threshold');
  const maxTransitionGapMs = finitePositive(config.maxTransitionGapMs ?? 100, 'Ignition review max transition gap');

  const indices = selectedIndices(inputs.advance, sampleIndices);
  const stableSamples: StableSample[] = [];
  let validAlignedSampleCount = 0;
  let invalidSampleCount = 0;
  let unavailableSampleCount = 0;
  let segment: StableSample[] = [];

  const finishSegment = (): void => {
    if (!segment.length) return;
    for (const sample of stableSamplesFromSegment(segment, minimumStableDurationMs, maxRpmRate, maxLoadRate)) stableSamples.push(sample);
    segment = [];
  };

  for (let position = 0; position < indices.length; position += 1) {
    const sampleIndex = indices[position]!;
    const current = completeSample(inputs, sampleIndex);
    if (!current) {
      finishSegment();
      if (sameRequiredSamplesAvailable(inputs, sampleIndex)) invalidSampleCount += 1;
      else unavailableSampleCount += 1;
      continue;
    }
    validAlignedSampleCount += 1;
    const previousIndex = position > 0 ? indices[position - 1] : undefined;
    const previous = previousIndex === undefined ? undefined : completeSample(inputs, previousIndex);
    const contiguous = previous !== undefined
      && sampleIndex === previousIndex! + 1
      && current.timeMs > previous.timeMs
      && current.timeMs - previous.timeMs <= maxTransitionGapMs;
    if (!contiguous) finishSegment();
    segment.push(current);
  }
  finishSegment();

  const regions = new Map<string, MutableRegion>();
  for (const current of stableSamples) {
    const bin = binCoordinates(current.rpm, current.load, rpmBinSize, loadBinSize);
    let region = regions.get(bin.key);
    if (!region) {
      region = { ...bin, samples: [] };
      regions.set(bin.key, region);
    }
    region.samples.push(current);
  }

  const statsByKey = new Map<string, RegionStats>();
  for (const region of regions.values()) {
    statsByKey.set(region.key, regionStats(region, {
      timingStepThreshold,
      correctionThreshold,
      maxTransitionGapMs,
      minimumSamples,
    }));
  }

  const ranked: Array<{ area: IgnitionReviewArea; score: number }> = [];
  let timingStepAreaCount = 0;
  let timingVariabilityAreaCount = 0;
  let correctionActivityAreaCount = 0;
  let adjacentTransitionAreaCount = 0;

  for (const stats of statsByKey.values()) {
    if (!stats.evidenceStrength || stats.visits.length === 0) continue;
    const reasons: IgnitionReviewReason[] = [];
    if (stats.timingStepCount >= 2) reasons.push('timing-steps');
    if (stats.visitCount >= 2 && stats.advanceSpread >= timingStepThreshold) reasons.push('timing-variability');
    if (stats.correctionEpisodeCount >= 2) reasons.push('correction-activity');

    let adjacentAdvanceDifference: number | undefined;
    let adjacentStats: RegionStats | undefined;
    const neighbors = [
      `${stats.region.rpmIndex - 1}:${stats.region.loadIndex}`,
      `${stats.region.rpmIndex + 1}:${stats.region.loadIndex}`,
      `${stats.region.rpmIndex}:${stats.region.loadIndex - 1}`,
      `${stats.region.rpmIndex}:${stats.region.loadIndex + 1}`,
    ];
    for (const key of neighbors) {
      const neighbor = statsByKey.get(key);
      if (!neighbor?.evidenceStrength) continue;
      const difference = Math.abs(stats.advanceMean - neighbor.advanceMean);
      if (adjacentAdvanceDifference === undefined || difference > adjacentAdvanceDifference) {
        adjacentAdvanceDifference = difference;
        adjacentStats = neighbor;
      }
    }
    if (adjacentAdvanceDifference !== undefined && adjacentAdvanceDifference >= timingStepThreshold) reasons.push('adjacent-transition');
    if (!reasons.length) continue;

    if (reasons.includes('timing-steps')) timingStepAreaCount += 1;
    if (reasons.includes('timing-variability')) timingVariabilityAreaCount += 1;
    if (reasons.includes('correction-activity')) correctionActivityAreaCount += 1;
    if (reasons.includes('adjacent-transition')) adjacentTransitionAreaCount += 1;

    const representative = representativeVisit(stats, timingStepThreshold);
    let score = stats.evidenceStrength === 'strong' ? 1.5 : 0;
    score += Math.min(1.5, Math.log2(stats.visitCount + 1) / 2);
    if (reasons.includes('timing-steps')) score += 4 + Math.min(4, stats.timingStepCount / 2) + stats.maxTimingStep / timingStepThreshold;
    if (reasons.includes('timing-variability')) score += 3 + stats.advanceSpread / timingStepThreshold;
    if (reasons.includes('correction-activity')) score += 5 + Math.min(4, stats.correctionEpisodeCount / 2);
    if (reasons.includes('adjacent-transition')) score += 2.5 + (adjacentAdvanceDifference ?? 0) / timingStepThreshold;

    ranked.push({
      score,
      area: {
        rpmStart: stats.region.rpmStart,
        rpmEnd: stats.region.rpmStart + rpmBinSize,
        loadStart: stats.region.loadStart,
        loadEnd: stats.region.loadStart + loadBinSize,
        stableSampleCount: stats.stableSampleCount,
        visitCount: stats.visitCount,
        evidenceStrength: stats.evidenceStrength,
        reasons,
        advanceMean: stats.advanceMean,
        advanceP10: stats.advanceP10,
        advanceP90: stats.advanceP90,
        advanceSpread: stats.advanceSpread,
        timingTransitionCount: stats.timingTransitionCount,
        timingStepCount: stats.timingStepCount,
        maxTimingStep: stats.maxTimingStep,
        correctionActiveSampleCount: stats.correctionActiveSampleCount,
        correctionActiveFraction: stats.correctionActiveFraction,
        correctionEpisodeCount: stats.correctionEpisodeCount,
        ...(stats.correctionPeakMagnitude !== undefined ? { correctionPeakMagnitude: stats.correctionPeakMagnitude } : {}),
        ...(stats.dwellMean !== undefined ? { dwellMean: stats.dwellMean } : {}),
        ...(stats.dwellP10 !== undefined ? { dwellP10: stats.dwellP10 } : {}),
        ...(stats.dwellP90 !== undefined ? { dwellP90: stats.dwellP90 } : {}),
        ...(adjacentAdvanceDifference !== undefined ? { adjacentAdvanceDifference } : {}),
        ...(adjacentStats ? {
          adjacentRpmStart: adjacentStats.region.rpmStart,
          adjacentRpmEnd: adjacentStats.region.rpmStart + rpmBinSize,
          adjacentLoadStart: adjacentStats.region.loadStart,
          adjacentLoadEnd: adjacentStats.region.loadStart + loadBinSize,
        } : {}),
        evidenceStartSampleIndex: representative.startSampleIndex,
        evidenceEndSampleIndex: representative.endSampleIndex,
        evidenceStartTimeMs: representative.startTimeMs,
        evidenceEndTimeMs: representative.endTimeMs,
      },
    });
  }

  ranked.sort((left, right) => right.score - left.score
    || right.area.stableSampleCount - left.area.stableSampleCount
    || left.area.rpmStart - right.area.rpmStart
    || left.area.loadStart - right.area.loadStart);

  return {
    inputSampleCount: indices.length,
    validAlignedSampleCount,
    stableSampleCount: stableSamples.length,
    transientRejectedSampleCount: Math.max(0, validAlignedSampleCount - stableSamples.length),
    invalidSampleCount,
    unavailableSampleCount,
    evaluatedRegionCount: [...statsByKey.values()].filter((entry) => entry.evidenceStrength !== undefined).length,
    reviewAreaCount: ranked.length,
    timingStepAreaCount,
    timingVariabilityAreaCount,
    correctionActivityAreaCount,
    adjacentTransitionAreaCount,
    areas: ranked.map((entry) => entry.area),
  };
}
