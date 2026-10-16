import { createObservabilitySession } from '../../apps/web/src/observability/session';
import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { createLocalPersistenceFeedback } from '../../apps/web/src/pages/local-persistence-feedback';
import { buildSessionEvidence } from '../../apps/web/src/observability/reports/session-report';
import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { readApplicationObservability } from './observability-lifecycle.browser.mjs';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(check,message){const end=performance.now()+10000;while(!check()){if(performance.now()>end)throw Error(message);await pause(10);}}
export async function runAnomalyChecks(){
 const session=createObservabilitySession({maxRecordBytes:8192,detectAnomalies:true}),r=session.recorder,checks=[];
 const records=()=>r.snapshot(),anomalies=code=>records().filter(x=>x.name==='anomaly.detected'&&x.metadata.ruleCode===code);
 const fixture=await setupVeLifecycleFixture(createVeAnalyzerView,{observability:r}),{view}=fixture;
 try{
  fixture.run();await wait(()=>view.getPrimaryAnalysis(),'VE primary missing');
  const primary=view.getPrimaryAnalysis(),reads=fixture.reads(),revision=view.sessionRevision;
  for(let i=0;i<5;i++){view.setContext(fixture.context);view.setTuneModel(fixture.model,'test.msq');}
  assert(primary===view.getPrimaryAnalysis()&&fixture.reads()===reads&&revision===view.sessionRevision&&!anomalies('work.same-state').length,'Retained VE/no-op state was changed or falsely flagged');
  checks.push('real retained VE context/tune remains authoritative and benign no-op delivery is not redundant calculation');
  const pending=fixture.hold();fixture.run();await pause(0);const started=records().filter(x=>x.name==='ve.analysis.started').at(-1);
  view.setActive(false);pending.resolve([]);await wait(()=>anomalies('async.stale-completion').length,'Stale anomaly missing');
  const anomaly=anomalies('async.stale-completion').find(x=>x.operationId===started.operationId);
  assert(anomaly?.severity==='info'&&records().some(x=>x.name==='ve.analysis.completed'&&x.operationId===started.operationId&&x.outcome==='cancelled')&&!view.getPrimaryAnalysis(),'Detector changed cancellation/acceptance or lost correlation');
  checks.push('real rejected late VE completion yields informational evidence with original cancellation and operation ID');
 }finally{view.setActive(false);fixture.host.remove();}
 const host=document.createElement('section');let retries=0;
 const feedback=createLocalPersistenceFeedback(host,'anomaly-storage',()=>{retries++;return true;},r);
 feedback.report(false,'save');
 const failure=anomalies('persistence.session-only').at(-1),original=records().find(x=>x.sequence===failure?.metadata.evidenceLastSequence);
 assert(original?.name==='persistence.result'&&host.textContent.includes('session only'),'Failed save lacks evidence or existing feedback');
 host.querySelector('button').click();assert(retries===1&&host.textContent.includes('saved locally')&&anomalies('persistence.session-only').length===1,'Detection retried storage or corrupted recovery feedback');
 checks.push('real failed-save feedback records session-only persistence once and keeps the existing single retry/recovery behavior');
 let now=0;const test=createObservabilitySession({detectAnomalies:true,monotonicNow:()=>now,maxRecordBytes:8192}),testRecords=()=>test.recorder.snapshot();
 const op=test.beginOperation({subsystem:'source',component:'test-loader',name:'source.load',origin:'async'});now=30000;
 assert(!testRecords().some(x=>x.name==='anomaly.detected'),'Unfinished policy installed an implicit timer/snapshot scan');
 const report=buildSessionEvidence(test.recorder);
 assert(report.includes('async.unfinished')&&report.includes(op.id)&&report.includes('not-timeout-or-crash-proof'),'Unfinished explicit report lacks inconclusive evidence');
 assert(op.finish('success'),'Unfinished evidence mutated operation authority');
 checks.push('unfinished work is checked at explicit report time, remains inconclusive, and can still finish normally');
 const storm=createObservabilitySession({detectAnomalies:true,maxRecordBytes:8192,maxRecords:64,monotonicNow:()=>0});
 for(let i=0;i<2000;i++)storm.recorder.record({recordKind:'event',subsystem:'owners',component:'storm',name:'async.completion.stale',origin:'async',operationId:`old:${i}`});
 assert(storm.recorder.snapshot().filter(x=>x.name==='anomaly.detected').length===16&&storm.recorder.anomalyStatus().suppressedFindings>=1984&&storm.recorder.status().records<=64,'Distinct stale storm flooded derived evidence');
 checks.push('distinct stale-operation storms cap derived anomalies and expose suppressed coverage without unbounded retention');
 const overhead=[];
 const base={recordKind:'event',subsystem:'owners',component:'benchmark',name:'owner.context.noop',origin:'programmatic',priority:'detail',metadata:{ownerId:'benchmark'}};
 for(let round=0;round<5;round++){
  const sample={};for(const enabled of (round%2?[true,false]:[false,true])){
   const s=createObservabilitySession({detectAnomalies:enabled,maxRecordBytes:8192,maxRecords:64});
   const start=performance.now();for(let i=0;i<5000;i++)s.recorder.record(base);sample[enabled?'enabled':'disabled']=performance.now()-start;
   const all=s.recorder.snapshot();assert(s.recorder.status().records<=64&&!s.recorder.status().internalFailures&&!s.recorder.status().rejected,'Detector benchmark lost boundedness');
   if(enabled)assert(all.some(x=>x.name==='anomaly.detected'&&x.metadata.ruleCode==='repetition.burst'),'Coalesced repetition was lost');
  }overhead.push(sample);
 }
 checks.push('enabled detector observes coalesced bursts without recursive storms and stays bounded during alternating overhead samples');
 return {passed:checks.length,checks,observed:{overhead5000Calls:overhead,health:r.status(),detector:r.anomalyStatus()}};
}
export async function runIntegratedAnomalyChecks(){
 const initial=readApplicationObservability(),before=initial.records.filter(x=>x.name==='logger.analysis-traces.started'||x.name==='analysis.context.changed').length;
 const button=document.querySelector('.bug-report-button');button.click();const report=document.querySelector('.bug-report-text').value;button.click();
 const after=readApplicationObservability();
 assert(after.records.some(x=>x.name==='health.snapshot'&&typeof x.metadata.runtimeErrorCount==='number'),'Existing report health lacks scalar evidence');
 assert(report.includes('[Anomalies]')&&report.includes('detector=enabled')&&report.includes('[Recent owner evidence]')&&report.includes('EpicScope performance diagnostics'),'Integrated report omitted new or original evidence');
 assert(after.records.filter(x=>x.name==='logger.analysis-traces.started'||x.name==='analysis.context.changed').length===before,'Reporting republished context or reread the log');
 return {passed:1,checks:['actual Report projects enabled bounded anomaly evidence and scalar legacy health without new log reads/context delivery'],observed:{sessionId:initial.sessionId,health:after.health,reportLength:report.length}};
}
