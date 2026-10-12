import type { NumericChannelRange } from '../log-model/log-types';
import { locateTuneTablePoint, type TuneTable2D } from '../tune/table-correlation';
import type { IgnitionReviewArea } from './ignition-review-regions';

export interface IgnitionTuneAttributionInputs {
  readonly advance: NumericChannelRange;
  readonly rpm: NumericChannelRange;
  readonly load: NumericChannelRange;
  readonly correction?: NumericChannelRange;
}

export interface IgnitionTuneAttributionConfig {
  readonly timingStepThreshold?: number;
  readonly correctionThreshold?: number;
  readonly maxTransitionGapMs?: number;
}

export interface IgnitionTuneAreaAttribution {
  readonly area: IgnitionReviewArea;
  readonly representativeSampleCount: number;
  readonly mappedSampleCount: number;
  readonly baseAdvanceMean?: number;
  readonly observedAdvanceMean?: number;
  readonly meanResidual?: number;
  readonly residualP10?: number;
  readonly residualP90?: number;
  readonly residualSpread?: number;
  readonly baseLocalSpread?: number;
  readonly observedTimingStepCount: number;
  readonly baseAlignedTimingStepCount: number;
  readonly residualTimingStepCount: number;
  readonly correctionActiveSampleCount: number;
  readonly correctionEpisodeCount: number;
  readonly adjacentBaseAdvanceDifference?: number;
}

export interface IgnitionTuneAttributionResult {
  readonly tableName: string;
  readonly tableUnits: string | undefined;
  readonly areaCount: number;
  readonly mappedAreaCount: number;
  readonly areas: readonly IgnitionTuneAreaAttribution[];
}

interface SamplePoint {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly advance: number;
  readonly rpm: number;
  readonly load: number;
  readonly baseAdvance: number;
  readonly correction?: number;
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be finite and > 0.`);
  return value;
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${label} must be finite and >= 0.`);
  return value;
}

function localIndex(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  return Number.isSafeInteger(index) && index >= 0 && index < range.values.length && index < range.validity.length ? index : undefined;
}

