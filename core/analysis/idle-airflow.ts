import type { NumericChannelRange } from '../log-model/log-types';
import { aggregateNumericSamples, type NumericAggregationResult } from './numeric-aggregation';

/** Logged request context only: position travel %, correction percentage points. Not measured airflow. */
export interface IdleAirflowSignal { readonly range: NumericChannelRange; readonly unit: string; }
export type IdleAirflowMetric =
  | { readonly status: 'missing' | 'incompatible-unit'; readonly unit: '%' | 'pp'; readonly reason: string }
  | { readonly status: 'available' | 'no-valid-evidence' | 'nonfinite-metrics'; readonly unit: '%' | 'pp'; readonly statistics: NumericAggregationResult };
export interface IdleAirflowResult {
  readonly status: 'recorded-context' | 'limited' | 'unavailable';
  readonly selectedSampleCount: number;
  readonly basePosition: IdleAirflowMetric;
  readonly closedLoop: IdleAirflowMetric;
  readonly finalPosition: IdleAirflowMetric;
}

/** Consume an already deduplicated original-index scope (e.g. Stability.sampleIndices).
 * No scope discovery, qualification, interpolation, tune inference or source mutation.
 */
export function analyzeIdleAirflow(input: {
  readonly rpm: NumericChannelRange;
  readonly sampleIndices: ArrayLike<number>;
  readonly basePosition?: IdleAirflowSignal;
  readonly closedLoop?: IdleAirflowSignal;
  readonly finalPosition?: IdleAirflowSignal;
}): IdleAirflowResult {
  const selected = input.sampleIndices;
  if (!Number.isSafeInteger(selected.length) || selected.length < 0) throw new RangeError('Invalid Idle Airflow selection length.');
  let previous = -1;
  for (let position = 0; position < selected.length; position++) {
    const index = selected[position];
    if (index === undefined || !Number.isSafeInteger(index) || index < 0 || index <= previous) throw new RangeError('Idle Airflow requires strictly increasing unique original sample indices.');
    previous = index;
  }
  const summarize = (signal: IdleAirflowSignal | undefined, correction: boolean): IdleAirflowMetric => {
    const unit = correction ? 'pp' : '%';
    if (!signal) return { status: 'missing', unit, reason: 'Logged channel not supplied.' };
    const declared = signal.unit.trim().toLowerCase();
    if (!['%', 'percent', ...(correction ? ['pp', 'percentage points'] : [])].includes(declared)) return { status: 'incompatible-unit', unit, reason: 'Explicit position-percent or correction-percentage-point authority is required.' };
    const { range } = signal, rpm = input.rpm;
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
  };
  const basePosition = summarize(input.basePosition, false), closedLoop = summarize(input.closedLoop, true), finalPosition = summarize(input.finalPosition, false);
  const metrics = [basePosition, closedLoop, finalPosition];
  const available = metrics.filter(metric => metric.status === 'available');
  const complete = metrics.every(metric => 'statistics' in metric && metric.statistics.invalidSampleCount === 0 && metric.statistics.unavailableSampleCount === 0);
  return { status: available.length === 3 && complete ? 'recorded-context' : available.length ? 'limited' : 'unavailable', selectedSampleCount: selected.length, basePosition, closedLoop, finalPosition };
}
