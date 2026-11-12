import { describe, expect, it } from 'vitest';
import { analyzeIdleAirflow, type IdleAirflowMetric } from '../../core/analysis/idle-airflow';
import { analyzeIdleStability } from '../../core/analysis/idle-stability';
import type { NumericChannelRange } from '../../core/log-model/log-types';
const range=(values: readonly number[], startSampleIndex=40):NumericChannelRange=>({startSampleIndex,timeMs:Float64Array.from(values,(_,i)=>i*100),values:Float64Array.from(values),validity:new Uint8Array(values.length).fill(1)});
const stats=(metric:IdleAirflowMetric)=>{if(!('statistics' in metric))throw Error(metric.status);return metric.statistics;};
const fixture=()=>({rpm:range([1000,1000,1000,1000]),sampleIndices:Uint32Array.from([40,41,42,43]),basePosition:{range:range([20,22,24,26]),unit:'%'},closedLoop:{range:range([-2,4,6,-4]),unit:'pp'},finalPosition:{range:range([18,26,30,22]),unit:'percent'}});
describe('logged Idle Base Airflow context',()=>{
  it('reuses sample aggregates with independent signed, magnitude and RMS request facts',()=>{
    const result=analyzeIdleAirflow(fixture());expect(result.status).toBe('recorded-context');expect(result.selectedSampleCount).toBe(4);
    expect(stats(result.basePosition).mean).toBe(23);expect(result.basePosition.unit).toBe('%');expect(result.closedLoop.unit).toBe('pp');
    expect(stats(result.closedLoop)).toMatchObject({meanAbsolute:4,validSampleCount:4});expect(stats(result.closedLoop).mean).toBeCloseTo(1);expect(stats(result.closedLoop).rootMeanSquare).toBeCloseTo(Math.sqrt(18));
    expect(stats(result.finalPosition).mean).toBe(24);expect(stats(result.finalPosition).standardDeviation).toBeCloseTo(Math.sqrt(80/3));
  });
  it('uses the accepted qualified/union scope and preserves invalid RPM provenance without changing arrays',()=>{
    const f=fixture();f.rpm.validity[2]=0;
    const accepted=analyzeIdleStability(f.rpm,undefined,{regions:[{startMs:0,endMs:0.1},{startMs:200,endMs:300}]});
    const original=f.closedLoop.range.validity.slice();const result=analyzeIdleAirflow({...f,sampleIndices:accepted.sampleIndices});
    expect([...accepted.sampleIndices]).toEqual([40,42,43]);expect(result.status).toBe('limited');
    expect(stats(result.closedLoop)).toMatchObject({inputSampleCount:3,validSampleCount:2,invalidSampleCount:1,unavailableSampleCount:0,mean:-3});
    expect(stats(result.closedLoop).rootMeanSquare).toBeCloseTo(Math.sqrt(10));expect(f.closedLoop.range.validity).toEqual(original);
  });
  it('counts missing original indices and timestamp misalignment as unavailable, never borrowed or interpolated',()=>{
    const f=fixture(),signal=range([22,24,26],41);signal.timeMs.set([100,201,300]);signal.validity[2]=0;
    const result=analyzeIdleAirflow({...f,basePosition:{range:signal,unit:'%'}});
    expect(stats(result.basePosition)).toMatchObject({inputSampleCount:4,validSampleCount:1,invalidSampleCount:1,unavailableSampleCount:2,mean:22});
    expect([...signal.validity]).toEqual([1,1,0]);expect(result.status).toBe('limited');
  });
  it('requires units and keeps missing optional signals unavailable rather than healthy zero',()=>{
    const f=fixture();const missing=analyzeIdleAirflow({rpm:f.rpm,sampleIndices:f.sampleIndices});expect(missing.status).toBe('unavailable');expect(missing.closedLoop).toMatchObject({status:'missing'});expect('statistics' in missing.closedLoop).toBe(false);
    for(const unit of ['', 'g/s','kPa','steps','fraction','pp'])expect(analyzeIdleAirflow({...f,basePosition:{range:f.basePosition.range,unit}}).basePosition.status).toBe('incompatible-unit');
    expect(analyzeIdleAirflow({...f,closedLoop:{range:f.closedLoop.range,unit:'%'}}).closedLoop.status).toBe('available');
    expect(analyzeIdleAirflow({rpm:f.rpm,sampleIndices:f.sampleIndices,basePosition:f.basePosition,finalPosition:f.finalPosition}).status).toBe('limited');
  });
  it('handles empty, invalid, nonfinite, missing timestamp and source-outside selections explicitly',()=>{
    const f=fixture();expect(analyzeIdleAirflow({...f,sampleIndices:[]}).status).toBe('unavailable');expect(stats(analyzeIdleAirflow({...f,sampleIndices:[]}).basePosition).mean).toBeUndefined();
    f.rpm.values.fill(NaN);expect(stats(analyzeIdleAirflow(f).basePosition)).toMatchObject({validSampleCount:0,invalidSampleCount:4});
    f.rpm.timeMs[0]=NaN;expect(stats(analyzeIdleAirflow({...f,sampleIndices:[40,44]}).basePosition)).toMatchObject({validSampleCount:0,unavailableSampleCount:2});
    const huge=fixture();huge.closedLoop.range.values.fill(1e308);expect(analyzeIdleAirflow(huge).closedLoop.status).toBe('nonfinite-metrics');
    const g=fixture();g.closedLoop.range.values[1]=Infinity;expect(stats(analyzeIdleAirflow(g).closedLoop)).toMatchObject({validSampleCount:3,invalidSampleCount:1});
  });
  it('rejects duplicate, unsorted and invalid source indices before calculation',()=>{
    for(const sampleIndices of [[40,40],[41,40],[NaN],[-1],[1.5]])expect(()=>analyzeIdleAirflow({...fixture(),sampleIndices})).toThrow(RangeError);
  });
  it('handles more than 320k samples without spreads or full-size copies on the aligned path',()=>{
    const count=320459,rpm=range([]);const values=new Float64Array(count).fill(10),timeMs=Float64Array.from({length:count},(_,i)=>i*10),validity=new Uint8Array(count).fill(1);
    const signal={startSampleIndex:40,values,timeMs,validity};const result=analyzeIdleAirflow({rpm:{...rpm,values:new Float64Array(count).fill(1000),timeMs,validity},sampleIndices:Uint32Array.from({length:count},(_,i)=>i+40),basePosition:{range:signal,unit:'%'},closedLoop:{range:signal,unit:'pp'},finalPosition:{range:signal,unit:'%'}});
    expect(result.status).toBe('recorded-context');expect(stats(result.basePosition).validSampleCount).toBe(count);expect(stats(result.closedLoop).mean).toBe(10);expect(stats(result.finalPosition).standardDeviation).toBe(0);expect(signal.values).toBe(values);expect(signal.validity).toBe(validity);
  });
});
