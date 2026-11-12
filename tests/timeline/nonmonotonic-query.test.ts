import { describe, expect, it } from 'vitest';
import { buildRawViewportSeries, buildViewportEnvelope, buildViewportEnvelopeFromBlocks, buildEnvelopeBlockSummary, nearestNumericSample } from '../../core/timeline/viewport-series';
import { idleContractMlg } from '../fixtures/idle/mlg-contract';
import { parseMlg } from '../../core/parsers/mlg/mlg-parser';
import { MemoryByteSource } from '../../core/parsers/byte-source';
import { getTimeQueryIndex, TimeQueryIndex } from '../../core/log-model/time-query-index';
import { interpolateNumericRangeAtTime } from '../../core/analysis/ve-evidence-map';

const range = () => ({ startSampleIndex: 0, timeMs: Float64Array.from([0, 10, 20, 5, 30]), values: Float64Array.from([0, 1, 2, 3, 4]), validity: new Uint8Array(5).fill(1) });
describe('nonmonotonic source query reproduction', () => {
  it('includes every original observation inside a narrow region, breaking at the backward jump', () => {
    expect(buildRawViewportSeries(range(), 4, 11)).toEqual([{timeMs:10,value:1,breakBefore:true},{timeMs:5,value:3,breakBefore:true}]);
  });
  it('counts all qualifying observations in both direct and block envelopes', () => {
    const r=range(),direct=buildViewportEnvelope(r,4,11,100);
    expect(direct.validSampleCount).toBe(2);
    expect(buildViewportEnvelopeFromBlocks(r,buildEnvelopeBlockSummary(r.values,r.timeMs,r.validity),4,11,100)).toEqual(direct);
  });
  it('finds the actual nearest original observation in overlapping source runs', () => {
    expect(nearestNumericSample(range(),5)).toEqual({sampleIndex:3,timeMs:5,value:3});
  });
  it('keeps nonfinite channel values and CRC exclusions distinct from time membership',()=>{
    const r=range();r.values[3]=NaN;
    expect(getTimeQueryIndex(r.timeMs).spans(4,11).map(s=>s.start)).toEqual([1,3]);
    expect(buildRawViewportSeries(r,4,11).map(p=>p.value)).toEqual([1]);
    expect(buildViewportEnvelope(r,4,11,100)).toMatchObject({validSampleCount:1,invalidSampleCount:1});
    r.values[3]=3;r.validity[3]=0;
    expect(buildRawViewportSeries(r,4,11).map(p=>p.value)).toEqual([1]);
    expect([...r.timeMs]).toEqual([0,10,20,5,30]);
  });
  it('source fetch cover includes the later regressed record without altering canonical data', async()=>{
    const bytes=idleContractMlg([0,1000,2000,500,3000].map((timestamp,i)=>({timestamp,counter:i,rpm:900+i})));
    const parsed=await parseMlg(new MemoryByteSource(bytes),{id:'nonmono',displayName:'generated.mlg',format:'MLG',sizeBytes:bytes.length});
    const cover=parsed.channelData.sampleRangeForTime!(4,6);
    expect(cover.startSampleIndex).toBeLessThanOrEqual(3);expect(cover.startSampleIndex+cover.sampleCount).toBeGreaterThan(3);
    expect([...parsed.recordIndex.timeMs]).toEqual([0,10,20,5,30]);expect([...parsed.recordIndex.crcValid]).toEqual([1,1,1,1,1]);
  });
  it('uses the complete finite timestamp extent when the last source record regresses',async()=>{
    const bytes=idleContractMlg([0,2000,500].map((timestamp,i)=>({timestamp,counter:i,rpm:900+i})));
    const parsed=await parseMlg(new MemoryByteSource(bytes),{id:'extent',displayName:'generated.mlg',format:'MLG',sizeBytes:bytes.length});
    expect(parsed.summary.timeRange).toEqual({startMs:0,endMs:20,durationMs:20});
    expect([...parsed.recordIndex.timeMs]).toEqual([0,20,5]);
  });
  it('keeps interpolation inside an explicitly identified original run',()=>{
    const r={startSampleIndex:100,timeMs:Float64Array.from([0,10,20,5,15,25]),values:Float64Array.from([0,100,200,300,400,500]),validity:new Uint8Array(6).fill(1)};
    expect(interpolateNumericRangeAtTime(r,7)).toBeUndefined();
    expect(interpolateNumericRangeAtTime(r,7,104)).toBe(320);
    expect(interpolateNumericRangeAtTime(r,3,103)).toBeUndefined();
    r.validity[3]=0;expect(interpolateNumericRangeAtTime(r,7,104)).toBeUndefined();
  });
  it.each([
    [0,10,20,30], [0,10,5,4,3,20], [10,10,10,5,5,20], [0,655.3,655.4,655.5], [NaN,0,20,NaN,5,30],
  ].map(times=>[times]))('matches a source-order membership oracle: %j',(times)=>{
    const index=new TimeQueryIndex(Float64Array.from(times));
    for(let lo=-1;lo<35;lo+=3)for(let hi=lo;hi<40;hi+=7){const actual=index.spans(lo,hi).flatMap(s=>Array.from({length:s.end-s.start},(_,i)=>s.start+i));expect(actual).toEqual(times.flatMap((t,i)=>Number.isFinite(t)&&t>=lo&&t<=hi?[i]:[]));}
  });
  it('preserves duplicate-time original order and does not skip invalid nearest observations',()=>{
    const r={...range(),timeMs:Float64Array.from([0,10,10,5,10])};
    expect(getTimeQueryIndex(r.timeMs).nearest(10)).toBe(1);r.validity[1]=0;expect(nearestNumericSample(r,10)).toBeUndefined();
    expect(getTimeQueryIndex(r.timeMs).spans(10,10).flatMap(s=>Array.from({length:s.end-s.start},(_,i)=>s.start+i))).toEqual([1,2,4]);
  });
  it('uses a bounded alternative index for >320k samples with many original runs',()=>{
    const count=320_005,times=Float64Array.from({length:count},(_,i)=>(i%1000)*10),index=new TimeQueryIndex(times);
    expect(index.permutation?.byteLength).toBe(count*4);
    const selected=index.spans(1230,1230).flatMap(s=>Array.from({length:s.end-s.start},(_,i)=>s.start+i));
    expect(selected).toEqual(Array.from({length:320},(_,i)=>i*1000+123));expect(index.nearest(1230)).toBe(123);
    expect([...times.subarray(998,1003)]).toEqual([9980,9990,0,10,20]);
  });
});
