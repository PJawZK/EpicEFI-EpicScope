import {describe,it,expect} from 'vitest';
import {createIdleComparisonSource,type IdleComparisonRecording} from '../../apps/web/src/pages/idle-comparison-source';
const deferred=()=>{let resolve!:(value:IdleComparisonRecording)=>void,reject!:(error:Error)=>void;return {ready:new Promise<IdleComparisonRecording>((yes,no)=>{resolve=yes;reject=no;}),resolve:(value:IdleComparisonRecording)=>resolve(value),reject:(error:Error)=>reject(error)};};
const recording=(name:string,startMs=100,endMs=900):IdleComparisonRecording=>({summary:{source:{id:name,displayName:name,format:'MLG',sizeBytes:100},channels:[],diagnostics:[],markers:[],timeRange:{startMs,endMs,durationMs:endMs-startMs}},channelData:{sampleCount:8,readChannelRange:async()=>{throw Error('Owner must not read channels while importing');}}});
const file=(name:string)=>new File(['test'],name);
describe('independent Idle B transactional source lifetime',()=>{
 it('keeps current B while replacement is pending and after rejection, advancing revision only on acceptance',async()=>{
  const jobs:ReturnType<typeof deferred>[]=[],states:unknown[]=[],owner=createIdleComparisonSource(state=>states.push(state),()=>{const job=deferred();jobs.push(job);return {...job,cancel(){}};});owner.setActive(true);const first=owner.load(file('first'));jobs[0]!.resolve(recording('first'));await first;const accepted=owner.state().recording,revision=owner.state().revision;
  const failed=owner.load(file('bad'));expect(owner.state()).toMatchObject({recording:accepted,loading:true,revision});jobs[1]!.reject(Error('bad CRC/header'));await failed;expect(owner.state()).toMatchObject({recording:accepted,loading:false,revision});expect(owner.state().message).toContain('rejected');expect(states.length).toBeGreaterThan(2);owner.dispose();
 });
 it('rejects old A finishing after newer B, even when cancelled importer cannot stop physical work',async()=>{
  const jobs:ReturnType<typeof deferred>[]=[],cancelled:number[]=[],owner=createIdleComparisonSource(()=>{},()=>{const job=deferred(),index=jobs.length;jobs.push(job);return {...job,cancel(){cancelled.push(index);}};});owner.setActive(true);const a=owner.load(file('A')),b=owner.load(file('B'));jobs[1]!.resolve(recording('B'));await b;jobs[0]!.resolve(recording('A'));await a;expect(owner.state().recording?.summary.source.displayName).toBe('B');expect(cancelled).toContain(0);expect(owner.state().revision).toBe(1);owner.dispose();
 });
 it('preserves accepted B across hide/cancel and rejects hidden, released and disposed completions',async()=>{
  for(const action of ['hide','release','dispose'] as const){const jobs:ReturnType<typeof deferred>[]=[],owner=createIdleComparisonSource(()=>{},()=>{const job=deferred();jobs.push(job);return {...job,cancel(){}};});owner.setActive(true);const first=owner.load(file('first'));jobs[0]!.resolve(recording('first'));await first;const late=owner.load(file('late'));if(action==='hide')owner.setActive(false);else owner[action]();jobs[1]!.resolve(recording('late'));await late;expect(owner.state().recording?.summary.source.displayName).toBe(action==='hide'?'first':undefined);expect(owner.state().loading).toBe(false);owner.dispose();}
 });
 it('rejects empty/nonfinite/absent canonical source extent without replacing current B',async()=>{
  let next=recording('first');const owner=createIdleComparisonSource(()=>{},()=>({ready:Promise.resolve(next),cancel(){}}));owner.setActive(true);await owner.load(file('first'));const accepted=owner.state().recording;
  const missing=recording('bad');const {timeRange,...summary}=missing.summary;
  for(const invalid of [{...missing,summary},{...recording('bad'),channelData:{...recording('bad').channelData,sampleCount:0}},recording('bad',NaN,900),recording('bad',900,100)]){next=invalid;await owner.load(file('bad'));expect(owner.state().recording).toBe(accepted);expect(owner.state().message).toContain('rejected');}owner.dispose();
 });
 it('does no hidden import and preserves source identity independently of file name collisions',async()=>{
  let calls=0;const owner=createIdleComparisonSource(()=>{},()=>{calls++;return {ready:Promise.resolve(recording('same.mlg')),cancel(){}};});await owner.load(file('hidden'));expect(calls).toBe(0);owner.setActive(true);await owner.load(file('same.mlg'));const first=owner.state().recording;await owner.load(file('same.mlg'));expect(owner.state().recording).not.toBe(first);expect(owner.state().revision).toBe(2);owner.release();expect(owner.state().recording).toBeUndefined();owner.dispose();
 });
});
