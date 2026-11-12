import {describe,it,expect} from 'vitest';
import {resolveMlgTimeCandidate} from '../../../core/parsers/mlg/mlg-time-authority';
import {classifyMlgRetryDiagnostics} from '../../../core/parsers/mlg/mlg-records';
import type {MlgScalarFieldDescriptor} from '../../../core/parsers/mlg/mlg-format';
import {parseMlg} from '../../../core/parsers/mlg/mlg-parser';
import {MemoryByteSource} from '../../../core/parsers/byte-source';
import {idleContractMlg} from '../../fixtures/idle/mlg-contract';
const field:MlgScalarFieldDescriptor={kind:'scalar',index:0,offset:24,type:7,name:'Time',units:'s',displayStyle:0,widthBytes:4,category:'',scale:1,transform:0,digits:3};
function input(values:number[],crc=values.map(()=>1)){
 const header=Float64Array.from(values,(_,i)=>i*10);
 return {sourceId:'source',validationRevision:1,crcValidated:true,index:{offsets:Float64Array.from(values,(_,i)=>100+i*7),timeMs:header,headerTimeMs:header,rawTimestampTicks:Uint16Array.from(values,(_,i)=>i*1000),counters:Uint8Array.from(values,(_,i)=>i),crcValid:Uint8Array.from(crc)},fields:[field],recordedValues:Float64Array.from(values)};
}
function candidate(x:ReturnType<typeof input>){const r=resolveMlgTimeCandidate(x);if(r.status!=='candidate')throw Error(r.status);return r.candidate;}
describe('inactive MLG time admission foundation',()=>{
 it('requires completed CRC validation and never chooses an untrusted anchor',()=>{
  const x=input([999,2,2,3],[0,1,1,1]);expect(resolveMlgTimeCandidate({...x,crcValidated:false})).toEqual({status:'pending-crc'});
  const c=candidate(x);expect(c.source).toBe('recorded-time');expect(c.originIndex).toBe(1);expect([...c.timeMs]).toEqual([997000,0,0,1000]);expect([...c.timeEligible]).toEqual([0,1,1,1]);expect([c.trustedStartMs,c.trustedEndMs]).toEqual([0,1000]);
  expect([...x.index.timeMs]).toEqual([0,10,20,30]);expect([...x.recordedValues]).toEqual([999,2,2,3]);expect([...x.index.crcValid]).toEqual([0,1,1,1]);
 });
 it.each([
  [[1,NaN,2],'invalid-trusted-time'],[[1,Infinity,2],'invalid-trusted-time'],[[1,-1,2],'invalid-trusted-time'],[[1,2,1],'backward-trusted-time'],[[1,1,1],'constant-time'],
 ] as const)('uses whole-source header fallback for %s', (values,reason)=>{
  const x=input([...values]),c=candidate(x);expect(c.source).toBe('header-clock');expect(c.reason).toBe(reason);expect(c.timeMs).toBe(x.index.headerTimeMs);expect(c.originIndex).toBeUndefined();
 });
 it('ignores unusable CRC-excluded Time without filling that slot from another clock',()=>{
  const x=input([1,NaN,2],[1,0,1]),c=candidate(x);expect(c.source).toBe('recorded-time');expect(Number.isNaN(c.timeMs[1])).toBe(true);expect(c.timeEligible[1]).toBe(0);
  expect(resolveMlgTimeCandidate(input([1,2],[0,0]))).toEqual({status:'no-trusted-time'});
 });
 it('rejects missing, ambiguous, unit-unknown, bit and absent-column candidates conservatively',()=>{
  const x=input([1,2]);expect(candidate({...x,fields:[]}).reason).toBe('missing-time');
  expect(candidate({...x,fields:[field,{...field,index:1}]}).reason).toBe('ambiguous-time');
  expect(candidate({...x,fields:[{...field,units:'unknown'}]}).reason).toBe('unsupported-time-metadata');
  expect(resolveMlgTimeCandidate({...x,fields:[{...field,kind:'bitfield',type:10,bitFieldStyle:0,bitFieldNamesIndex:0,bits:8}]})).toMatchObject({status:'candidate',candidate:{reason:'unsupported-time-metadata'}});
  expect(resolveMlgTimeCandidate({sourceId:x.sourceId,validationRevision:1,crcValidated:true,index:x.index,fields:x.fields})).toMatchObject({status:'candidate',candidate:{reason:'missing-time-values'}});
 });
 it('converts milliseconds once and admits scaled integer fields without changing decoded values',()=>{
  const x=input([1000,1010,1020]),c=candidate({...x,fields:[{...field,units:'ms',type:2}]});expect(c.timeMs[0]).toBe(0);expect(c.timeMs[1]).toBeCloseTo(10,9);expect(c.timeMs[2]).toBeCloseTo(20,9);
  const scaled=input([1,1.01,1.02]);expect(candidate({...scaled,fields:[{...field,type:2,scale:.001}]}).source).toBe('recorded-time');
 });
 it('fails closed on geometry and versions CRC generations in the fingerprint',()=>{
  const x=input([1,2]);expect(()=>candidate({...x,recordedValues:Float64Array.from([1])})).not.toThrow();
  expect(candidate({...x,recordedValues:Float64Array.from([1])}).reason).toBe('missing-time-values');
  expect(()=>resolveMlgTimeCandidate({...x,index:{...x.index,crcValid:new Uint8Array(1)}})).toThrow(/geometry/);
  expect(candidate(x).fingerprint).toBe(candidate(x).fingerprint);expect(candidate({...x,validationRevision:2}).fingerprint).not.toBe(candidate(x).fingerprint);
 });
 it('keeps retry classification tied to wire evidence despite colliding selected timestamps',()=>{
  const x=input([0,0,0]);x.index.crcValid.set([0,1,1]);x.index.counters.set([5,5,6]);
  const result=classifyMlgRetryDiagnostics({...x.index,timeMs:new Float64Array(3)},x.index.crcValid,[],2);
  expect(result.recoveredRetryCount).toBe(0);x.index.rawTimestampTicks[1]=x.index.rawTimestampTicks[0]!;
  expect(classifyMlgRetryDiagnostics({...x.index,timeMs:Float64Array.from([100,200,300])},x.index.crcValid,[],2).recoveredRetryCount).toBe(1);
 });
 it.each([false,true])('scanner retains wire provenance in general=%s without activating Time',async(general)=>{
  const bytes=idleContractMlg([{counter:1,timestamp:65530,rpm:900},{counter:2,timestamp:4,rpm:901}],general);
  const p=await parseMlg(new MemoryByteSource(bytes),{id:'wire',displayName:'wire',format:'MLG',sizeBytes:bytes.length},{incompleteTail:'retain-complete-records'});
  expect([...p.recordIndex.rawTimestampTicks!]).toEqual([65530,4]);expect(p.recordIndex.headerTimeMs).toBe(p.recordIndex.timeMs);expect(p.recordIndex.timeMs[1]).toBeCloseTo(.1);
 });
 it('handles >320k valid samples and duplicates with bounded loops and unchanged source arrays',()=>{
  const n=320005,values=Array.from({length:n},(_,i)=>Math.floor(i/2)*.01),x=input(values),c=candidate(x);
  expect(c.source).toBe('recorded-time');expect(c.timeMs.length).toBe(n);expect(c.timeMs[1]).toBe(0);expect(c.timeMs[n-1]).toBeCloseTo(1600020);expect(x.index.headerTimeMs[n-1]).toBe((n-1)*10);
 });
});
