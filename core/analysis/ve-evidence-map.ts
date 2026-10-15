import type { NumericChannelRange } from '../log-model/log-types';
import type { NumericHeatmapAxisBin } from './heatmap';
import { robustWeightedEstimate, type WeightedObservation } from './ve-evidence-statistics';
import { axisBreakpointContributions } from './weighted-cell-mean';

export interface VeTableGeometry {
  readonly rpmBins: readonly number[];
  readonly loadBins: readonly number[];
  readonly values: readonly number[];
  readonly rows: number;
  readonly cols: number;
}

export interface VeEvidenceInputs {
  readonly actualMixture: NumericChannelRange;
  readonly rpm: NumericChannelRange;
  readonly load: NumericChannelRange;
  readonly target: VeTableGeometry;
  readonly veRpmBins: readonly number[];
  readonly veLoadBins: readonly number[];
  readonly sampleIndices?: ArrayLike<number>;
  /** Applied fuel correction in percent, where +5 means 5% extra fuel. */
  readonly fuelCorrectionPercent?: NumericChannelRange;
}

export interface VeEvidenceConfig {
  readonly minimumRpm?: number;
  readonly maximumRpm?: number;
  readonly minimumLoad?: number;
  readonly maximumLoad?: number;
  readonly minimumStableDurationMs?: number;
  readonly maximumRpmRatePerSecond?: number;
  readonly maximumLoadRatePerSecond?: number;
  readonly minimumIndividualWeight?: number;
  /** Working observed-mixture delay. Engine state is sampled at mixtureTime - delayMs. */
  readonly delayMs?: number;
  /** Apply fuelCorrectionPercent to remove known closed-loop fuel contribution from base-VE evidence. */
  readonly compensateFuelCorrectionPercent?: boolean;
}

export type VeEvidenceConfidence = 'none' | 'limited' | 'moderate' | 'strong';

export interface VeEvidenceCell {
  readonly row: number;
  readonly col: number;
  readonly sampleCount: number;
  readonly totalWeight: number;
  /** Robust weighted median correction ratio. */
  readonly correctionRatio: number | undefined;
  readonly correctionPercent: number | undefined;
  readonly correctionP10Ratio: number | undefined;
  readonly correctionP90Ratio: number | undefined;
  readonly correctionSpreadPercent: number | undefined;
  readonly confidence: VeEvidenceConfidence;
  readonly sampleIndices: Uint32Array;
}

export interface VeEvidenceMapResult {
  readonly inputSampleCount: number;
  readonly validAlignedSampleCount: number;
  readonly rangeRejectedSampleCount: number;
  readonly transientRejectedSampleCount: number;
  readonly targetOutOfRangeSampleCount: number;
  readonly veOutOfRangeSampleCount: number;
  readonly delayUnavailableSampleCount: number;
  readonly fuelCorrectionUnavailableSampleCount: number;
  readonly fuelCorrectionCompensatedSampleCount: number;
  readonly invalidSampleCount: number;
  readonly eligibleSampleCount: number;
  readonly contributingSampleCount: number;
  readonly delayMs: number;
  readonly fuelCorrectionCompensated: boolean;
  readonly cells: readonly VeEvidenceCell[];
}

interface Sample {
  readonly sampleIndex: number;
  readonly timeMs: number;
  readonly actual: number;
  readonly rpm: number;
  readonly load: number;
  readonly target: number;
  readonly fuelCorrectionFactor: number;
}

function local(range: NumericChannelRange, sampleIndex: number): number | undefined {
  const index = sampleIndex - range.startSampleIndex;
  return Number.isSafeInteger(index) && index >= 0 && index < range.values.length && index < range.validity.length ? index : undefined;
}

function value(range: NumericChannelRange, sampleIndex: number): { value: number; timeMs: number } | undefined {
  const index = local(range, sampleIndex);
  if (index === undefined || range.validity[index] !== 1) return undefined;
  const result = range.values[index];
  const timeMs = range.timeMs[index];
  if (result === undefined || timeMs === undefined || !Number.isFinite(result) || !Number.isFinite(timeMs)) return undefined;
  return { value: result, timeMs };
}

