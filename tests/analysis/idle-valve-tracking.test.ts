import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { analyzeIdleValveTracking } from '../../core/analysis/idle-valve-tracking';
import { analyzeIdleStability } from '../../core/analysis/idle-stability';
import { presentIdleValveTracking } from '../../apps/web/src/pages/idle-valve-presentation';
const range = (values: readonly number[], startSampleIndex=40): NumericChannelRange => ({startSampleIndex,values:Float64Array.from(values),timeMs:Float64Array.from(values,(_,i)=>i*100),validity:new Uint8Array(values.length).fill(1)});
const fixture = () => ({rpm:range([1000,1000,1000,1000]),sampleIndices:Uint32Array.from([40,41,42,43]),requested:{range:range([10,20,30,40]),unit:'%'},measured:{range:range([12,18,36,40]),unit:'percent'},motor:{range:range([-95,95,94,-100]),unit:'%'},motorReferencePercent:95});
const stats = (result:ReturnType<typeof analyzeIdleValveTracking>['tracking']) => {if(!('statistics' in result))throw Error(result.status);return result.statistics;};
describe('native recorded DC valve tracking',()=>{
 it('uses measured minus requested pp, independent motor counts and inclusive signed-magnitude reference',()=>{
  const f=fixture(),original=f.measured.range.values.slice(),r=analyzeIdleValveTracking(f);
  expect(r.tracking.status).toBe('available');expect(stats(r.tracking)).toMatchObject({validSampleCount:4,mean:1.5,meanAbsolute:2.5,min:-2,max:6});expect(stats(r.tracking).rootMeanSquare).toBeCloseTo(Math.sqrt(11));
  expect([...r.error!.values]).toEqual([2,-2,6,0]);expect(r.error!.startSampleIndex).toBe(40);expect(r.error!.timeMs).toBe(f.rpm.timeMs);
  expect(stats(r.motor).mean).toBeCloseTo(-1.5);expect(r.motorAtReferenceCount).toBe(3);expect(r.motorAtReferencePercent).toBe(75);expect(f.measured.range.values).toEqual(original);
  const p=presentIdleValveTracking(r,true);expect(p.signedError).toBe('1.50');expect(p.rmse).toBe('3.32');expect(p.reference).toBe('75.0%');expect(p.limits).toContain('measured − requested');expect(p.limits).toContain('not a firmware saturation limit');
 });
 it('does not borrow, align by nearest time or interpolate missing original observations',()=>{
  const f=fixture();f.measured.range={...range([18,36,40],41),timeMs:Float64Array.from([100,201,300]),validity:Uint8Array.from([1,1,0])};
  const r=analyzeIdleValveTracking(f);expect(stats(r.tracking)).toMatchObject({inputSampleCount:4,validSampleCount:1,invalidSampleCount:1,unavailableSampleCount:2,mean:-2});
  expect([...r.error!.validity]).toEqual([0,1,0,0]);expect(stats(r.motor).validSampleCount).toBe(4);expect(presentIdleValveTracking(r,true).status).toBe('Limited recorded valve tracking');
 });
 it('respects canonical RPM validity and qualified disjoint/overlapping region selection',()=>{
  const f=fixture();f.rpm.validity[2]=0;const selected=analyzeIdleStability(f.rpm,undefined,{regions:[{startMs:0,endMs:100},{startMs:50,endMs:100},{startMs:299,endMs:301}]}).sampleIndices;
  const r=analyzeIdleValveTracking({...f,sampleIndices:selected});expect(stats(r.tracking)).toMatchObject({inputSampleCount:3,validSampleCount:3,mean:0});expect(r.motorAtReferencePercent).toBe(100);
  const all=analyzeIdleValveTracking(f);expect(stats(all.tracking)).toMatchObject({validSampleCount:3,invalidSampleCount:1});expect(stats(all.motor).validSampleCount).toBe(3);
  const qualified=analyzeIdleStability(f.rpm,undefined,{eligibility:Uint8Array.from([1,0,0,1])});expect(stats(analyzeIdleValveTracking({...f,sampleIndices:qualified.sampleIndices}).tracking).validSampleCount).toBe(2);
 });
 it('keeps absent and incompatible roles explicit, without inventing zero tracking or motor effort',()=>{
  const f=fixture();const none=analyzeIdleValveTracking({rpm:f.rpm,sampleIndices:f.sampleIndices,motorReferencePercent:95});expect(none.tracking.status).toBe('missing');expect(none.error).toBeUndefined();expect(none.motorAtReferencePercent).toBeUndefined();expect(presentIdleValveTracking(none,true).rmse).toBe('Unavailable');
  for(const unit of ['', 'V','steps','fraction','pp']){const r=analyzeIdleValveTracking({...f,measured:{...f.measured,unit}});expect(r.measured.status).toBe('incompatible-unit');expect(r.tracking.status).toBe('incompatible-unit');}
  const noMotor=analyzeIdleValveTracking({...f,motor:undefined});expect(noMotor.tracking.status).toBe('available');expect(noMotor.motor.status).toBe('missing');expect(noMotor.motorAtReferenceCount).toBeUndefined();
 });
 it('handles empty, invalid, nonfinite and out-of-source evidence without mutating inputs',()=>{
  const f=fixture();expect(stats(analyzeIdleValveTracking({...f,sampleIndices:[]}).tracking).validSampleCount).toBe(0);
  f.measured.range.values[0]=Infinity;f.requested.range.validity[1]=0;expect(stats(analyzeIdleValveTracking(f).tracking)).toMatchObject({validSampleCount:2,invalidSampleCount:2});
  expect(stats(analyzeIdleValveTracking({...f,sampleIndices:[39,44]}).tracking).unavailableSampleCount).toBe(2);
  f.measured.range.values.fill(1e308);f.requested.range.values.fill(-1e308);const huge=analyzeIdleValveTracking(f);expect(huge.tracking.status).toBe('nonfinite-metrics');expect(presentIdleValveTracking(huge,true).rmse).toBe('Unavailable');
  for(const sampleIndices of [[40,40],[41,40],[NaN],[-1],[1.5]])expect(()=>analyzeIdleValveTracking({...fixture(),sampleIndices})).toThrow(RangeError);
  for(const motorReferencePercent of [0,-1,101,NaN,Infinity])expect(()=>analyzeIdleValveTracking({...fixture(),motorReferencePercent})).toThrow(RangeError);
 });
 it('changes reference counts without changing tracking facts and never labels them firmware saturation',()=>{
  const f=fixture(),a=analyzeIdleValveTracking(f),b=analyzeIdleValveTracking({...f,motorReferencePercent:100});expect(b.motorAtReferencePercent).toBe(25);expect(b.tracking).toEqual(a.tracking);
  const view=presentIdleValveTracking(b,false);expect(view.status).toBe('Limited recorded valve tracking');expect(view.observed).toContain('≥ 100%');expect(view.next).toContain('Review per-role');
 });
 it('handles >320k continuous valid samples without argument spreads or input mutation',()=>{
  const count=320459,timeMs=Float64Array.from({length:count},(_,i)=>i*10),validity=new Uint8Array(count).fill(1),make=(value:number)=>({startSampleIndex:40,timeMs,validity,values:new Float64Array(count).fill(value)});
  const r=analyzeIdleValveTracking({rpm:make(1000),sampleIndices:Uint32Array.from({length:count},(_,i)=>i+40),requested:{range:make(20),unit:'%'},measured:{range:make(22),unit:'%'},motor:{range:make(-95),unit:'%'},motorReferencePercent:95});
  expect(stats(r.tracking)).toMatchObject({validSampleCount:count,mean:2,rootMeanSquare:2});expect(r.motorAtReferenceCount).toBe(count);expect(r.motorAtReferencePercent).toBe(100);expect(r.error!.timeMs).toBe(timeMs);expect(validity.every(v=>v===1)).toBe(true);
 });
});
