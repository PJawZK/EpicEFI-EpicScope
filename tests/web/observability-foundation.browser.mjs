import { createObservabilitySession } from '../../apps/web/src/observability/session';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export async function runObservabilityFoundationChecks(){
 const checks=[];const input={recordKind:'event',subsystem:'analyzer',component:'ve',name:'analyzer.render',origin:'programmatic'};
 const ui=()=>({status:document.querySelector('.app-status').textContent,runDisabled:document.querySelector('.ve-workbench-run').disabled,msqState:document.querySelector('.load-msq').dataset.loadState});
 const before=JSON.stringify(ui());
 const session=createObservabilitySession({sessionId:'browser-foundation',maxRecords:100,maxBytes:32768,monotonicNow:()=>0});
 const parent=session.beginOperation({...input,sourceRevision:3,semanticFingerprint:'source=3'});
 const child=parent.child({...input,name:'source.read',origin:'async'});
 child.finish('superseded','source-replaced');assert(!child.finish('success'),'Duplicate terminal accepted');
 child.staleCompletion('obsolete completion');parent.finish('cancelled');
 const records=session.recorder.snapshot();
 assert(records.find(r=>r.name==='async.completion.stale')?.parentOperationId===parent.id,'Explicit causal relationship lost');
 assert(records.filter(r=>r.name==='source.read.completed').length===1,'Terminal history duplicated');
 checks.push('explicit parent/child correlation preserves terminal outcome and separate stale completion in Chromium');
 const start=performance.now();
 for(let i=0;i<100000;i++)session.recorder.record({...input,priority:'detail',semanticFingerprint:'same'});
 const stormMs=performance.now()-start;
 session.recorder.record({...input,name:'runtime.error',severity:'error'});
 const storm=session.recorder.snapshot();
 assert(session.recorder.status().coalesced===99999,'Detail storm did not coalesce');
 assert(storm.some(r=>r.name==='observability.records-coalesced'&&r.metadata.count===99999),'Storm context missing');
 assert(storm.at(-1).name==='runtime.error','Error evidence lost');
 const metadata={value:'safe'};
 session.recorder.record({...input,metadata});metadata.value='changed';
 assert(session.recorder.snapshot().at(-1).metadata.value==='safe','Metadata authority escaped');
 assert(JSON.stringify(ui())===before,'Standalone recorder changed application state');
 checks.push('100k-event storm stays bounded, exposes coalescing, retains errors and leaves application state unchanged');
 const status=session.recorder.status();
 assert(status.recordBytes+status.reservedBytes<=status.maxBytes,'Byte budget exceeded');
 session.checkpoint('healthy');assert(session.end()&&!session.end(),'Session end not idempotent');
 assert(!session.beginOperation(input),'Ended session accepted operation');
 checks.push('byte bounds and explicit session lifecycle hold without installing application producers');
 const observations=[];
 for(const mode of ['minimal-off','normal','detail']){
  const recorder=createObservabilitySession({sessionId:'bench-'+mode,maxRecords:1000,maxBytes:262144}).recorder;
  const begun=performance.now();let count=0;
  for(let i=0;i<20000;i++){count++;if(mode!=='minimal-off')recorder.record({...input,priority:mode==='detail'?'detail':'normal'});}
  observations.push({mode,events:count,totalMs:performance.now()-begun,status:recorder.status()});
 }
 return {passed:checks.length,checks,observed:{stormMs,status,overhead:observations}};
}