export function interpolateNumericRangeAtTime(range: NumericChannelRange, timeMs: number): number | undefined {
  if (!Number.isFinite(timeMs) || range.timeMs.length === 0) return undefined;
  const first = range.timeMs[0];
  const last = range.timeMs[range.timeMs.length - 1];
  if (first === undefined || last === undefined || timeMs < first || timeMs > last) return undefined;
  let low = 0;
  let high = range.timeMs.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (timeMs < range.timeMs[mid]!) high = mid;
    else low = mid;
  }
  if (range.timeMs[low] === timeMs) return range.validity[low] === 1 && Number.isFinite(range.values[low]) ? range.values[low] : undefined;
  if (range.timeMs[high] === timeMs) return range.validity[high] === 1 && Number.isFinite(range.values[high]) ? range.values[high] : undefined;
  if (range.validity[low] !== 1 || range.validity[high] !== 1) return undefined;
  const lowTime = range.timeMs[low]!;
  const highTime = range.timeMs[high]!;
  const lowValue = range.values[low]!;
  const highValue = range.values[high]!;
  if (!(highTime > lowTime) || !Number.isFinite(lowValue) || !Number.isFinite(highValue)) return undefined;
  const fraction = (timeMs - lowTime) / (highTime - lowTime);
  return lowValue + (highValue - lowValue) * fraction;
}

function axisBracket(value: number, bins: readonly number[]): { low: number; high: number; fraction: number } | undefined {
  if (!Number.isFinite(value) || bins.length === 0 || value < bins[0]! || value > bins[bins.length - 1]!) return undefined;
  if (bins.length === 1 || value === bins[0]) return { low: 0, high: 0, fraction: 0 };
  const last = bins.length - 1;
  if (value === bins[last]) return { low: last, high: last, fraction: 0 };
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >>> 1;
    if (value < bins[mid]!) high = mid;
    else low = mid;
  }
  const span = bins[high]! - bins[low]!;
  if (!(span > 0)) return undefined;
  return { low, high, fraction: (value - bins[low]!) / span };
}

export function interpolateVeTable(table: VeTableGeometry, rpm: number, load: number): number | undefined {
  if (table.rows !== table.loadBins.length || table.cols !== table.rpmBins.length || table.values.length < table.rows * table.cols) return undefined;
  const x = axisBracket(rpm, table.rpmBins);
  const y = axisBracket(load, table.loadBins);
  if (!x || !y) return undefined;
  const at = (row: number, col: number) => table.values[row * table.cols + col];
  const v00 = at(y.low, x.low);
  if (v00 === undefined || !Number.isFinite(v00)) return undefined;
  if (x.low === x.high && y.low === y.high) return v00;
  const v10 = at(y.low, x.high);
  const v01 = at(y.high, x.low);
  const v11 = at(y.high, x.high);
  if (v10 === undefined || v01 === undefined || v11 === undefined || !Number.isFinite(v10) || !Number.isFinite(v01) || !Number.isFinite(v11)) return undefined;
  const top = x.low === x.high ? v00 : v00 + (v10 - v00) * x.fraction;
  const bottom = x.low === x.high ? v01 : v01 + (v11 - v01) * x.fraction;
  return y.low === y.high ? top : top + (bottom - top) * y.fraction;
}

function selectedIndices(reference: NumericChannelRange, selected?: ArrayLike<number>): number[] {
  if (!selected) return Array.from({ length: reference.values.length }, (_, index) => reference.startSampleIndex + index);
  return Array.from({ length: selected.length }, (_, index) => selected[index]!).filter(Number.isSafeInteger).sort((a, b) => a - b);
}

function slope(samples: readonly Sample[], start: number, end: number, pick: (sample: Sample) => number): number {
  if (end <= start) return 0;
  const origin = samples[start]!.timeMs;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0, n = 0;
  for (let index = start; index <= end; index += 1) {
    const x = (samples[index]!.timeMs - origin) / 1000;
    const y = pick(samples[index]!);
    sx += x; sy += y; sxy += x * y; sx2 += x * x; n += 1;
  }
  const denominator = n * sx2 - sx * sx;
  return denominator > 0 ? (n * sxy - sx * sy) / denominator : 0;
}

function stableSegment(samples: readonly Sample[], durationMs: number, maxRpmRate: number, maxLoadRate: number): Sample[] {
  if (durationMs <= 0) return [...samples];
  const accepted: Sample[] = [];
  let start = 0;
  for (let end = 0; end < samples.length; end += 1) {
    while (start + 1 <= end && samples[end]!.timeMs - samples[start + 1]!.timeMs >= durationMs) start += 1;
    if (samples[end]!.timeMs - samples[start]!.timeMs < durationMs) continue;
    if (Math.abs(slope(samples, start, end, (sample) => sample.rpm)) > maxRpmRate) continue;
    if (Math.abs(slope(samples, start, end, (sample) => sample.load)) > maxLoadRate) continue;
    accepted.push(samples[end]!);
  }
  return accepted;
}

