// Real-browser component regression. Large event fixtures intentionally use a detached
// root: exercise complete analysis/summary/table preparation without drawing 320k-event
// percentile envelopes. Full-shell large-log acceptance covers the visible VE workflow.
import { createSpecializedAnalyzerSuiteView } from '../../apps/web/src/pages/specialized-analyzer-suite-view';
import { robustWeightedEstimate } from '../../core/analysis/ve-evidence-statistics';
import { isVeActualMixtureChannelEligible, preferredVeActualMixtureChannel, suggestAnalyzerChannel } from '../../apps/web/src/pages/analyzer-channel-roles';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r=>setTimeout(r,0)); await new Promise(r=>setTimeout(r,0)); };
const channel = (id,sourceName,unit='') => Object.freeze({id,sourceName,displayName:sourceName,unit,valueType:'number'});
export async function runAnalyzerCpuChecks() {
 const passed=[];
 const check=async(name,run)=>{const start=performance.now();await run();passed.push({name,ms:performance.now()-start});};
 await check('320459 unsorted weighted observations retain exact quantiles',()=>{
  const count=320459,entries=Array.from({length:count},(_,i)=>({value:count-i-1,weight:1}));
  const result=robustWeightedEstimate(entries);
  assert(result.median===160229&&result.p10===32045&&result.p90===288413&&result.totalWeight===count&&entries[0].value===count-1,'Weighted quantile semantics changed');
 });
 await check('catalog replacement reusing IDs updates role and mixture eligibility',()=>{
  const afr=channel('same','AFRValue','AFR'),lambda=channel('same','lambdaValue','lambda'),target=channel('same','target lambda','lambda');
  for(let i=0;i<3;i++){
   assert(preferredVeActualMixtureChannel([afr],'afr')===afr&&isVeActualMixtureChannelEligible(afr,'afr'),'AFR rejected');
   assert(!isVeActualMixtureChannelEligible(lambda,'afr')&&preferredVeActualMixtureChannel([lambda],'lambda')===lambda,'Lambda replacement stale');
   assert(!preferredVeActualMixtureChannel([target],'lambda'),'Target accepted as actual');
  }
  const old=channel('reused','engine RPM'),next=channel('reused','ignition advance');
  assert(suggestAnalyzerChannel('idle','rpm',[old])===old&&!suggestAnalyzerChannel('idle','rpm',[next])&&suggestAnalyzerChannel('ignition','advance',[next])===next,'Reused role metadata stale');
 });
 for(const domain of ['idle','ae-map'])await check(`${domain}: >320k events, full summary, 200 rows and original Logger navigation`,async()=>{
  const eventCount=320001,count=domain==='idle'?eventCount*2:eventCount+1;
  const configs=domain==='idle'?[[channel('rpm','RPMValue'),i=>i===count-2?123:(i%2?900:700)],[channel('target','idleTarget'),()=>900]]:[[channel('tps','TPSValue','%'),i=>i%2?30:0],[channel('afr','AFRValue','AFR'),i=>i===count-1?100:14+i%3]];
  const timeMs=Float64Array.from({length:count},(_,i)=>i*1000),validity=new Uint8Array(count).fill(1);
  const traces=configs.map(([channel,value])=>({channel,complete:true,color:'#abc',range:{startSampleIndex:0,timeMs,validity,values:Float64Array.from({length:count},(_,i)=>value(i))}}));
  let opened;
  const view=createSpecializedAnalyzerSuiteView();view.setActive(false);view.setDomain(domain);
  view.setContext({source:{identity:{},sampleCount:count,revision:0},channels:traces.map(t=>t.channel),traces:[],aTimeMs:0,bTimeMs:timeMs.at(-1),savedRanges:[],loadTraces:async ids=>traces.filter(t=>ids.includes(t.channel.id)),openSamplesInLogger:target=>{opened=target;}});
  view.setActive(true);await settle();
  const root=view.element;
  assert(root.querySelector('[data-specialized="events-count"]').textContent===eventCount.toLocaleString(),'Truncated event total or analysis failed: '+root.querySelector('.specialized-analyzer-empty').textContent);
  const rows=root.querySelectorAll('.specialized-analyzer-events:not(.specialized-analyzer-map-section) tbody tr');
  assert(rows.length===200&&rows[199].cells[0].textContent==='200','Incorrect table cap/order');
  if(domain==='idle')assert(root.querySelector('.specialized-analyzer-summary').textContent.includes('Worst sag-777'),'Lost full-event extrema');
  if(domain==='ae-map')assert(root.querySelector('.specialized-analyzer-summary').textContent.includes('Peak lean excursion84'),'Extrema ignored events beyond displayed rows');
  rows[199].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert(opened?.label.endsWith('200')&&opened.sampleIndices[0]===(domain==='idle'?398:200),'Truncated rows changed source navigation');
  rows[199].click();assert(rows[199].classList.contains('specialized-analyzer-event-row--selected'),'Row selection lost');
  view.setActive(false);
 });
 await check('pressure events preserve both totals, original order and navigation across the 200-row boundary',async()=>{
  const count=300,timeMs=Float64Array.from({length:count},(_,i)=>i*100),validity=new Uint8Array(count).fill(1);
  const configs=[[channel('rpm','RPMValue'),()=>1500],[channel('rail','rail differential pressure'),i=>i%2?300:100],[channel('duty','injector duty'),i=>i%2?95:0]];
  const traces=configs.map(([channel,value])=>({channel,complete:true,color:'#abc',range:{startSampleIndex:0,timeMs,validity,values:Float64Array.from({length:count},(_,i)=>value(i))}}));
  let opened;const view=createSpecializedAnalyzerSuiteView();view.setActive(false);view.setDomain('fuel-injector');
  view.setContext({source:{identity:{},sampleCount:count,revision:0},channels:traces.map(t=>t.channel),traces:[],aTimeMs:0,bTimeMs:timeMs.at(-1),savedRanges:[],loadTraces:async ids=>traces.filter(t=>ids.includes(t.channel.id)),openSamplesInLogger:target=>{opened=target;}});
  view.setActive(true);await settle();const root=view.element;
  const threshold=root.querySelector('[data-option="lowPressure"]');threshold.value='200';threshold.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  assert(root.querySelector('[data-specialized="events-count"]').textContent==='300','Combined total was capped');
  const rows=root.querySelectorAll('.specialized-analyzer-events:not(.specialized-analyzer-map-section) tbody tr');
  assert(rows.length===200&&rows[149].cells[1].textContent==='Low pressure'&&rows[150].cells[1].textContent==='High duty','Pressure event order changed');
  rows[199].dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));assert(opened?.sampleIndices[0]===99&&opened.label.endsWith('200'),'Combined event navigation changed');view.setActive(false);
 });
 return {passed:passed.length,checks:passed};
}
