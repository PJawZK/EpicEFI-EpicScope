import {describe,it,expect} from 'vitest';
import {chdlClockFixture} from '../../fixtures/mlg/chdl-clock';
import {parseMlg} from '../../../core/parsers/mlg/mlg-parser';
import {MemoryByteSource} from '../../../core/parsers/byte-source';
import {buildRawViewportSeries,buildViewportTraceSeries} from '../../../core/timeline/viewport-series';
async function fixture(){const bytes=chdlClockFixture();return parseMlg(new MemoryByteSource(bytes),{id:'chdl-clock',displayName:'independent-clock.mlg',format:'MLG',sizeBytes:bytes.length});}
describe('CHDL original clock interruption',()=>{
 it('projects the observed regression at its prior endpoint without repairing source time or blaming CRC',async()=>{
  const parsed=await fixture(),event=parsed.summary.diagnostics.find(d=>d.code==='mlg-source-time-regression');
  expect(event).toMatchObject({timeMs:6857.53,severity:'warning',sourceIntegrity:{kind:'timestamp-gap',breaksContinuity:true}});
  expect(parsed.recordIndex.timeMs[24]).toBe(6535.27);expect([...parsed.recordIndex.crcValid].every(x=>x===1)).toBe(true);
 });
 it('does not infer a missing first interval from a later faster cadence after the source clock regresses',async()=>{
  const parsed=await fixture(),r=await parsed.channelData.readChannelRange(parsed.summary.channels[0]!.id,0,parsed.recordIndex.timeMs.length);
  expect(buildRawViewportSeries(r,6000,7500).find(p=>p.timeMs===6947.06)?.breakBefore).toBe(false);
  expect(buildViewportTraceSeries(r,0,r.timeMs[r.timeMs.length-1]!,10).points.some(p=>p.timeMs===6857.53)).toBe(true);
 });
});

import {projectChannelUnavailable,projectMlgContinuityDiagnostics} from '../../../core/parsers/mlg/mlg-continuity';
import {sourceIntegrityDisplayClusters,sourceIntegrityMarkersFromDiagnostics} from '../../../apps/web/src/app/source-integrity-markers';
import type {MlgRecordIndex} from '../../../core/parsers/mlg/mlg-records';
function indexed(times:number[]):MlgRecordIndex {return {timeMs:Float64Array.from(times),offsets:Float64Array.from(times,(_,i)=>100+i*9),counters:Uint8Array.from(times,(_,i)=>i%256),crcValid:new Uint8Array(times.length).fill(1)};}
describe('canonical continuity evidence',()=>{
 it('does not infer source-wide absence when other original records occupy the interval',()=>{
  const i=indexed([0,10,20,30,40,50,60,70,80,90,300,100,110]);
  const original=[...i.timeMs],events=projectMlgContinuityDiagnostics(i,[],4);
  expect(events.find(d=>d.code==='mlg-source-time-regression')?.sourceIntegrity?.evidence).toMatchObject({fromRecordIndex:10,toRecordIndex:11,interiorRecords:1,deltaMs:-200,relatedCrcRecords:[]});
  expect(events.find(d=>d.code==='mlg-source-time-spacing')?.message).toContain('do not prove packet loss');expect([...i.timeMs]).toEqual(original);expect([...i.crcValid].every(v=>v===1)).toBe(true);
 });
 it('keeps normal wraps, duplicates and small cadence variation quiet',()=>{
  expect(projectMlgContinuityDiagnostics(indexed([0,10,20,20,30,40,51]),[],4)).toEqual([]);
 });
 it('keeps channel NaNs separate from source CRC exclusions and never invents finite values',()=>{
  const range={startSampleIndex:0,timeMs:Float64Array.from([0,100,200,300,400,500,600]),values:Float64Array.from([1,NaN,NaN,NaN,NaN,NaN,1]),validity:Uint8Array.from([1,1,1,0,1,1,1])};
  const events=projectChannelUnavailable(range,'hybrid','Hybrid');expect(events).toHaveLength(2);
  expect(events.map(e=>e.sourceIntegrity?.evidence?.sampleCount)).toEqual([2,2]);expect(events.every(e=>e.severity==='info'&&e.sourceIntegrity?.breaksContinuity===false)).toBe(true);
  expect(sourceIntegrityMarkersFromDiagnostics(events).every(m=>m.kind==='channel-unavailable')).toBe(true);
  expect(Number.isNaN(range.values[3])).toBe(true);
 });
 it('does not combine a channel availability notice with same-time CRC or another channel',()=>{
  const range={startSampleIndex:0,timeMs:Float64Array.from([0,100]),values:Float64Array.from([NaN,NaN]),validity:Uint8Array.from([1,1])};
  const markers=sourceIntegrityMarkersFromDiagnostics([...projectChannelUnavailable(range,'one','One'),...projectChannelUnavailable(range,'two','Two')]);expect(markers).toHaveLength(2);
 });
 it('handles >320k valid samples without a false event, mutation or file reads',()=>{
  const n=320005,i=indexed(Array.from({length:n},(_,i)=>i*10));
  expect(projectMlgContinuityDiagnostics(i,[],4)).toEqual([]);
  const events=projectChannelUnavailable({startSampleIndex:0,timeMs:i.timeMs,values:new Float64Array(n).fill(1),validity:i.crcValid},'rpm','RPM');expect(events).toEqual([]);
  const markers=Array.from({length:n},(_,j)=>({timeMs:j,kind:'timestamp-gap' as const,breaksContinuity:true,count:1,message:'observation'}));
  for(const start of [0,10000,200000])expect(sourceIntegrityDisplayClusters(markers,start,start+10000,800).length).toBeLessThanOrEqual(40);
 });
});

import {getTimeQueryIndex} from '../../../core/log-model/time-query-index';
it('counts large overlapping runs without enumerating memberships or rewriting order',()=>{
 const times=Float64Array.from({length:320005},(_,i)=>i%1000),index=getTimeQueryIndex(times);
 expect(index.permutation).toBeDefined();expect(index.count(0,999)).toBe(times.length);expect(index.count(0,999,true)).toBe(320005-321-320);expect(index.count(100,100,true)).toBe(0);
});

import {createTimeCadenceCursor,precedingTimeCadence} from '../../../core/log-model/time-continuity';
it('incremental source cadence matches random access across duplicates, nonfinite times and backwards boundaries',()=>{
 const times=Float64Array.from({length:1000},(_,i)=>i===200?NaN:i>600?i-400:i<300?i*100:i*10),next=createTimeCadenceCursor(times);
 for(let i=1;i<times.length;i++)expect(next(i)).toEqual(precedingTimeCadence(times,i));
});

it('retains a heuristic spacing observation without promoting it to a graphical source-discontinuity warning',()=>{
 const events=projectMlgContinuityDiagnostics(indexed([0,10,20,30,40,50,60,70,80,90,300]),[],4);
 const event=events.find(d=>d.code==='mlg-source-time-spacing');
 expect(event).toMatchObject({severity:'info',sourceIntegrity:{kind:'cadence-observation',breaksContinuity:false,evidence:{classification:'cadence-outlier',deltaMs:210}}});
 expect(sourceIntegrityMarkersFromDiagnostics(events)).toHaveLength(1);
 expect(sourceIntegrityDisplayClusters(sourceIntegrityMarkersFromDiagnostics(events),0,400,800)).toEqual([]);
});
