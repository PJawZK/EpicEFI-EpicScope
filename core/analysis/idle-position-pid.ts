import type { IdleValvePositionResult } from './idle-valve-tracking';
import { summarizeIdleRecordedSignal, type IdleRecordedMetric, type IdleRecordedSignal } from './idle-recorded-signal';

export interface IdlePositionPidResult {
  readonly position: IdleValvePositionResult;
  /** Independently logged feed-forward; neither a normalized tune curve nor verified actuator assignment. */
  readonly feedForward: IdleRecordedMetric;
  readonly p: IdleRecordedMetric;
  readonly i: IdleRecordedMetric;
  readonly d: IdleRecordedMetric;
  readonly termPlotUnit: '%' | 'pp' | 'raw' | undefined;
}
/** Reuse the accepted position source/selection. No PID reconstruction, tune interpolation,
 * controller-state inference or extra valve pairing. Terms retain their own aligned denominators. */
export function analyzeIdlePositionPid(input: {
  readonly position: IdleValvePositionResult;
  readonly feedForward?: IdleRecordedSignal | undefined;
  readonly p?: IdleRecordedSignal | undefined;
  readonly i?: IdleRecordedSignal | undefined;
  readonly d?: IdleRecordedSignal | undefined;
}): IdlePositionPidResult {
  const {rpm,sampleIndices}=input.position.input;
  const summarize=(signal:IdleRecordedSignal|undefined)=>summarizeIdleRecordedSignal(rpm,sampleIndices,signal,['pp','percentage points'].includes(signal?.unit.trim().toLowerCase()??''),true);
  const feedForward=summarize(input.feedForward),p=summarize(input.p),i=summarize(input.i),d=summarize(input.d);
  const units=new Set([feedForward,p,i,d].filter(metric=>metric.status==='available').map(metric=>metric.unit));
  const unit=units.size===1?units.values().next().value:undefined;
  return {position:input.position,feedForward,p,i,d,termPlotUnit:unit==='raw'||unit==='%'||unit==='pp'?unit:undefined};
}