function heatmapBins(values: readonly number[]): readonly NumericHeatmapAxisBin[] {
  return values.map((centerValue, index) => ({
    index,
    centerValue,
    lowerBound: index === 0 ? centerValue : (values[index - 1]! + centerValue) / 2,
    upperBound: index === values.length - 1 ? centerValue : (centerValue + values[index + 1]!) / 2,
    includesUpperBound: index === values.length - 1,
  }));
}

function evidenceConfidence(totalWeight: number, sampleCount: number, spreadPercent: number | undefined): VeEvidenceConfidence {
  if (!(totalWeight > 0) || sampleCount === 0) return 'none';
  if (spreadPercent !== undefined && sampleCount >= 20 && totalWeight >= 20 && spreadPercent <= 10) return 'strong';
  if (spreadPercent !== undefined && sampleCount >= 8 && totalWeight >= 8 && spreadPercent <= 20) return 'moderate';
  return 'limited';
}

export function buildVeEvidenceMap(inputs: VeEvidenceInputs, config: VeEvidenceConfig = {}): VeEvidenceMapResult {
  const indices = selectedIndices(inputs.actualMixture, inputs.sampleIndices);
  const minRpm = config.minimumRpm ?? Number.NEGATIVE_INFINITY;
  const maxRpm = config.maximumRpm ?? Number.POSITIVE_INFINITY;
  const minLoad = config.minimumLoad ?? Number.NEGATIVE_INFINITY;
  const maxLoad = config.maximumLoad ?? Number.POSITIVE_INFINITY;
  const duration = config.minimumStableDurationMs ?? 300;
  const maxRpmRate = config.maximumRpmRatePerSecond ?? 500;
  const maxLoadRate = config.maximumLoadRatePerSecond ?? 25;
  const minWeight = config.minimumIndividualWeight ?? 0;
  const delayMs = config.delayMs ?? 0;
  const compensateFuelCorrection = config.compensateFuelCorrectionPercent === true && inputs.fuelCorrectionPercent !== undefined;
  if (!Number.isFinite(delayMs) || delayMs < 0) throw new RangeError('VE evidence delayMs must be finite and >= 0.');

  let invalidSampleCount = 0;
  let rangeRejectedSampleCount = 0;
  let targetOutOfRangeSampleCount = 0;
  let delayUnavailableSampleCount = 0;
  let fuelCorrectionUnavailableSampleCount = 0;
  let fuelCorrectionCompensatedSampleCount = 0;
  const aligned: Sample[] = [];
  let segment: Sample[] = [];
  const stable: Sample[] = [];
  const finish = (): void => {
    if (!segment.length) return;
    for (const sample of stableSegment(segment, duration, maxRpmRate, maxLoadRate)) stable.push(sample);
    segment = [];
  };

  for (let position = 0; position < indices.length; position += 1) {
    const sampleIndex = indices[position]!;
    const actual = value(inputs.actualMixture, sampleIndex);
    if (!actual || !(actual.value > 0)) { finish(); invalidSampleCount += 1; continue; }
    const engineTimeMs = actual.timeMs - delayMs;
    const rpmValue = delayMs === 0 ? value(inputs.rpm, sampleIndex)?.value : interpolateNumericRangeAtTime(inputs.rpm, engineTimeMs);
    const loadValue = delayMs === 0 ? value(inputs.load, sampleIndex)?.value : interpolateNumericRangeAtTime(inputs.load, engineTimeMs);
    if (rpmValue === undefined || loadValue === undefined) { finish(); delayUnavailableSampleCount += 1; continue; }
    if (rpmValue < minRpm || rpmValue > maxRpm || loadValue < minLoad || loadValue > maxLoad) { finish(); rangeRejectedSampleCount += 1; continue; }
    const target = interpolateVeTable(inputs.target, rpmValue, loadValue);
    if (!(target !== undefined && target > 0)) { finish(); targetOutOfRangeSampleCount += 1; continue; }

    let fuelCorrectionFactor = 1;
    if (compensateFuelCorrection) {
      const correctionPercent = delayMs === 0
        ? value(inputs.fuelCorrectionPercent!, sampleIndex)?.value
        : interpolateNumericRangeAtTime(inputs.fuelCorrectionPercent!, engineTimeMs);
      if (correctionPercent === undefined) { finish(); fuelCorrectionUnavailableSampleCount += 1; continue; }
      fuelCorrectionFactor = 1 + correctionPercent / 100;
      if (!(fuelCorrectionFactor > 0) || !Number.isFinite(fuelCorrectionFactor)) { finish(); fuelCorrectionUnavailableSampleCount += 1; continue; }
      fuelCorrectionCompensatedSampleCount += 1;
    }

    const current: Sample = { sampleIndex, timeMs: engineTimeMs, actual: actual.value, rpm: rpmValue, load: loadValue, target, fuelCorrectionFactor };
    aligned.push(current);
    if (position === 0 || sampleIndex !== indices[position - 1]! + 1 || (segment.length && !(current.timeMs > segment[segment.length - 1]!.timeMs))) finish();
    segment.push(current);
  }
  finish();

  const rpmBins = heatmapBins(inputs.veRpmBins);
  const loadBins = heatmapBins(inputs.veLoadBins);
  const cellCount = rpmBins.length * loadBins.length;
  const weights = new Float64Array(cellCount);
  const counts = new Uint32Array(cellCount);
  const observationLists: WeightedObservation[][] = Array.from({ length: cellCount }, () => []);
  const sampleLists: number[][] = Array.from({ length: cellCount }, () => []);
  let veOutOfRangeSampleCount = 0;
  let contributingSampleCount = 0;

  for (const sample of stable) {
    if (sample.rpm < inputs.veRpmBins[0]! || sample.rpm > inputs.veRpmBins[inputs.veRpmBins.length - 1]!
      || sample.load < inputs.veLoadBins[0]! || sample.load > inputs.veLoadBins[inputs.veLoadBins.length - 1]!) {
      veOutOfRangeSampleCount += 1;
      continue;
    }
    const x = axisBreakpointContributions(sample.rpm, rpmBins);
    const y = axisBreakpointContributions(sample.load, loadBins);
    const ratio = (sample.actual / sample.target) * sample.fuelCorrectionFactor;
    let contributed = false;
    for (const yc of y) for (const xc of x) {
      const weight = xc.weight * yc.weight;
      if (!(weight > 0) || weight < minWeight) continue;
      const cell = yc.index * rpmBins.length + xc.index;
      weights[cell] = (weights[cell] ?? 0) + weight;
      counts[cell] = (counts[cell] ?? 0) + 1;
      observationLists[cell]!.push({ value: ratio, weight });
      sampleLists[cell]!.push(sample.sampleIndex);
      contributed = true;
    }
    if (contributed) contributingSampleCount += 1;
  }

  const cells: VeEvidenceCell[] = [];
  for (let row = 0; row < loadBins.length; row += 1) for (let col = 0; col < rpmBins.length; col += 1) {
    const index = row * rpmBins.length + col;
    const estimate = robustWeightedEstimate(observationLists[index]!);
    const ratio = estimate.median;
    const spreadPercent = estimate.spread === undefined ? undefined : estimate.spread * 100;
    cells.push({
      row,
      col,
      sampleCount: counts[index] ?? 0,
      totalWeight: weights[index] ?? 0,
      correctionRatio: ratio,
      correctionPercent: ratio === undefined ? undefined : (ratio - 1) * 100,
      correctionP10Ratio: estimate.p10,
      correctionP90Ratio: estimate.p90,
      correctionSpreadPercent: spreadPercent,
      confidence: evidenceConfidence(weights[index] ?? 0, counts[index] ?? 0, spreadPercent),
      sampleIndices: Uint32Array.from(sampleLists[index]!),
    });
  }

  return {
    inputSampleCount: indices.length,
    validAlignedSampleCount: aligned.length,
    rangeRejectedSampleCount,
    transientRejectedSampleCount: Math.max(0, aligned.length - stable.length),
    targetOutOfRangeSampleCount,
    veOutOfRangeSampleCount,
    delayUnavailableSampleCount,
    fuelCorrectionUnavailableSampleCount,
    fuelCorrectionCompensatedSampleCount,
    invalidSampleCount,
    eligibleSampleCount: stable.length,
    contributingSampleCount,
    delayMs,
    fuelCorrectionCompensated: compensateFuelCorrection,
    cells,
  };
}
