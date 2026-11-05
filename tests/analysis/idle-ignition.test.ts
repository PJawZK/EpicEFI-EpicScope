import {describe,expect,it} from 'vitest';
import type {NumericChannelRange} from '../../core/log-model/log-types';
import {analyzeIdleIgnition,normalizeIdleIgnitionUnit} from '../../core/analysis/idle-ignition';
import {analyzeIdleStability} from '../../core/analysis/idle-stability';
import {presentIdleIgnition} from '../../apps/web/src/pages/idle-ignition-presentation';
const range=(values:readonly number[],startSampleIndex=40):NumericChannelRange=>({startSampleIndex,values:Float64Array.from(values),timeMs:Float64Array.from(values,(_,i)=>i*100),validity:new Uint8Array(values.length).fill(1)});
const fixture=()=>({rpm:range([900,1000,1100,1300]),sampleIndices:Uint32Array.from([40,41,42,43]),advance:{range:range([10,14,18,22]),unit:'deg'},correction:{range:range([-4,-2,2,4]),unit:'°'},lambda:{range:range([.9,1,1.1,1]),unit:'lambda'}});
const stats=(metric:ReturnType<typeof analyzeIdleIgnition>['advance'])=>{if(!('statistics'in metric))throw Error(metric.status);return metric.statistics;};
describe('recorded Idle ignition and supporting mixture context',()=>{
 it('keeps absolute advance, signed correction and lambda separate with independent reference arithmetic',()=>{
  const f=fixture(),r=analyzeIdleIgnition(f);expect(stats(r.advance).mean).toBe(16);expect(stats(r.correction)).toMatchObject({mean:0,meanAbsolute:3,validSampleCount:4});expect(stats(r.correction).rootMeanSquare).toBeCloseTo(Math.sqrt(10));expect(stats(r.lambda).mean).toBeCloseTo(1);expect(r.advance.unit).toBe('°');expect(r.lambda.unit).toBe('λ');
  const view=presentIdleIgnition(r,true);expect(view.advanceMean).toBe('16.00');expect(view.correctionMean).toBe('0.00');expect(view.lambdaMean).toBe('1.000');expect(view.limits).toContain('No assumption reconstructs final advance');expect(view.limits).toContain('causal tuning benefit');expect(view.status).toBe('Recorded ignition context');
 });
 it('accepts explicit degree synonyms but never converts radians/time/ATDC or AFR into the required quantity',()=>{
  for(const unit of ['deg','degrees','degree','°'])expect(normalizeIdleIgnitionUnit(unit,'ignitionCorrection')).toBe('°');
  expect(normalizeIdleIgnitionUnit('deg BTDC','ignitionAdvance')).toBe('°');expect(normalizeIdleIgnitionUnit('deg BTDC','ignitionCorrection')).toBeUndefined();
  for(const unit of ['', 'rad','us','ms','deg ATDC','%'])expect(analyzeIdleIgnition({...fixture(),advance:{...fixture().advance,unit}}).advance.status).toBe('incompatible-unit');
  expect(analyzeIdleIgnition({...fixture(),lambda:{...fixture().lambda,unit:'AFR'}}).lambda.status).toBe('incompatible-unit');
  expect(normalizeIdleIgnitionUnit('λ','ignitionLambda')).toBe('λ');
 });
 it('requires exact original index/time alignment and preserves independent invalid/unavailable denominators',()=>{
  const f=fixture();f.correction.range={...range([-2,2,4],41),timeMs:Float64Array.from([100,201,300]),validity:Uint8Array.from([1,1,0])};const original=f.correction.range.validity.slice();
  const r=analyzeIdleIgnition(f);expect(stats(r.correction)).toMatchObject({inputSampleCount:4,validSampleCount:1,invalidSampleCount:1,unavailableSampleCount:2,mean:-2});expect(stats(r.advance).validSampleCount).toBe(4);expect(stats(r.lambda).validSampleCount).toBe(4);expect(f.correction.range.validity).toEqual(original);
 });
 it('rejects nonpositive/nonfinite lambda per metric without changing RPM scope or angular evidence',()=>{
  const f=fixture();f.lambda.range.values.set([0,-1,NaN,1.1]);const original=f.lambda.range.validity.slice();const r=analyzeIdleIgnition(f);expect(stats(r.lambda)).toMatchObject({inputSampleCount:4,validSampleCount:1,invalidSampleCount:3,mean:1.1});expect(stats(r.advance).validSampleCount).toBe(4);expect(r.selectedSampleCount).toBe(4);expect(f.lambda.range.validity).toEqual(original);expect(presentIdleIgnition(r,true).status).toBe('Limited recorded ignition context');
 });
 it('consumes accepted qualified/overlapping/disjoint selection and retains canonical invalid RPM provenance',()=>{
  const f=fixture();const selection=analyzeIdleStability(f.rpm,undefined,{regions:[{startMs:0,endMs:100},{startMs:50,endMs:100},{startMs:299,endMs:301}],eligibility:Uint8Array.from([1,0,1,1])}).sampleIndices;
  const r=analyzeIdleIgnition({...f,sampleIndices:selection});expect(Array.from(selection)).toEqual([40,43]);expect(stats(r.advance).mean).toBe(16);expect(stats(r.correction).mean).toBe(0);expect(stats(r.lambda).mean).toBeCloseTo(.95);
  f.rpm.validity[2]=0;expect(stats(analyzeIdleIgnition(f).advance)).toMatchObject({validSampleCount:3,invalidSampleCount:1});
 });
 it('keeps absent/empty/outside/nonfinite evidence unavailable and rejects invalid source selections',()=>{
  const f=fixture(),none=analyzeIdleIgnition({rpm:f.rpm,sampleIndices:f.sampleIndices});expect(none.advance.status).toBe('missing');expect(presentIdleIgnition(none,true).advanceMean).toBe('Unavailable');expect(presentIdleIgnition(none,true).roles[0]!.unit).toBe('unit unavailable');
  const partial=analyzeIdleIgnition({...f,correction:undefined,lambda:undefined});expect(stats(partial.advance).mean).toBe(16);expect(presentIdleIgnition(partial,true).correctionMean).toBe('Unavailable');
  expect(stats(analyzeIdleIgnition({...f,sampleIndices:[]}).advance).validSampleCount).toBe(0);expect(stats(analyzeIdleIgnition({...f,sampleIndices:[39,44]}).advance).unavailableSampleCount).toBe(2);
  f.advance.range.values.fill(1e308);expect(analyzeIdleIgnition(f).advance.status).toBe('nonfinite-metrics');expect(presentIdleIgnition(analyzeIdleIgnition(f),true).advanceMean).toBe('Unavailable');
  for(const sampleIndices of [[40,40],[41,40],[-1],[NaN],[1.5]])expect(()=>analyzeIdleIgnition({...f,sampleIndices})).toThrow(RangeError);
 });
 it('processes >320k continuous valid samples without spreads or source mutation',()=>{
  const count=320459,timeMs=Float64Array.from({length:count},(_,i)=>i*10),validity=new Uint8Array(count).fill(1),make=(value:number)=>({startSampleIndex:40,timeMs,validity,values:new Float64Array(count).fill(value)});
  const r=analyzeIdleIgnition({rpm:make(1000),sampleIndices:Uint32Array.from({length:count},(_,i)=>i+40),advance:{range:make(16),unit:'deg'},correction:{range:make(-2),unit:'deg'},lambda:{range:make(1.01),unit:'λ'}});expect(stats(r.advance)).toMatchObject({validSampleCount:count,mean:16});expect(stats(r.correction).mean).toBe(-2);expect(presentIdleIgnition(r,true).lambdaMean).toBe('1.010');expect(validity.every(v=>v===1)).toBe(true);
 });
});
