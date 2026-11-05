import {createScalarHeaderFixture} from '../../logs/mlg-fixture-builder';
import {buildRawViewportSeries,buildViewportTraceSeries} from '../../../core/timeline/viewport-series';
import {describe,it,expect} from 'vitest';
import {auditMlgIntegrity} from '../../../core/parsers/mlg/mlg-integrity-audit';
import {parseMlg} from '../../../core/parsers/mlg/mlg-parser';
import {MemoryByteSource} from '../../../core/parsers/byte-source';
import {idleContractMlg,IDLE_CONTRACT_RECORDS} from '../../fixtures/idle/mlg-contract';
const parse=async(records:Parameters<typeof idleContractMlg>[0]=IDLE_CONTRACT_RECORDS)=>{const bytes=idleContractMlg(records);return parseMlg(new MemoryByteSource(bytes),{id:'audit',displayName:'independent-fixture.mlg',format:'MLG',sizeBytes:bytes.length});};
describe('read-only complete-record MLG integrity audit',()=>{
 it('classifies each corrupt attempt by a subsequent valid replacement even when the retry run ends corrupt',async()=>{
  const parsed=await parse([{counter:0,timestamp:0,rpm:900},{counter:1,timestamp:1000,rpm:901,valid:false},{counter:1,timestamp:1000,rpm:901},{counter:1,timestamp:1000,rpm:901,valid:false},{counter:2,timestamp:2000,rpm:902}]);
  expect(parsed.summary.diagnostics.filter(d=>d.code.startsWith('mlg-crc-')).map(d=>d.code)).toEqual(['mlg-crc-retry-recovered','mlg-crc-mismatch']);expect([...parsed.recordIndex.crcValid]).toEqual([1,0,1,0,1]);const range=await parsed.channelData.readChannelRange(parsed.summary.channels[0]!.id,0,5);expect(buildRawViewportSeries(range,0,20).map(p=>p.breakBefore)).toEqual([true,false,false]);
 });
 it('correlates valid retry-like run diagnostics with its complete duplicate run without inventing lost records',async()=>{
  const parsed=await parse([{counter:0,timestamp:0,rpm:900},{counter:3,timestamp:1000,rpm:901},{counter:3,timestamp:1000,rpm:902},{counter:3,timestamp:1000,rpm:903},{counter:4,timestamp:2000,rpm:904}]);const audit=auditMlgIntegrity(parsed.recordIndex,parsed.summary.diagnostics,2);
  expect(audit.invalidRecords).toBe(0);expect(audit.observedCounts['valid-retry-like-run']).toBe(1);expect(audit.events).toHaveLength(1);expect(audit.events[0]).toMatchObject({startRecordIndex:1,endRecordIndex:3});expect(audit.events[0]?.classifications).toContain('duplicate-timestamp');
 });
 it('correlates canonical CRC/retry, sequence and duplicate/wrap observations with physical provenance',async()=>{
  const parsed=await parse(),before=Array.from(parsed.recordIndex.crcValid);const report=auditMlgIntegrity(parsed.recordIndex,parsed.summary.diagnostics,parsed.header.recordLength,{rawTimestamps:Uint16Array.from(IDLE_CONTRACT_RECORDS,r=>r.timestamp)});
  expect(report.invalidRecords).toBe(2);expect(report.observedCounts['recovered-retry']).toBe(1);expect(report.observedCounts['unrecovered-corrupt-record']).toBe(1);expect(report.observedCounts['sequence-discontinuity']).toBeGreaterThan(0);expect(report.observedCounts['timestamp-wrap-or-reset']).toBe(1);expect(report.events.every(e=>e.startOffset===parsed.recordIndex.offsets[e.startRecordIndex])).toBe(true);expect([...parsed.recordIndex.crcValid]).toEqual(before);
 });
 it('distinguishes heuristic spacing, regression, duplicate, nonfinite time and channel-specific invalidity without causal claims',()=>{
  const times=Float64Array.from([0,10,20,300,300,290,NaN]),index={timeMs:times,offsets:Float64Array.from(times,(_,i)=>100+i*7),counters:Uint8Array.from(times,(_,i)=>i),crcValid:new Uint8Array(7).fill(1)};
  const channels=new Map([['RPM',{startSampleIndex:0,timeMs:times,values:Float64Array.from([1,2,NaN,4,5,6,7]),validity:new Uint8Array(7).fill(1)}]]);
  const report=auditMlgIntegrity(index,[],2,{channels});expect(report.observedCounts).toMatchObject({'recording-time-discontinuity':1,'timestamp-regression':1,'duplicate-timestamp':1,'unclassified':1,'channel-invalid':2});expect(report.events.find(e=>e.startRecordIndex===3)?.observations[0]).toContain('unknown cause');expect(report.events.find(e=>e.startRecordIndex===3)?.startTimeMs).toBe(300);
 });
 it('keeps a CRC-valid NaN float as channel-specific invalidity rather than source corruption',async()=>{
  const header=createScalarHeaderFixture({version:2,type:7,name:'Float signal',units:'V'}),bytes=new Uint8Array(header.length+27);bytes.set(header);
  for(let i=0;i<3;i++){const at=header.length+i*9,view=new DataView(bytes.buffer);bytes[at]=0;bytes[at+1]=i;view.setUint16(at+2,i*1000,false);view.setFloat32(at+4,i===1?NaN:i,false);let sum=0;for(let j=4;j<8;j++)sum+=bytes[at+j]!;bytes[at+8]=sum&255;}
  const parsed=await parseMlg(new MemoryByteSource(bytes),{id:'nan-float',displayName:'nan-float.mlg',format:'MLG',sizeBytes:bytes.length}),channel=parsed.summary.channels[0]!;
  const range=await parsed.channelData.readChannelRange(channel.id,0,3),audit=auditMlgIntegrity(parsed.recordIndex,parsed.summary.diagnostics,4,{channels:new Map([[channel.sourceName,range]])});
  expect([...parsed.recordIndex.crcValid]).toEqual([1,1,1]);expect(audit.observedCounts['channel-invalid']).toBe(1);expect(audit.observedCounts['unrecovered-corrupt-record']).toBeUndefined();
 });
 it('keeps a sub-50ms valid spacing interval continuous without inventing source corruption',()=>{
  const n=3205,range={startSampleIndex:0,timeMs:Float64Array.from({length:n},(_,i)=>i*.01+(i>=1600?40:0)),values:new Float64Array(n).fill(1),validity:new Uint8Array(n).fill(1)};
  const presentation=buildViewportTraceSeries(range,0,range.timeMs[n-1]!,800);expect(presentation.mode).toBe('envelope');expect(presentation.points.filter(p=>p.breakBefore)).toHaveLength(1);
  expect(auditMlgIntegrity({timeMs:range.timeMs,offsets:Float64Array.from({length:n},(_,i)=>100+i*7),counters:Uint8Array.from({length:n},(_,i)=>i%256),crcValid:range.validity},[],2).events).toEqual([]);
 });
 it('does not invent anomalies in >320k continuous valid records',()=>{
  const n=320005,index={offsets:Float64Array.from({length:n},(_,i)=>100+i*7),timeMs:Float64Array.from({length:n},(_,i)=>i*10),counters:Uint8Array.from({length:n},(_,i)=>i%256),crcValid:new Uint8Array(n).fill(1)};
  expect(auditMlgIntegrity(index,[],2)).toMatchObject({recordCount:n,invalidRecords:0,events:[]});
 });
 it('coalesces consecutive unrecovered attempts into a source span and retains every diagnostic offset',()=>{
  const index={offsets:new Float64Array([100,107,114,121]),timeMs:new Float64Array([0,10,20,30]),counters:new Uint8Array([0,1,2,3]),crcValid:new Uint8Array([1,0,0,1])};const ds=[113,120].map(offset=>({code:'mlg-crc-mismatch',offset,severity:'warning' as const,message:'CRC',recoverable:true}));
  const report=auditMlgIntegrity(index,ds,2);expect(report.events).toHaveLength(1);expect(report.events[0]).toMatchObject({startRecordIndex:1,endRecordIndex:2,startOffset:107,endOffset:114});expect(report.events[0]?.diagnostics).toHaveLength(2);
 });
});
