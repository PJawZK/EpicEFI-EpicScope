import type { NumericChannelRange } from '../log-model/log-types';
import { summarizeIdleRecordedSignal, validateIdleSelection, type IdleRecordedSignal, type IdleRecordedMetric } from './idle-recorded-signal';
export type IdleAirflowSignal = IdleRecordedSignal;
export type IdleAirflowMetric = IdleRecordedMetric;
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
  validateIdleSelection(selected);
  const summarize = (signal: IdleAirflowSignal | undefined, correction: boolean) => summarizeIdleRecordedSignal(input.rpm, selected, signal, correction);
  const basePosition = summarize(input.basePosition, false), closedLoop = summarize(input.closedLoop, true), finalPosition = summarize(input.finalPosition, false);
  const metrics = [basePosition, closedLoop, finalPosition];
  const available = metrics.filter(metric => metric.status === 'available');
  const complete = metrics.every(metric => 'statistics' in metric && metric.statistics.invalidSampleCount === 0 && metric.statistics.unavailableSampleCount === 0);
  return { status: available.length === 3 && complete ? 'recorded-context' : available.length ? 'limited' : 'unavailable', selectedSampleCount: selected.length, basePosition, closedLoop, finalPosition };
}
