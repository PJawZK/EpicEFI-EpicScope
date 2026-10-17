import { createHistogramDistributionView } from '../../apps/web/src/pages/histogram-distribution-view';
import { createOwnerEvidence } from '../../apps/web/src/observability/producers/owner';
import { createObservabilitySession } from '../../apps/web/src/observability/session';
import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { createHistogramMathChannelsView } from '../../apps/web/src/pages/histogram-math-channels-view';
import { createLocalPersistenceFeedback } from '../../apps/web/src/pages/local-persistence-feedback';
import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(check,message){const end=performance.now()+10000;while(!check()){if(performance.now()>end)throw Error(message);await pause(10);}}
function openEvidence(root,cell){assert(cell,'Missing measured VE cell');cell.setPointerCapture=()=>{};cell.dispatchEvent(new PointerEvent('pointerdown',{pointerId:61,pointerType:'mouse',bubbles:true,cancelable:true}));cell.dispatchEvent(new PointerEvent('pointerup',{pointerId:61,pointerType:'mouse',bubbles:true,cancelable:true}));const tool=[...root.querySelectorAll('.ve-proposal-shared-toolbar button')].find(candidate=>candidate.title==='Cell Evidence');assert(tool,'Cell Evidence tool missing');tool.click();}
export async function runOwnerEvidenceChecks(){
 const session=createObservabilitySession({maxRecordBytes:8192}),r=session.recorder,checks=[];
 const records=()=>r.snapshot(),count=name=>records().filter(x=>x.name===name).length;
 const fixture=await setupVeLifecycleFixture(createVeAnalyzerView,{observability:r});
 const {view,root}=fixture;
 try{
  fixture.run();await wait(()=>view.getPrimaryAnalysis(),'VE analysis did not complete');
  assert(records().some(x=>x.name==='ve.analysis.completed'&&x.outcome==='success'),'Successful VE run lacks terminal evidence');
  checks.push('VE records an actual successful analysis with explicit operation identity');
  const primary=view.getPrimaryAnalysis(),revision=view.sessionRevision,reads=fixture.reads(),starts=count('ve.analysis.started');
  view.setContext(fixture.context);view.setTuneModel(fixture.model,'test.msq');
  assert(count('ve.context.noop')&&count('ve.tune.noop')&&view.getPrimaryAnalysis()===primary&&view.sessionRevision===revision&&fixture.reads()===reads,'No-op evidence changed owner state or reloaded data');
  checks.push('unchanged context/tune records no-op evidence without revision, analysis or data-load changes');
  const cell=[...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find(c=>c.title.startsWith('Measured proposal'));
  assert(cell,'Missing measured evidence cell');openEvidence(root,cell);await pause(0);openEvidence(root,cell);await pause(0);
  const veTab = root.querySelector('[data-table-tab="ve"]');
  veTab?.click(); await pause(0);
  const headerEvidence = root.querySelector('.ve-v50-table-actions button[aria-label="Cell Evidence"]');
  assert(headerEvidence && !headerEvidence.hidden && headerEvidence.getBoundingClientRect().width > 0,
    'Visible v50 Cell Evidence action missing');
  const beforeHeaderOpen = count('ve.popup.cache-hit');
  headerEvidence.click(); await pause(0);
  assert(count('ve.popup.cache-hit') > beforeHeaderOpen,
    'Visible v50 Evidence action did not delegate to the working inspector');
  assert(count('ve.popup.build')&&count('ve.popup.cache-hit')&&fixture.reads()===reads,'Popup evidence did not distinguish retained build/cache hit');
  checks.push('popup reports detail build/cache reuse without recomputing or loading analysis data');
  const select=root.querySelector('select[aria-label="VE Analyzer result view"]');
  assert(select,'Missing Result View control: '+JSON.stringify({
    compactActions: root.querySelector('.ve-v50-table-actions')?.outerHTML.slice(0,1200),
    headers: [...root.querySelectorAll('.ve-v50-table-head')].map(h=>h.outerHTML.slice(0,600)),
    selectCount: root.querySelectorAll('select').length,
    resultViewAnywhere: document.querySelectorAll('select[aria-label="VE Analyzer result view"]').length
  }));const initialResultView=select.value;select.value=[...select.options].find(o=>o.value!==select.value).value;select.dispatchEvent(new Event('change',{bubbles:true}));await pause(0);
  assert(count('ve.result-view.changed')&&view.getPrimaryAnalysis()===primary&&view.sessionRevision===revision&&count('ve.analysis.started')===starts,'Presentation evidence changed semantic authority');
  openEvidence(root,cell);await pause(0);assert(fixture.reads()===reads,'Result View reopened popup with extra reads');
  checks.push('Result View evidence remains presentation-only and preserves primary/cached evidence');
  select.value=initialResultView;select.dispatchEvent(new Event('change',{bubbles:true}));await pause(0);
  let pending=fixture.hold();fixture.run();await pause(0);const first=records().filter(x=>x.name==='ve.analysis.started').at(-1);
  view.setActive(false);pending.resolve([]);await pause(20);
  assert(records().some(x=>x.operationId===first.operationId&&x.name==='ve.analysis.completed'&&x.outcome==='cancelled')&&records().some(x=>x.operationId===first.operationId&&x.name==='async.completion.stale')&&!view.getPrimaryAnalysis(),'Hidden completion lacks cancellation/stale evidence or publishes old results');
  checks.push('leaving VE records cancellation and the rejected late completion without accepting old work');
  view.setActive(true);pending=fixture.hold();fixture.run();await pause(0);const second=records().filter(x=>x.name==='ve.analysis.started').at(-1);
  view.setContext({...fixture.context,source:{...fixture.context.source,revision:1}});pending.resolve([]);await pause(20);
  assert(records().some(x=>x.operationId===second.operationId&&x.name==='ve.analysis.completed'&&x.outcome==='superseded')&&records().some(x=>x.operationId===second.operationId&&x.name==='async.completion.stale')&&!view.getPrimaryAnalysis(),'Real invalidation did not supersede/reject obsolete work');
  checks.push('real source revision records semantic invalidation, supersession and rejected stale completion');
 }finally{view.setActive(false);fixture.host.remove();}
 const math=createHistogramMathChannelsView(r),host=document.createElement('section');math.element.hidden=false;host.append(math.element);document.body.append(host);
 try{
  let release;const held=new Promise(resolve=>{release=resolve;});
  math.setContext({channels:[{id:'rpm',sourceName:'RPM',displayName:'RPM',unit:'rpm',valueType:'number'}],traces:[],loadTraces:()=>held,aTimeMs:0,bTimeMs:100});
  const input=math.element.querySelector('.math-channel-formula');input.value='[RPM] * 2';input.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(()=>count('math.preview.started')>0,'Math preview did not begin');const operation=records().filter(x=>x.name==='math.preview.started').at(-1);
  math.setActive(false);release([]);await pause(20);
  assert(records().some(x=>x.operationId===operation.operationId&&x.name==='math.preview.completed'&&x.outcome==='cancelled')&&records().some(x=>x.operationId===operation.operationId&&x.name==='async.completion.stale'),'Math hide/late completion lost correlated evidence');
  checks.push('Math preview retains its existing timer/generation behavior and records hidden stale completion');
 }finally{math.setActive(false);host.remove();}
 const distribution=createHistogramDistributionView(r),distributionHost=document.createElement('section');distribution.element.hidden=false;distributionHost.append(distribution.element);document.body.append(distributionHost);
 try{
  let release,reads=0;const held=new Promise(resolve=>{release=resolve;});
  const channel={id:'rpm',sourceName:'RPM',displayName:'RPM',unit:'rpm',valueType:'number'};
  distribution.setContext({channels:[channel],traces:[],loadTraces:()=>{reads++;return held;},aTimeMs:0,bTimeMs:100});
  await wait(()=>reads>0,'Distribution read did not begin');distributionHost.hidden=true;
  release([{channel,complete:true,color:'#abc',range:{startSampleIndex:0,timeMs:Float64Array.from([0,100]),values:Float64Array.from([2,4]),validity:Uint8Array.from([1,1])}}]);
  await wait(()=>records().some(x=>x.component==='histogram-distribution-view'&&x.name==='histogram.completion.current'&&x.metadata.domHidden===true),'Hidden ancestor completion was not observable');
  checks.push('existing Histogram completion while an ancestor is hidden is recorded without changing its acceptance behavior');
 }finally{distributionHost.remove();}
 const persistenceHost=document.createElement('section');let retries=0;
 const feedback=createLocalPersistenceFeedback(persistenceHost,'owner-evidence',()=>++retries===2,r);
 feedback.report(false,'save');const retry=persistenceHost.querySelector('button');retry.click();retry.click();feedback.report(true,'delete');
 const results=records().filter(x=>x.name==='persistence.result'&&x.component==='owner-evidence');
 assert(retries===2&&JSON.stringify(results.map(x=>[x.metadata.action,x.metadata.persisted]))===JSON.stringify([['save',false],['retry',false],['retry',true],['delete',true]]),'Persistence recording changed retry calls or failure/success evidence');
 checks.push('persistence feedback records exact failure/retry/recovery/deletion without additional storage calls');
 assert(r.status().rejected===0,'Owner metadata exceeded bounded record limits');
 const benchmark=createObservabilitySession({maxRecordBytes:8192,maxRecords:64}),enabled=createOwnerEvidence(benchmark.recorder,'owner-benchmark'),disabled=createOwnerEvidence(undefined,'owner-benchmark'),overhead=[];
 for(let round=0;round<5;round++){
  const sample={};for(const [name,owner]of (round%2?[['enabled',enabled],['disabled',disabled]]:[['disabled',disabled],['enabled',enabled]])){
   const start=performance.now();for(let i=0;i<5000;i++)owner.event('owner.context.noop',{unchanged:true});sample[name]=performance.now()-start;
  }overhead.push(sample);
 }
 benchmark.recorder.snapshot();
 return {passed:checks.length,checks,observed:{records:r.status().records,health:r.status(),overhead5000Calls:overhead,benchmarkHealth:benchmark.recorder.status()}};
}

export async function runIntegratedOwnerEvidence(){
 const { readApplicationObservability }=await import('./observability-lifecycle.browser.mjs');
 const snapshot=readApplicationObservability(),records=snapshot.records;
 assert(records.some(x=>x.name==='logger.context.created')&&records.some(x=>x.name==='logger.analysis-traces.started')&&records.some(x=>x.name==='logger.analysis-traces.completed'&&x.outcome==='success'),'Actual Logger context/read owners did not publish');
 assert(records.some(x=>x.name==='workspace.restore.started')&&records.some(x=>x.name==='workspace.restore.completed'&&x.outcome==='success'),'Actual workspace restore lacks operation evidence');
 assert(records.some(x=>x.name==='ve.analysis.completed'&&x.outcome==='success')&&records.some(x=>x.name==='storage.load.completed'),'Actual VE/storage owners missing shared session evidence');
 const button=document.querySelector('.bug-report-button');button.click();const text=document.querySelector('.bug-report-text').value;button.click();
 assert(text.includes('[Recent owner evidence]')&&text.includes('ownerId='),'Bug Report does not expose reviewable owner evidence');
 return {passed:2,checks:['actual Logger context/read and workspace restore operations appear in the shared session','actual VE and storage owners publish bounded completion evidence'],observed:{health:snapshot.health}};
}
