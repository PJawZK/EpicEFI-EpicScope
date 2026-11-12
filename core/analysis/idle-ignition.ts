import type {NumericChannelRange} from '../log-model/log-types';
import {aggregateIdleAlignedSignal,idleRecordedMetricFromStatistics,validateIdleSelection,type IdleRecordedSignal,type IdleRecordedMetric} from './idle-recorded-signal';
export type IdleIgnitionRole='ignitionAdvance'|'ignitionCorrection'|'ignitionLambda';
/** Preserve values/signs as recorded. No radians, ATDC sign inversion or AFR/stoich conversion. */
export function normalizeIdleIgnitionUnit(unit:string,role:IdleIgnitionRole):'°'|'λ'|undefined{
  const value=unit.trim().toLowerCase().replace(/\s+/g,'');
  if(role==='ignitionLambda')return ['lambda','λ'].includes(value)?'λ':undefined;
  if(['deg','degree','degrees','°'].includes(value))return '°';
  return role==='ignitionAdvance'&&['degbtdc','degreesbtdc','°btdc'].includes(value)?'°':undefined;
}
export interface IdleIgnitionResult {
  readonly selectedSampleCount:number;
  readonly advance:IdleRecordedMetric;
  readonly correction:IdleRecordedMetric;
  readonly lambda:IdleRecordedMetric;
}
/** Descriptive recorded context only. Absolute advance, signed correction and lambda
 * retain independent aligned denominators; no spark reconstruction, torque or causal model. */
export function analyzeIdleIgnition(input:{readonly rpm:NumericChannelRange;readonly sampleIndices:ArrayLike<number>;readonly advance?:IdleRecordedSignal|undefined;readonly correction?:IdleRecordedSignal|undefined;readonly lambda?:IdleRecordedSignal|undefined}):IdleIgnitionResult{
  validateIdleSelection(input.sampleIndices);
  const summarize=(signal:IdleRecordedSignal|undefined,role:IdleIgnitionRole):IdleRecordedMetric=>{
    const expected=role==='ignitionLambda'?'λ':'°';
    if(!signal)return {status:'missing',unit:expected,reason:'Compatible recorded channel not supplied.'};
    const unit=normalizeIdleIgnitionUnit(signal.unit,role);
    if(!unit)return {status:'incompatible-unit',unit:expected,reason:role==='ignitionLambda'?'Actual lambda units required; AFR conversion is not established.':'Declared degree or verified canonical degree authority is required; timing in microseconds is not an angle.'};
    return idleRecordedMetricFromStatistics(aggregateIdleAlignedSignal(input.rpm,input.sampleIndices,signal.range,role==='ignitionLambda'?value=>value>0:undefined),unit);
  };
  return {selectedSampleCount:input.sampleIndices.length,advance:summarize(input.advance,'ignitionAdvance'),correction:summarize(input.correction,'ignitionCorrection'),lambda:summarize(input.lambda,'ignitionLambda')};
}
