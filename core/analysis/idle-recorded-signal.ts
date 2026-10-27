import type { NumericChannelRange } from '../log-model/log-types';
import { aggregateNumericSamples, type NumericAggregationResult } from './numeric-aggregation';

/** Source-bound scalar evidence: exact original index/time and valid RPM provenance. */
export interface IdleRecordedSignal { readonly range: NumericChannelRange; readonly unit: string; }
export type IdleRecordedMetric =
  | { readonly status: 'missing' | 'incompatible-unit'; readonly unit: '%' | 'pp' | 'raw'; readonly reason: string }
  | { readonly status: 'available' | 'no-valid-evidence' | 'nonfinite-metrics'; readonly unit: '%' | 'pp' | 'raw'; readonly statistics: NumericAggregationResult };
export function validateIdleSelection(selected: ArrayLike<number>): void {
  if (!Number.isSafeInteger(selected.length) || selected.length < 0) throw new RangeError('Invalid Idle recorded analysis selection length.');
  let previous = -1;
  for (let position = 0; position < selected.length; position++) {
    const index = selected[position];
    if (index === undefined || !Number.isSafeInteger(index) || index < 0 || index <= previous) throw new RangeError('Idle recorded analysis requires strictly increasing unique original sample indices.');
    previous = index;
  }
}
/** Raw units require an explicit controller-role contract, never merely an empty source unit. */
export function summarizeIdleRecordedSignal(rpm: NumericChannelRange, selected: ArrayLike<number>, signal: IdleRecordedSignal | undefined, correction = false, allowRawControllerUnits = false): IdleRecordedMetric {
  const raw = allowRawControllerUnits && signal?.unit.trim().toLowerCase() === 'raw';
  const unit = raw ? 'raw' : correction ? 'pp' : '%';
  if (!signal) return { status: 'missing', unit, reason: 'Logged channel not supplied.' };
  const declared = signal.unit.trim().toLowerCase();
  if (!raw && !['%', 'percent', ...(correction ? ['pp', 'percentage points'] : [])].includes(declared)) return { status: 'incompatible-unit', unit, reason: 'Explicit position-percent or correction-percentage-point authority is required.' };
  const { range } = signal;
  let validity = range.validity;
  let indices: ArrayLike<number> = selected;
  // The normal aligned case retains both source arrays and the caller's selection.
  // Copies are made only when this metric must mask an invalid RPM or missing/aligned point.
  for (let position = 0; position < selected.length; position++) {
    const index = selected[position]!, reference = index - rpm.startSampleIndex, local = index - range.startSampleIndex;
    const time = rpm.timeMs[reference];
    if (reference < 0 || reference >= rpm.values.length || reference >= rpm.validity.length || local < 0 || local >= range.values.length || local >= range.validity.length
      || time === undefined || !Number.isFinite(time) || range.timeMs[local] !== time) {
      if (indices === selected) indices = Float64Array.from({length:selected.length},(_,i)=>selected[i]!);
      (indices as Float64Array)[position] = NaN;
    } else if (rpm.validity[reference] !== 1 || !Number.isFinite(rpm.values[reference])) {
      if (validity === range.validity) validity = new Uint8Array(range.validity);
      validity[local] = 0;
    }
  }
  const statistics = aggregateNumericSamples({ ...range, validity }, { sampleIndices: indices });
  const finite = [statistics.mean, statistics.meanAbsolute, statistics.rootMeanSquare, ...(statistics.validSampleCount > 1 ? [statistics.standardDeviation] : [])].every(value => value !== undefined && Number.isFinite(value));
  return { status: !statistics.validSampleCount ? 'no-valid-evidence' : finite ? 'available' : 'nonfinite-metrics', unit, statistics };
}
