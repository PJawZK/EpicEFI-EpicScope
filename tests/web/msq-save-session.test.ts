import { describe, expect, it } from 'vitest';
import { createMsqSaveSession } from '../../apps/web/src/adapters/msq-save-session';
import { prepareVeMsqWrite, prepareVeMsqWriteOnDiskBase } from '../../apps/web/src/adapters/msq-ve-document-writer';
import { decodeMsqSource } from '../../apps/web/src/adapters/msq-document-source';
import { parseIniMsqWriteCatalog } from '../../core/parsers/ini/ini-msq-write-policy';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import type { AcceptedMsqDocument } from '../../apps/web/src/adapters/msq-document-loader';
import type { VeMsqWriteSnapshot } from '../../core/tune/ve-msq-write';
import type { MsqSaveState } from '../../apps/web/src/msq-save-contract';
import type { PreparedMsqBytes } from '../../apps/web/src/adapters/msq-write-preparation';
const source='<msq><versionInfo signature="save-test"/><page number="0"><constant name="rpm" rows="1" cols="2">1000 2000</constant><constant name="load" rows="2" cols="1">50 100</constant><constant name="veTable" rows="2" cols="2" units="%" digits="1">70 70 70 70</constant><constant name="veTable2" rows="2" cols="2" units="%" digits="1">60 60 60 60</constant><constant name="other">42</constant></page></msq>';
const catalog=parseIniMsqWriteCatalog('[MegaTune]\nsignature="save-test"\n[Constants]\nveTable=array,U16,0,[2x2],"%",0.01,0,0,650,1\nveTable2=array,U16,8,[2x2],"%",0.01,0,0,650,1');
const deferred=<T>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return{promise,resolve};};
function setup(){
 const original=new TextEncoder().encode(source),model=normalizeMsqTune(parseMsq(source));
 let disk=original.slice(),permissions=0,writes=0,closes=0,aborts=0,permission='granted' as 'granted'|'denied',failClose=false,failReadback=false;
 let onWrite:()=>void=()=>{},onClose:()=>void=()=>{};
 const handle={kind:'file' as const,name:'tune.msq',getFile:async()=>{if(failReadback&&closes)throw Error('Readback denied');return new File([disk],'tune.msq');},requestPermission:async()=>{permissions++;return permission;},createWritable:async()=>{
  let staged=new Uint8Array();writes++;return{write:async(bytes:Uint8Array)=>{staged=bytes.slice();onWrite();},close:async()=>{closes++;if(failClose)throw Error('Close failed');disk=staged;onClose();},abort:async()=>{aborts++;}};
 }};
 const document:AcceptedMsqDocument={...decodeMsqSource(original.buffer),model,name:'tune.msq',size:original.length,lastModified:0,generation:1,handle};
 let snapshot:VeMsqWriteSnapshot={tuneModel:model,entry:model.byName.get('veTable')!,rpmAxis:model.byName.get('rpm')!,loadAxis:model.byName.get('load')!,rows:2,cols:2,revision:0,authorityGeneration:1,values:[80.125,70,70,70]};
 const states:MsqSaveState[]=[];
 let prepare=(async(d:AcceptedMsqDocument,s:VeMsqWriteSnapshot,_c:typeof catalog,_signal:AbortSignal,base:Uint8Array)=>prepareVeMsqWriteOnDiskBase(d,s,catalog,base)) as (d:AcceptedMsqDocument,s:VeMsqWriteSnapshot,c:typeof catalog,signal:AbortSignal,base:Uint8Array)=>Promise<PreparedMsqBytes>;
 const session=createMsqSaveSession({capture:()=>snapshot,current:s=>s===snapshot,canPrepare:()=>true,prepare:(...args)=>prepare(...args),notify:s=>states.push(s)});
 session.setDocument(document);session.setCatalog(catalog);
 return{session,document,states,original,get disk(){return disk;},get counts(){return{permissions,writes,closes,aborts};},setDisk:(text:string)=>{disk=new TextEncoder().encode(text);},setPermission:(next:'granted'|'denied')=>{permission=next;},setCloseFailure:()=>{failClose=true;},setReadFailure:()=>{failReadback=true;},onWrite:(next:()=>void)=>{onWrite=next;},onClose:(next:()=>void)=>{onClose=next;},snapshot:()=>snapshot,selectEntry:(name:string)=>{snapshot={...snapshot,entry:model.byName.get(name)!,values:[65,60,60,60],authorityGeneration:snapshot.authorityGeneration+1};session.reviewChanged();},edit:(values:readonly(number|undefined)[])=>{snapshot={...snapshot,values,authorityGeneration:snapshot.authorityGeneration+1};session.reviewChanged();},prepare:(next:typeof prepare)=>{prepare=next;}};
}
describe('explicit MSQ overwrite transaction',()=>{
 it('distinguishes unsupported picker from access attachment and preserves access failure feedback',()=>{
  const states:MsqSaveState[]=[];let reason:string|undefined='Native picker unavailable';
  const s=setup(),session=createMsqSaveSession({capture:()=>s.snapshot(),current:()=>true,canPrepare:()=>true,pickerUnavailable:()=>reason,prepare:async()=>{throw Error('not used');},notify:state=>states.push(state)});
  session.setDocument({...s.document,handle:undefined});expect(states.at(-1)!.enableAccess).toBe(false);expect(states.at(-1)!.message).toBe(reason);
  reason=undefined;session.setLoading(false);expect(states.at(-1)!.enableAccess).toBe(true);expect(states.at(-1)!.message).toContain('without resetting');
  session.reportAccessIssue('Selected MSQ differs');expect(states.at(-1)!.message).toBe('Selected MSQ differs');expect(states.at(-1)!.reload).toBe(false);expect(states.at(-1)!.enableAccess).toBe(true);
  session.setLoading(true);expect(states.at(-1)!.accessPending).toBe(true);expect(states.at(-1)!.available).toBe(false);session.dispose();
 });
 it('writes only VE, verifies readback, preserves original session reference and tracks newer edits',async()=>{
  const s=setup();await s.session.save();expect(s.counts).toEqual({permissions:1,writes:1,closes:1,aborts:0});
  expect(new TextDecoder().decode(s.disk)).toBe(source.replace('70 70 70 70','80.13 70 70 70'));
  expect(s.document.bytes).toEqual(s.original);expect(s.document.model.byName.get('veTable')!.numericValues![0]).toBe(70);expect(s.states.at(-1)!.outcome).toBe('saved');
  s.edit([85,70,70,70]);expect(s.states.at(-1)!.outcome).toBe('idle');
 });
 it('writes original values back after an earlier save even though changedCells becomes zero',async()=>{
  const s=setup();await s.session.save();s.edit([70,70,70,70]);await s.session.save();expect(s.disk).toEqual(s.original);expect(s.counts.closes).toBe(2);
  await s.session.save();expect(s.counts.closes).toBe(2);expect(s.states.at(-1)!.message).toContain('already matches');
 });
 it('preserves a prior save to a different VE table',async()=>{
  const s=setup();await s.session.save();s.selectEntry('veTable2');await s.session.save();const text=new TextDecoder().decode(s.disk);
  expect(text).toContain('80.13 70 70 70');expect(text).toContain('65 60 60 60');expect(text).toContain('name="other">42');
 });
 it('retains working values on permission denial and allows explicit retry',async()=>{
  const s=setup();s.setPermission('denied');await s.session.save();expect(s.disk).toEqual(s.original);expect(s.counts.writes).toBe(0);expect(s.snapshot().values[0]).toBe(80.125);
  s.setPermission('granted');await s.session.save();expect(s.counts.closes).toBe(1);
 });
 it('checks outside edits before preparation and on activation without requesting write permission',async()=>{
  const s=setup();s.setDisk(source.replace('42','43'));await s.session.checkExternal();expect(s.states.at(-1)!.outcome).toBe('conflict');expect(s.counts.permissions).toBe(0);
  await s.session.save();expect(s.counts.writes).toBe(0);expect(new TextDecoder().decode(s.disk)).toContain('43');
 });
 it('checks outside edits immediately before commit and aborts the staged stream',async()=>{
  const s=setup();s.onWrite(()=>s.setDisk(source.replace('42','44')));await s.session.save();expect(s.counts.closes).toBe(0);expect(s.counts.aborts).toBe(1);expect(s.states.at(-1)!.outcome).toBe('conflict');expect(new TextDecoder().decode(s.disk)).toContain('44');
 });
 it('rejects stale worker completion and prevents duplicate saves/source replacement',async()=>{
  const s=setup(),held=deferred<PreparedMsqBytes>(),entered=deferred<void>();s.prepare(async()=>{entered.resolve();return held.promise;});const pending=s.session.save();await entered.promise;
  await s.session.save();expect(()=>s.session.setDocument(s.document)).toThrow();expect(()=>s.session.setCatalog(catalog)).toThrow();s.edit([90,70,70,70]);
  held.resolve(prepareVeMsqWrite(s.document,{...s.snapshot(),values:[80.125,70,70,70]},catalog));await pending;
  expect(s.counts.permissions).toBe(1);expect(s.counts.writes).toBe(0);expect(s.disk).toEqual(s.original);expect(s.states.at(-1)!.message).toContain('cancelled');
 });
 it('does not mark newer working values saved if they change during close',async()=>{
  const s=setup();s.onClose(()=>s.edit([99,70,70,70]));await s.session.save();expect(s.counts.closes).toBe(1);expect(s.states.at(-1)!.outcome).toBe('issue');expect(s.states.at(-1)!.message).toContain('not marked saved');
 });
 it.each(['close','readback'])('locks saving after unverified %s failure',async failure=>{
  const s=setup();if(failure==='close')s.setCloseFailure();else s.setReadFailure();await s.session.save();expect(s.states.at(-1)!.outcome).toBe('uncertain');expect(s.states.at(-1)!.reload).toBe(true);await s.session.save();expect(s.counts.writes).toBe(1);
 });
 it('refuses blanks and unavailable preparation before permission or I/O',async()=>{
  const s=setup();s.edit([undefined,70,70,70]);await s.session.save();expect(s.counts.permissions).toBe(0);expect(s.counts.writes).toBe(0);
  s.session.setCatalog(undefined);await s.session.save();expect(s.counts.permissions).toBe(0);
 });
 it('disposal rejects a pending completion without publishing or writing',async()=>{
  const s=setup(),entered=deferred<void>(),held=deferred<PreparedMsqBytes>();s.prepare(async()=>{entered.resolve();return held.promise;});const promise=s.session.save();await entered.promise;s.session.dispose();const count=s.states.length;
  held.resolve(prepareVeMsqWrite(s.document,s.snapshot(),catalog));await promise;expect(s.states.length).toBe(count);expect(s.counts.writes).toBe(0);
 });
});
