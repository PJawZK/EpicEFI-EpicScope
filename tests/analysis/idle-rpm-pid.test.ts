import {describe,expect,it} from 'vitest';
import type {NumericChannelRange} from '../../core/log-model/log-types';
import {analyzeIdleRpmPid} from '../../core/analysis/idle-rpm-pid';
import {analyzeIdleStability} from '../../core/analysis/idle-stability';
import {presentIdleRpmPid} from '../../apps/web/src/pages/idle-rpm-pid-presentation';
const range=(values:readonly number[],startSampleIndex=40):NumericChannelRange=>({startSampleIndex,values:Float64Array.from(values),timeMs:Float64Array.from(values,(_,i)=>i*100),validity:new Uint8Array(values.length).fill(1)});
const fixture=()=>({rpm:range([1000,1000,1000,1000]),sampleIndices:Uint32Array.from([40,41,42,43]),p:{range:range([-3,3,-3,3]),unit:'raw'},i:{range:range([1,2,3,4]),unit:'raw'},d:{range:range([-4,4,-4,4]),unit:'raw'},output:{range:range([30,30,5,5]),unit:'raw'},applied:{range:range([0,1,2,3]),unit:'pp'}});
const stats=(metric:ReturnType<typeof analyzeIdleRpmPid>['p'])=>{if(!('statistics'in metric))throw Error(metric.status);return metric.statistics;};
describe('logged native outer RPM PID evidence',()=>{
 it('preserves signed terms and RMS activity without reconstructing output or claiming fade',()=>{
  const f=fixture(),r=analyzeIdleRpmPid(f);expect(stats(r.p)).toMatchObject({mean:0,rootMeanSquare:3,meanAbsolute:3});expect(stats(r.i).mean).toBe(2.5);expect(stats(r.d).rootMeanSquare).toBe(4);expect(stats(r.output).mean).toBe(17.5);expect(stats(r.applied).mean).toBe(1.5);expect(r.termPlotUnit).toBe('raw');
  const view=presentIdleRpmPid(r,true);expect(view.pRms).toBe('3.00');expect(view.iMean).toBe('2.50');expect(view.dRms).toBe('4.00');expect(view.appliedMean).toBe('1.50');expect(view.roles[0]!.unit).toContain('unspecified');expect(view.limits).toContain('not assumed to equal P + I + D');expect(view.status).toBe('Limited recorded RPM PID evidence');expect(view.limits).toContain('No fixed +30');
 });
 it('accepts declared correction units but refuses to combine mixed term units on one axis',()=>{
  const f=fixture(),r=analyzeIdleRpmPid({...f,p:{...f.p,unit:'%'},i:{...f.i,unit:'percent'},d:{...f.d,unit:'pp'},output:{...f.output,unit:'percentage points'}});expect(r.termPlotUnit).toBe('pp');expect(presentIdleRpmPid(r,true).gates.every(gate=>gate.value.startsWith('Unavailable'))).toBe(true);expect(presentIdleRpmPid(r,true).status).toBe('Recorded RPM PID evidence');
  const mixed=analyzeIdleRpmPid({...f,p:{...f.p,unit:'pp'}});expect(mixed.termPlotUnit).toBeUndefined();expect(mixed.p.status).toBe('available');expect(mixed.i.status).toBe('available');
  expect(analyzeIdleRpmPid({...f,applied:{...f.applied,unit:'raw'}}).applied.status).toBe('incompatible-unit');
 });
 it('preserves independent invalid/unavailable counts and exact source index/time alignment',()=>{
  const f=fixture();f.p.range={...range([3,-3,3],41),timeMs:Float64Array.from([100,201,300]),validity:Uint8Array.from([1,1,0])};const original=f.p.range.validity.slice();
  const r=analyzeIdleRpmPid(f);expect(stats(r.p)).toMatchObject({inputSampleCount:4,validSampleCount:1,invalidSampleCount:1,unavailableSampleCount:2,mean:3});expect(stats(r.i).validSampleCount).toBe(4);expect(f.p.range.validity).toEqual(original);
  f.rpm.validity[1]=0;expect(stats(analyzeIdleRpmPid(f).i)).toMatchObject({validSampleCount:3,invalidSampleCount:1});
 });
 it('uses accepted deduplicated/qualified regions without discovering or changing selection',()=>{
  const f=fixture();const selection=analyzeIdleStability(f.rpm,undefined,{regions:[{startMs:0,endMs:100},{startMs:50,endMs:100},{startMs:299,endMs:301}],eligibility:Uint8Array.from([1,0,1,1])}).sampleIndices;
  const r=analyzeIdleRpmPid({...f,sampleIndices:selection});expect([...selection]).toEqual([40,43]);expect(stats(r.i).mean).toBe(2.5);expect(stats(r.applied).mean).toBe(1.5);expect(r.selectedSampleCount).toBe(2);
 });
 it('never invents missing terms, output, engineering units or healthy zeros',()=>{
  const f=fixture(),none=analyzeIdleRpmPid({rpm:f.rpm,sampleIndices:f.sampleIndices});expect(none.p.status).toBe('missing');expect(none.termPlotUnit).toBeUndefined();expect(presentIdleRpmPid(none,true).pRms).toBe('Unavailable');expect(presentIdleRpmPid(none,true).roles[0]!.unit).toBe('unit unavailable');
  for(const unit of ['', 'rpm','V','steps','fraction'])expect(analyzeIdleRpmPid({...f,p:{...f.p,unit}}).p.status).toBe('incompatible-unit');
  const noOutput=analyzeIdleRpmPid({...f,output:undefined,applied:undefined});expect(noOutput.output.status).toBe('missing');expect(noOutput.p.status).toBe('available');expect(presentIdleRpmPid(noOutput,true).appliedMean).toBe('Unavailable');
 });
 it('handles empty/invalid/nonfinite grids and rejects duplicate or unordered selections',()=>{
  const f=fixture();expect(stats(analyzeIdleRpmPid({...f,sampleIndices:[]}).p).validSampleCount).toBe(0);expect(stats(analyzeIdleRpmPid({...f,sampleIndices:[39,44]}).p).unavailableSampleCount).toBe(2);
  f.p.range.values.fill(1e308);expect(analyzeIdleRpmPid(f).p.status).toBe('nonfinite-metrics');expect(presentIdleRpmPid(analyzeIdleRpmPid(f),true).pRms).toBe('Unavailable');
  f.i.range.values[0]=Infinity;expect(stats(analyzeIdleRpmPid(f).i).invalidSampleCount).toBe(1);
  for(const sampleIndices of [[40,40],[41,40],[NaN],[-1],[1.5]])expect(()=>analyzeIdleRpmPid({...f,sampleIndices})).toThrow(RangeError);
 });
 it('processes >320k continuous valid samples without spreads or mutation',()=>{
  const count=320459,timeMs=Float64Array.from({length:count},(_,i)=>i*10),validity=new Uint8Array(count).fill(1),make=(value:number)=>({startSampleIndex:40,timeMs,validity,values:new Float64Array(count).fill(value)});
  const r=analyzeIdleRpmPid({rpm:make(1000),sampleIndices:Uint32Array.from({length:count},(_,i)=>i+40),p:{range:make(-3),unit:'raw'},i:{range:make(2),unit:'raw'},d:{range:make(4),unit:'raw'},output:{range:make(30),unit:'raw'},applied:{range:make(5),unit:'pp'}});
  expect(stats(r.p)).toMatchObject({validSampleCount:count,mean:-3,rootMeanSquare:3});expect(stats(r.output).mean).toBe(30);expect(stats(r.applied).mean).toBe(5);expect(validity.every(v=>v===1)).toBe(true);
 });
});
