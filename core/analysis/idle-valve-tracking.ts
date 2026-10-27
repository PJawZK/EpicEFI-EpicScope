import type { NumericChannelRange } from '../log-model/log-types';
import { aggregateNumericSamples } from './numeric-aggregation';
import { summarizeIdleRecordedSignal, validateIdleSelection, type IdleRecordedMetric, type IdleRecordedSignal } from './idle-recorded-signal';

export interface IdleValvePositionInput {
  readonly rpm: NumericChannelRange;
  readonly sampleIndices: ArrayLike<number>;
  readonly requested?: IdleRecordedSignal | undefined;
  readonly measured?: IdleRecordedSignal | undefined;
  readonly motor?: IdleRecordedSignal | undefined;
}
export interface IdleValvePositionResult {
  /** Captured numeric source/selection; aliases existing immutable columns, not copies. */
  readonly input: IdleValvePositionInput;
  readonly selectedSampleCount: number;
  readonly requested: IdleRecordedMetric;
  readonly measured: IdleRecordedMetric;
  readonly motor: IdleRecordedMetric;
  /** Percentage points, measured − requested. Missing/alignment failures are not zero error. */
  readonly tracking: IdleRecordedMetric;
  readonly error: NumericChannelRange | undefined;
}
export interface IdleValveTrackingResult extends IdleValvePositionResult {
  readonly motorReferencePercent: number;
  readonly motorAtReferenceCount: number | undefined;
  readonly motorAtReferencePercent: number | undefined;
}

/** Recorded tracking only. Consumes the existing qualified/union selection; no event, cadence,
 * settling, tune/limit inference, interpolation or time weighting. Input arrays remain immutable. */
export function analyzeIdleValvePosition(input: IdleValvePositionInput): IdleValvePositionResult {
  const {rpm,sampleIndices:selected}=input;
  validateIdleSelection(selected);
  const requested = summarizeIdleRecordedSignal(rpm, selected, input.requested);
  const measured = summarizeIdleRecordedSignal(rpm, selected, input.measured);
  const motor = summarizeIdleRecordedSignal(rpm, selected, input.motor);
  let tracking: IdleRecordedMetric, error: NumericChannelRange | undefined;
  if (!('statistics' in requested) || !('statistics' in measured)) {
    tracking = { status: requested.status === 'incompatible-unit' || measured.status === 'incompatible-unit' ? 'incompatible-unit' : 'missing', unit: 'pp', reason: 'Map compatible recorded requested and measured valve position channels (%).' };
  } else {
    const actual = input.measured!.range, target = input.requested!.range;
    const values = new Float64Array(rpm.values.length).fill(NaN), validity = new Uint8Array(rpm.values.length);
    const indices = new Float64Array(selected.length);
    let overflow = false;
    for (let p = 0; p < selected.length; p++) {
      const index = selected[p]!, local = index - rpm.startSampleIndex, a = index - actual.startSampleIndex, t = index - target.startSampleIndex;
      const time = rpm.timeMs[local];
      const available = local >= 0 && local < rpm.values.length && local < rpm.validity.length
        && a >= 0 && a < actual.values.length && a < actual.validity.length && t >= 0 && t < target.values.length && t < target.validity.length
        && time !== undefined && Number.isFinite(time) && actual.timeMs[a] === time && target.timeMs[t] === time;
      indices[p] = available ? index : NaN;
      if (!available || rpm.validity[local] !== 1 || !Number.isFinite(rpm.values[local])
        || actual.validity[a] !== 1 || target.validity[t] !== 1 || !Number.isFinite(actual.values[a]) || !Number.isFinite(target.values[t])) continue;
      values[local] = actual.values[a]! - target.values[t]!;
      // Derived overflow is unusable evidence, distinct from a healthy zero.
      if (!Number.isFinite(values[local])) overflow = true;
      validity[local] = 1;
    }
    error = { startSampleIndex: rpm.startSampleIndex, timeMs: rpm.timeMs, values, validity };
    const statistics = aggregateNumericSamples(error, { sampleIndices: indices });
    const finite = [statistics.mean, statistics.meanAbsolute, statistics.rootMeanSquare].every(v => v !== undefined && Number.isFinite(v));
    tracking = { status: overflow ? 'nonfinite-metrics' : !statistics.validSampleCount ? 'no-valid-evidence' : finite ? 'available' : 'nonfinite-metrics', unit: 'pp', statistics };
  }
  return {input:{rpm,sampleIndices:selected,requested:input.requested,measured:input.measured,motor:input.motor},selectedSampleCount:selected.length,requested,measured,motor,tracking,error};
}
function validateMotorReference(value: number): void {
  if (!Number.isFinite(value)||value<=0||value>100) throw new RangeError('Enter a motor-duty reference above 0 and at most 100%.');
}
/** Add only the reference count to already accepted position evidence; no second pairing/aggregate pass. */
export function withIdleMotorReference(position: IdleValvePositionResult, motorReferencePercent: number): IdleValveTrackingResult {
  validateMotorReference(motorReferencePercent);
  const {rpm,sampleIndices:selected}=position.input, motor=position.motor;
  let motorAtReferenceCount: number | undefined;
  if ('statistics' in motor && motor.statistics.validSampleCount > 0) {
    motorAtReferenceCount = 0;
    const range = position.input.motor!.range;
    for (let p = 0; p < selected.length; p++) {
      const index = selected[p]!, local = index - rpm.startSampleIndex, other = index - range.startSampleIndex;
      if (local >= 0 && local < rpm.values.length && rpm.validity[local] === 1 && Number.isFinite(rpm.values[local]) && Number.isFinite(rpm.timeMs[local])
        && range.timeMs[other] === rpm.timeMs[local] && range.validity[other] === 1 && Number.isFinite(range.values[other])
        && Math.abs(range.values[other]!) >= motorReferencePercent) motorAtReferenceCount++;
    }
  }
  return {...position,motorReferencePercent,motorAtReferenceCount,
    motorAtReferencePercent:motorAtReferenceCount===undefined||!('statistics' in motor)?undefined:100*motorAtReferenceCount/motor.statistics.validSampleCount};
}
/** Backward-compatible standalone entry; native views can reuse the position result. */
export function analyzeIdleValveTracking(input: IdleValvePositionInput & {readonly motorReferencePercent:number}): IdleValveTrackingResult {
  validateMotorReference(input.motorReferencePercent);
  return withIdleMotorReference(analyzeIdleValvePosition(input),input.motorReferencePercent);
}
