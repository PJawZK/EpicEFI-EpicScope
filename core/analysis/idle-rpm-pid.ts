import type { NumericChannelRange } from '../log-model/log-types';
import { summarizeIdleRecordedSignal, validateIdleSelection, type IdleRecordedMetric, type IdleRecordedSignal } from './idle-recorded-signal';

export interface IdleRpmPidResult {
  readonly selectedSampleCount: number;
  readonly p: IdleRecordedMetric;
  readonly i: IdleRecordedMetric;
  readonly d: IdleRecordedMetric;
  /** A logged field, not P+I+D, pre-clamp output or a verified fade input. */
  readonly output: IdleRecordedMetric;
  readonly applied: IdleRecordedMetric;
  /** Only commensurate raw terms share a graph axis; never equate raw with pp. */
  readonly termPlotUnit: 'pp' | 'raw' | undefined;
}
/** Descriptive logged outer-controller evidence on the accepted original-index selection.
 * No PID reconstruction, gain recommendation, cadence, clamping or attenuation inference. */
export function analyzeIdleRpmPid(input: {
  readonly rpm: NumericChannelRange;
  readonly sampleIndices: ArrayLike<number>;
  readonly p?: IdleRecordedSignal | undefined;
  readonly i?: IdleRecordedSignal | undefined;
  readonly d?: IdleRecordedSignal | undefined;
  readonly output?: IdleRecordedSignal | undefined;
  readonly applied?: IdleRecordedSignal | undefined;
}): IdleRpmPidResult {
  validateIdleSelection(input.sampleIndices);
  const summarize = (signal: IdleRecordedSignal | undefined, raw = true) => summarizeIdleRecordedSignal(input.rpm,input.sampleIndices,signal,true,raw);
  const p=summarize(input.p), i=summarize(input.i), d=summarize(input.d), output=summarize(input.output), applied=summarize(input.applied,false);
  const units=new Set([p,i,d,output].filter(metric=>metric.status==='available').map(metric=>metric.unit));
  const unit=units.size===1 ? units.values().next().value : undefined;
  return {selectedSampleCount:input.sampleIndices.length,p,i,d,output,applied,termPlotUnit:unit==='pp'||unit==='raw'?unit:undefined};
}
