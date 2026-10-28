import {describe,expect,it} from 'vitest';
import type {NumericChannelRange} from '../../core/log-model/log-types';
import {analyzeIdleValvePosition,withIdleMotorReference,analyzeIdleValveTracking} from '../../core/analysis/idle-valve-tracking';
import {analyzeIdlePositionPid} from '../../core/analysis/idle-position-pid';
import {analyzeIdleStability} from '../../core/analysis/idle-stability';
import {presentIdlePositionPid} from '../../apps/web/src/pages/idle-position-pid-presentation';
const range=(values:readonly number[],startSampleIndex=40):NumericChannelRange=>({startSampleIndex,values:Float64Array.from(values),timeMs:Float64Array.from(values,(_,i)=>i*100),validity:new Uint8Array(values.length).fill(1)});
const fixture=()=>({rpm:range([1000,1000,1000,1000]),sampleIndices:Uint32Array.from([40,41,42,43]),requested:{range:range([10,20,30,40]),unit:'%'},measured:{range:range([12,18,36,40]),unit:'%'},motor:{range:range([-95,95,94,-100]),unit:'%'},feedForward:{range:range([10,14,18,22]),unit:'raw'},p:{range:range([-2,2,-2,2]),unit:'raw'},i:{range:range([-3,-1,1,3]),unit:'raw'},d:{range:range([-4,4,-4,4]),unit:'raw'}});
const stats=(metric:ReturnType<typeof analyzeIdlePositionPid>['i'])=>{if(!('statistics'in metric))throw Error(metric.status);return metric.statistics;};
describe('native inner position PID and recorded feed-forward',()=>{
 it('keeps logged feed-forward, inner terms, signed motor and position error distinct',()=>{
  const f=fixture(),position=analyzeIdleValvePosition(f),r=analyzeIdlePositionPid({...f,position});expect(r.position).toBe(position);expect(stats(r.feedForward).mean).toBe(16);expect(stats(r.i)).toMatchObject({mean:0,validSampleCount:4});expect(stats(r.i).rootMeanSquare).toBeCloseTo(Math.sqrt(5));expect(stats(r.p).rootMeanSquare).toBe(2);expect(stats(r.d).rootMeanSquare).toBe(4);
  expect(stats(r.position.motor).mean).toBeCloseTo(-1.5);expect(stats(r.position.tracking).rootMeanSquare).toBeCloseTo(Math.sqrt(11));expect(r.termPlotUnit).toBe('raw');
  const view=presentIdlePositionPid(r,true);expect(view.feedMean).toBe('16.00');expect(view.iMean).toBe('0.00');expect(view.motorMean).toBe('-1.50');expect(view.trackingRms).toBe('3.32');expect(view.roles[0]!.unit).toContain('unspecified');expect(view.gates[0]!.value).toContain('Unavailable');expect(view.limits).toContain('not assumed to equal bias + P + I + D');
 });
 it('adds a motor reference without redoing accepted position pairing/aggregates',()=>{
  const f=fixture(),position=analyzeIdleValvePosition(f),a=withIdleMotorReference(position,95),b=withIdleMotorReference(position,100);
  expect(a.tracking).toBe(position.tracking);expect(b.tracking).toBe(position.tracking);expect(a.error).toBe(b.error);expect(a.requested).toBe(position.requested);expect(a.motorAtReferencePercent).toBe(75);expect(b.motorAtReferencePercent).toBe(25);
  expect(analyzeIdleValveTracking({...f,motorReferencePercent:95}).tracking).toEqual(position.tracking);
  for(const value of [0,101,NaN,Infinity])expect(()=>withIdleMotorReference(position,value)).toThrow(RangeError);
 });
 it('uses captured qualified/disjoint scope and exact per-role indices/timestamps without input mutation',()=>{
  const f=fixture();f.i.range={...range([-1,1,3],41),timeMs:Float64Array.from([100,201,300]),validity:Uint8Array.from([1,1,0])};const original=f.i.range.validity.slice();const r=analyzeIdlePositionPid({...f,position:analyzeIdleValvePosition(f)});
  expect(stats(r.i)).toMatchObject({inputSampleCount:4,validSampleCount:1,invalidSampleCount:1,unavailableSampleCount:2,mean:-1});expect(stats(r.feedForward).validSampleCount).toBe(4);expect(f.i.range.validity).toEqual(original);
  const selection=analyzeIdleStability(f.rpm,undefined,{regions:[{startMs:0,endMs:100},{startMs:50,endMs:100},{startMs:299,endMs:301}],eligibility:Uint8Array.from([1,0,1,1])}).sampleIndices;
  const scoped=analyzeIdlePositionPid({...f,position:analyzeIdleValvePosition({...f,sampleIndices:selection})});expect(Array.from(scoped.position.input.sampleIndices)).toEqual([40,43]);expect(stats(scoped.feedForward).mean).toBe(16);expect(stats(scoped.i)).toMatchObject({validSampleCount:0,invalidSampleCount:1,unavailableSampleCount:1});
 });
 it('supports declared duty percent or pp, but never mixes incompatible term axes',()=>{
  const f=fixture(),position=analyzeIdleValvePosition(f),known=analyzeIdlePositionPid({position,feedForward:{...f.feedForward,unit:'%'},p:{...f.p,unit:'percent'},i:{...f.i,unit:'%'},d:{...f.d,unit:'%'}});expect(known.termPlotUnit).toBe('%');expect(known.i.unit).toBe('%');
  expect(analyzeIdlePositionPid({position,p:{...f.p,unit:'pp'},i:{...f.i,unit:'percentage points'}}).termPlotUnit).toBe('pp');expect(analyzeIdlePositionPid({...f,position,p:{...f.p,unit:'%'}}).termPlotUnit).toBeUndefined();
  for(const unit of ['', 'rpm','V','steps','fraction'])expect(analyzeIdlePositionPid({...f,position,i:{...f.i,unit}}).i.status).toBe('incompatible-unit');
  expect(presentIdlePositionPid(known,true).gates[0]!.value).toContain('Unavailable');
 });
 it('preserves independent evidence when feed-forward, terms or position feedback are missing',()=>{
  const f=fixture(),position=analyzeIdleValvePosition({rpm:f.rpm,sampleIndices:f.sampleIndices,motor:f.motor}),r=analyzeIdlePositionPid({position,i:f.i});expect(r.position.tracking.status).toBe('missing');expect(r.feedForward.status).toBe('missing');expect(r.i.status).toBe('available');expect(presentIdlePositionPid(r,true).feedMean).toBe('Unavailable');expect(presentIdlePositionPid(r,true).roles[0]!.unit).toBe('unit unavailable');
  expect(presentIdlePositionPid(analyzeIdlePositionPid({position}),true).status).toBe('Position PID/feed-forward evidence unavailable');
 });
 it('accounts for invalid RPM, empty/outside selections and nonfinite derived statistics',()=>{
  const f=fixture();f.rpm.validity[0]=0;expect(stats(analyzeIdlePositionPid({...f,position:analyzeIdleValvePosition(f)}).i)).toMatchObject({validSampleCount:3,invalidSampleCount:1});
  expect(stats(analyzeIdlePositionPid({...f,position:analyzeIdleValvePosition({...f,sampleIndices:[]})}).i).validSampleCount).toBe(0);
  expect(stats(analyzeIdlePositionPid({...f,position:analyzeIdleValvePosition({...f,sampleIndices:[39,44]})}).i).unavailableSampleCount).toBe(2);
  f.i.range.values.fill(1e308);const huge=analyzeIdlePositionPid({...f,position:analyzeIdleValvePosition(f)});expect(huge.i.status).toBe('nonfinite-metrics');expect(presentIdlePositionPid(huge,true).iMean).toBe('Unavailable');
 });
 it('handles >320k continuous valid samples and aliases the shared position evidence',()=>{
  const count=320459,timeMs=Float64Array.from({length:count},(_,i)=>i*10),validity=new Uint8Array(count).fill(1),make=(value:number)=>({startSampleIndex:40,timeMs,validity,values:new Float64Array(count).fill(value)});
  const position=analyzeIdleValvePosition({rpm:make(1000),sampleIndices:Uint32Array.from({length:count},(_,i)=>i+40),requested:{range:make(20),unit:'%'},measured:{range:make(22),unit:'%'},motor:{range:make(-95),unit:'%'}});
  const r=analyzeIdlePositionPid({position,feedForward:{range:make(10),unit:'raw'},p:{range:make(-2),unit:'raw'},i:{range:make(3),unit:'raw'},d:{range:make(4),unit:'raw'}});expect(stats(r.i)).toMatchObject({validSampleCount:count,mean:3});expect(stats(r.feedForward).mean).toBe(10);expect(r.position.error).toBe(position.error);expect(withIdleMotorReference(position,95).motorAtReferenceCount).toBe(count);expect(validity.every(v=>v===1)).toBe(true);
 });
});
