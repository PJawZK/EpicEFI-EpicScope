import { createObservabilitySession } from '../../apps/web/src/observability/session';
import { createSessionPersistence } from '../../apps/web/src/observability/session-persistence';
import { createIndexedDbSessionStore } from '../../apps/web/src/observability/persistence';
import { PERSISTENCE_LIMITS, selectSessionEvidence, payloadBytes } from '../../apps/web/src/observability/retention';
import { readApplicationObservability } from './observability-lifecycle.browser.mjs';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const request=operation=>new Promise((resolve,reject)=>{operation.onsuccess=()=>resolve(operation.result);operation.onerror=()=>reject(operation.error);});
const open=(name,version)=>request(indexedDB.open(name,version));
const remove=name=>request(indexedDB.deleteDatabase(name));
function payload(id,time=1000){
 const records=Array.from({length:50},(_,i)=>({schemaVersion:1,sessionId:id,sequence:i+1,wallTime:time,monotonicTime:i,recordKind:'event',subsystem:'test',component:'native-idb',name:i===10?'runtime.error':'owner.event',severity:i===10?'error':'info',origin:'system',priority:'normal',metadata:i===10?{message:'persisted-native-error'}:{}}));
 const summary={sessionId:id,startedAt:time,lastSeen:time,lastSequence:50,confirmedEnd:false,lastActiveView:'logger',lastCompletedOperation:'test-operation',lastCheckpoint:'test-checkpoint',lastCheckpointSequence:1,observedErrors:1,observedAnomalies:0,coalesced:0,evicted:0};
 return selectSessionEvidence(summary,records);
}
export async function runPersistenceChecks(){
 const checks=[],observed={},name='epicscope-test-'+crypto.randomUUID();let now=1000;
 let store=createIndexedDbSessionStore({name,now:()=>now});
 try{
  assert((await store.load()).length===0,'New versioned store not empty');
  const first=payload('session-0');await store.save(first,true);store.close();store=createIndexedDbSessionStore({name,now:()=>now});
  let loaded=await store.load();assert(loaded.length===1&&loaded[0].records.some(x=>x.metadata.message==='persisted-native-error')&&loaded[0].windows.length===1,'Native reopen lost evidence/windows');
  checks.push('native IndexedDB transaction survives adapter close/reopen with summary, tail and error context');
  const originalPut=IDBObjectStore.prototype.put,puts=[];
  IDBObjectStore.prototype.put=function(...args){if(this.transaction.db.name===name)puts.push(this.name);return originalPut.apply(this,args);};
  try{now=2000;await store.save({...first,summary:{...first.summary,lastSeen:now}},false);}finally{IDBObjectStore.prototype.put=originalPut;}
  assert(JSON.stringify(puts)===JSON.stringify(['summaries']),'Idle heartbeat rewrote evidence');
  checks.push('native idle heartbeat updates only the summary index rather than rewriting event history');
  for(let i=1;i<8;i++){now+=1000;await store.save(payload('session-'+i,now),true);}
  loaded=await store.load();assert(loaded.length===4&&loaded[0].summary.sessionId==='session-7'&&loaded.every(x=>['session-4','session-5','session-6','session-7'].includes(x.summary.sessionId))&&loaded.reduce((n,x)=>n+payloadBytes(x),0)<=PERSISTENCE_LIMITS.totalBytes,'Native session/byte retention failed');
  checks.push('native transactions retain at most current plus three previous sessions within the total byte budget');
  IDBObjectStore.prototype.put=function(...args){if(this.transaction.db.name===name)throw new DOMException('Injected quota failure','QuotaExceededError');return originalPut.apply(this,args);};
  let rejected=false;try{await store.save(payload('rejected',now),true);}catch{rejected=true;}finally{IDBObjectStore.prototype.put=originalPut;}
  loaded=await store.load();assert(rejected&&loaded.length===4&&!loaded.some(x=>x.summary.sessionId==='rejected'),'Aborted transaction changed durable sessions');
  await store.save(payload('recovered',++now),true);assert((await store.load()).some(x=>x.summary.sessionId==='recovered'),'Native write did not recover');
  checks.push('native quota-fault transaction abort preserves earlier sessions and the next healthy write recovers');
  now+=PERSISTENCE_LIMITS.ageMs+1;assert((await store.load()).length===0,'Old native sessions survived age pruning');
  checks.push('native recovery automatically removes sessions beyond the persisted age limit');
 }finally{store.close();await remove(name);}
 const future='epicscope-future-'+crypto.randomUUID();let db=await open(future,2);db.close();store=createIndexedDbSessionStore({name:future});
 try{let denied=false;try{await store.load();}catch(e){denied=e.name==='VersionError';}assert(denied,'Future database version was reset or accepted');}
 finally{store.close();db=await open(future,2);assert(db.version===2,'Future database version changed');db.close();await remove(future);}
 checks.push('unsupported newer database version fails closed without deleting or downgrading stored evidence');
 const corrupt='epicscope-corrupt-'+crypto.randomUUID();store=createIndexedDbSessionStore({name:corrupt});await store.load();await store.save(payload('old'),true);store.close();db=await open(corrupt,1);
 await new Promise((resolve,reject)=>{const tx=db.transaction('summaries','readwrite');tx.objectStore('summaries').put({schemaVersion:2,summary:payload('old').summary,bytes:100});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();store=createIndexedDbSessionStore({name:corrupt});
 try{let denied=false;try{await store.load();}catch(e){denied=e.name==='ObservabilitySchemaError';}assert(denied,'Future payload schema was accepted');}
 finally{store.close();db=await open(corrupt,1);const entry=await request(db.transaction('summaries').objectStore('summaries').get('old'));assert(entry.schemaVersion===2,'Unsupported schema was overwritten');db.close();await remove(corrupt);}
 checks.push('unsupported payload schema is reported without overwriting existing records');
 const stressName='epicscope-stress-'+crypto.randomUUID(),stressStore=createIndexedDbSessionStore({name:stressName});
 const stressSession=createObservabilitySession({maxRecordBytes:8192});
 for(let i=0;i<20000;i++)stressSession.recorder.record({recordKind:'event',subsystem:'test',component:'batch-stress',name:'event',origin:'system',priority:'detail',metadata:{index:i,text:'bounded event metadata'}});
 const writer=createSessionPersistence(stressSession,{store:stressStore,automatic:false});
 try{
  await writer.ready;
  let start=performance.now();await writer.flush();const first=performance.now()-start;
  start=performance.now();await writer.flush();const heartbeat=performance.now()-start;
  stressSession.checkpoint('after-stress');start=performance.now();await writer.flush();const update=performance.now()-start;
  const recovered=await stressStore.load();
  assert(recovered.length===1&&recovered[0].records.length<=5000&&payloadBytes(recovered[0])<=PERSISTENCE_LIMITS.sessionBytes&&recovered[0].summary.lastCheckpoint==='after-stress','Bounded stress batch did not survive native recovery');
  observed.bounded20000EventBatch={firstFlushMs:first,idleHeartbeatMs:heartbeat,smallUpdateFlushMs:update,retainedRecords:recovered[0].records.length,payloadBytes:payloadBytes(recovered[0]),recorder:stressSession.recorder.status()};
 }finally{await writer.dispose();await remove(stressName);}
 checks.push('20000-event bounded diagnostic batch survives native persistence with count/UTF-8 limits; cold/heartbeat/update timings are observations only');
 return {passed:checks.length,checks,observed};
}
export function prepareRecovery(){
 const before=readApplicationObservability();
 window.dispatchEvent(new ErrorEvent('error',{message:'stage7 recovery evidence',filename:'synthetic-stage7.js'}));
 // Reuse the existing visibility owner to request its lifecycle batch; test-only
 // descriptor is restored immediately. No production hook or test flush API.
 const descriptor=Object.getOwnPropertyDescriptor(document,'visibilityState');
 try{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));}
 finally{if(descriptor)Object.defineProperty(document,'visibilityState',descriptor);else delete document.visibilityState;}
 return {id:before.sessionId,writes:before.persistence.writes};
}
export function recoveryReady(writes){const s=readApplicationObservability();return s.persistence.state==='ready'&&s.persistence.writes>writes&&s.persistence.lastSavedSequence>=s.records.find(x=>x.metadata?.message==='stage7 recovery evidence')?.sequence;}
export function checkRecovered(id,confirmed){
 const s=readApplicationObservability(),old=s.persistence.previous.find(x=>x.summary.sessionId===id);
 assert(s.persistence.state==='ready'&&old,'Previous session was not recovered');
 assert(old.summary.confirmedEnd===confirmed,'Termination classification overclaimed or lost confirmed end');
 if(!confirmed)assert(old.records.some(x=>x.metadata.message==='stage7 recovery evidence'),'Last committed crash-like evidence missing');
 assert(!s.records.some(x=>x.metadata?.message==='stage7 recovery evidence'),'Recovered history contaminated current runtime errors');
 const button=document.querySelector('.bug-report-button');button.click();const text=document.querySelector('.bug-report-text').value;button.click();
 assert(text.includes('[Previous-session black box]')&&text.includes(id)&&text.includes(confirmed?'confirmed-normal-end':'unconfirmed-no-end-observed')&&text.includes('not crash causality'),'Previous-session report lacks useful evidence/causality qualification');
 return {passed:1,checks:[confirmed?'normal end is recovered as confirmed with previous diagnostics isolated from the new recorder':'renderer termination recovers the last committed tail/windows as unconfirmed, without claiming crash causality or contaminating current errors'],observed:{previousId:id,currentId:s.sessionId,records:old.records.length,windows:old.windows.length}};
}
export function endForRecovery(){const s=readApplicationObservability();window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));return s.sessionId;}