function numericSample(range: NumericChannelRange | undefined, sampleIndex: number): { value: number; timeMs: number } | undefined {
  if (!range) return undefined;
  const index = localIndex(range, sampleIndex);
  if (index === undefined || range.validity[index] !== 1) return undefined;
  const value = range.values[index];
  const timeMs = range.timeMs[index];
  if (value === undefined || timeMs === undefined || !Number.isFinite(value) || !Number.isFinite(timeMs)) return undefined;
  return { value, timeMs };
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

function inArea(area: IgnitionReviewArea, rpm: number, load: number): boolean {
  return rpm >= area.rpmStart && rpm < area.rpmEnd && load >= area.loadStart && load < area.loadEnd;
}

function localBaseSpread(table: TuneTable2D, area: IgnitionReviewArea): number {
  const points = [
    locateTuneTablePoint(table, area.rpmStart, area.loadStart).interpolatedTuneValue,
    locateTuneTablePoint(table, area.rpmEnd, area.loadStart).interpolatedTuneValue,
    locateTuneTablePoint(table, area.rpmStart, area.loadEnd).interpolatedTuneValue,
    locateTuneTablePoint(table, area.rpmEnd, area.loadEnd).interpolatedTuneValue,
  ];
  return Math.max(...points) - Math.min(...points);
}

function adjacentBaseDifference(table: TuneTable2D, area: IgnitionReviewArea): number | undefined {
  if (area.adjacentRpmStart === undefined || area.adjacentRpmEnd === undefined
    || area.adjacentLoadStart === undefined || area.adjacentLoadEnd === undefined) return undefined;
  const currentRpm = (area.rpmStart + area.rpmEnd) / 2;
  const currentLoad = (area.loadStart + area.loadEnd) / 2;
  const adjacentRpm = (area.adjacentRpmStart + area.adjacentRpmEnd) / 2;
  const adjacentLoad = (area.adjacentLoadStart + area.adjacentLoadEnd) / 2;
  const current = locateTuneTablePoint(table, currentRpm, currentLoad).interpolatedTuneValue;
  const adjacent = locateTuneTablePoint(table, adjacentRpm, adjacentLoad).interpolatedTuneValue;
  return Math.abs(current - adjacent);
}

function mappedPoints(
  area: IgnitionReviewArea,
  table: TuneTable2D,
  inputs: IgnitionTuneAttributionInputs,
): SamplePoint[] {
  const points: SamplePoint[] = [];
  for (let sampleIndex = area.evidenceStartSampleIndex; sampleIndex <= area.evidenceEndSampleIndex; sampleIndex += 1) {
    const advance = numericSample(inputs.advance, sampleIndex);
    const rpm = numericSample(inputs.rpm, sampleIndex);
    const load = numericSample(inputs.load, sampleIndex);
    if (!advance || !rpm || !load || !inArea(area, rpm.value, load.value)) continue;
    const baseAdvance = locateTuneTablePoint(table, rpm.value, load.value).interpolatedTuneValue;
    const correction = numericSample(inputs.correction, sampleIndex);
    points.push({
      sampleIndex,
      timeMs: advance.timeMs,
      advance: advance.value,
      rpm: rpm.value,
      load: load.value,
      baseAdvance,
      ...(correction ? { correction: correction.value } : {}),
    });
  }
  return points;
}

export function analyzeIgnitionTuneAttribution(
  areas: readonly IgnitionReviewArea[],
  table: TuneTable2D,
  inputs: IgnitionTuneAttributionInputs,
  config: IgnitionTuneAttributionConfig = {},
): IgnitionTuneAttributionResult {
  const timingStepThreshold = finitePositive(config.timingStepThreshold ?? 5, 'Ignition attribution timing-step threshold');
  const correctionThreshold = finiteNonNegative(config.correctionThreshold ?? 0.5, 'Ignition attribution correction threshold');
  const maxTransitionGapMs = finitePositive(config.maxTransitionGapMs ?? 100, 'Ignition attribution max transition gap');

  const attributed = areas.map((area): IgnitionTuneAreaAttribution => {
    const points = mappedPoints(area, table, inputs);
    const residuals = points.map((point) => point.advance - point.baseAdvance);
    const observed = points.map((point) => point.advance);
    const base = points.map((point) => point.baseAdvance);
    let observedTimingStepCount = 0;
    let baseAlignedTimingStepCount = 0;
    let residualTimingStepCount = 0;
    let correctionActiveSampleCount = 0;
    let correctionEpisodeCount = 0;
    let previousCorrectionActive = false;

    for (let position = 0; position < points.length; position += 1) {
      const current = points[position]!;
      const previous = position > 0 ? points[position - 1] : undefined;
      const contiguous = previous !== undefined
        && current.sampleIndex === previous.sampleIndex + 1
        && current.timeMs > previous.timeMs
        && current.timeMs - previous.timeMs <= maxTransitionGapMs;

      if (contiguous && previous) {
        const observedDelta = current.advance - previous.advance;
        const baseDelta = current.baseAdvance - previous.baseAdvance;
        const residualDelta = observedDelta - baseDelta;
        if (Math.abs(observedDelta) >= timingStepThreshold) {
          observedTimingStepCount += 1;
          if (Math.abs(baseDelta) >= timingStepThreshold && Math.sign(baseDelta) === Math.sign(observedDelta)) {
            baseAlignedTimingStepCount += 1;
          }
        }
        if (Math.abs(residualDelta) >= timingStepThreshold) residualTimingStepCount += 1;
      } else {
        previousCorrectionActive = false;
      }

      const correctionActive = current.correction !== undefined && Math.abs(current.correction) > correctionThreshold;
      if (correctionActive) {
        correctionActiveSampleCount += 1;
        if (!previousCorrectionActive) correctionEpisodeCount += 1;
      }
      previousCorrectionActive = correctionActive;
    }

    return {
      area,
      representativeSampleCount: Math.max(0, area.evidenceEndSampleIndex - area.evidenceStartSampleIndex + 1),
      mappedSampleCount: points.length,
      ...(points.length ? {
        baseAdvanceMean: mean(base),
        observedAdvanceMean: mean(observed),
        meanResidual: mean(residuals),
        residualP10: percentile(residuals, 0.1),
        residualP90: percentile(residuals, 0.9),
        residualSpread: percentile(residuals, 0.9) - percentile(residuals, 0.1),
        baseLocalSpread: localBaseSpread(table, area),
      } : {}),
      observedTimingStepCount,
      baseAlignedTimingStepCount,
      residualTimingStepCount,
      correctionActiveSampleCount,
      correctionEpisodeCount,
      ...(adjacentBaseDifference(table, area) !== undefined
        ? { adjacentBaseAdvanceDifference: adjacentBaseDifference(table, area)! }
        : {}),
    };
  });

  return {
    tableName: table.name,
    tableUnits: table.units,
    areaCount: areas.length,
    mappedAreaCount: attributed.filter((entry) => entry.mappedSampleCount > 0).length,
    areas: attributed,
  };
}
