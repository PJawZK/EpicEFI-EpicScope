import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
const wait = async (fn, label) => { const end = performance.now()+10000; while(!fn()){if(performance.now()>end)throw Error(label);await settle();} };
const model = () => normalizeMsqTune(parseMsq(`<msq><page>
<constant name="veRpmBins" rows="1" cols="2">1000 2000</constant><constant name="veLoadBins" rows="2" cols="1">50 100</constant>
<constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant><constant name="afrLoadBins" rows="2" cols="1">50 100</constant>
<constant name="veTable" rows="2" cols="2" units="%">70 70 70 70</constant><constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant></page></msq>`));
const channels = [['rpm','RPM','rpm'],['map','MAP','kPa'],['afr','AFR','AFR'],['pw','PW','ms']].map(([id,sourceName,unit])=>({id,sourceName,displayName:sourceName,unit,valueType:'number'}));
const traces = channels.map((channel,i)=>({channel,complete:true,color:'#abc',range:{startSampleIndex:0,timeMs:Float64Array.from({length:60},(_,i)=>i*100),values:new Float64Array(60).fill([1000,50,15,4][i]),validity:new Uint8Array(60).fill(1)}}));
const delay = serializeVeDelayTable({rpmBins:[1000,2000],loadBins:[50,100],rows:2,cols:2,origin:'saved-file',cells:Array.from({length:4},(_,i)=>({row:Math.floor(i/2),col:i%2,state:'measured',workingMs:100,recommendedMs:100,workingProvenance:'measured-recommendation',eventCount:5,confidence:'moderate',sourceEvents:[]}))});
export async function runVeReadinessOwnerChecks(){
 const checks=[];const view=createVeAnalyzerView();const initialState=view.getReadiness?.();const initiallyDisabled=view.element.querySelector('.ve-workbench-run').disabled;const root=view.element;root.hidden=false;document.body.append(root);
 let reads=0,load=async(ids)=>traces.filter(t=>ids.includes(t.channel.id));
 const context={source:{identity:{},sampleCount:60,revision:0},channels,traces:[],loadTraces:async(ids)=>{reads++;return load(ids);},aTimeMs:0,bTimeMs:3000,savedRanges:[]};
 const change=(role,value)=>{const field=root.querySelector(`[data-role="${role}"]`);field.value=value;field.dispatchEvent(new Event('change',{bubbles:true}));};
 const blockerText=()=>root.querySelector('.ve-run-blocker-panel').textContent;
 const button=root.querySelector('.ve-workbench-run');const stable=()=>root.querySelector('[data-role="stable-ms"]');
 const agree=()=>{const state=view.getReadiness();assert(button.disabled===!state.canRun,'Run gate differs from owner');assert(root.querySelector('[data-ve-analyzer="readiness"]').textContent===state.text,'Summary differs from owner');assert(root.querySelector('[data-ve-analyzer="advanced-readiness"]').textContent===state.text,'Advanced summary differs from owner');return state;};
 try{
  view.setContext(context);view.setTuneModel(model(),'readiness.msq');
  for(const [role,id]of [['rpm','rpm'],['load','map'],['actual','afr'],['fuelCommand','pw']])change(role,id);
  const input=root.querySelector('[data-ve-analyzer="load-delay-file"]');Object.defineProperty(input,'files',{configurable:true,value:[{name:'readiness-delay.json',text:async()=>delay}]});input.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  stable().value='';stable().dispatchEvent(new Event('change',{bubbles:true}));await settle();
  assert(button.disabled&&blockerText().includes('Minimum stable duration'),'Missing stable duration lacks an actionable blocker');
  assert(agree().blockers.some(b=>b.code==='stable-ms'&&b.targetSelector==='[data-role="stable-ms"]'),'Stable duration has no structured Fix target');
  root.querySelector('.ve-run-quick-fix').click();await settle();assert(document.activeElement===stable(),'Quick Fix did not focus required stable duration: '+JSON.stringify({blockers:view.getReadiness().blockers,active:document.activeElement?.outerHTML.slice(0,250),hidden:stable().closest('[hidden]')?.className}));
  checks.push('blank stable duration has an owner blocker and working Quick Fix instead of a generic dead end');
  assert(initiallyDisabled&&initialState?.canRun===false&&initialState.text==='Not ready','Initial Run gate disagrees with empty owner state');
  checks.push('fresh controller starts with a disabled Run gate and matching empty readiness');
  stable().value='0';stable().dispatchEvent(new Event('change',{bubbles:true}));await settle();
  assert(agree().canRun&&view.getReadiness().title===''&&root.querySelector('.ve-run-blocker-panel').hidden,'Recovery left stale blockers/title');
  const ready=view.getReadiness();let notifications=0;const unsubscribe=view.onReadinessChange(()=>notifications++);
  view.refresh();await settle();assert(view.getReadiness()===ready&&notifications===0,'Unchanged refresh replaced readiness snapshot or notified');
  checks.push('ready gate, summaries and cleared blockers share a retained snapshot on unchanged refresh');

  const revision=view.sessionRevision;stable().value='';stable().dispatchEvent(new Event('input',{bubbles:true}));await settle();const changedRevision=view.sessionRevision;
  stable().dispatchEvent(new Event('change',{bubbles:true}));await settle();
  assert(changedRevision===revision+1&&view.sessionRevision===changedRevision&&!agree().canRun,'Input/blur duplicated invalidation or left Run enabled');
  root.querySelector('.ve-run-info-button').click();assert(root.querySelector('.ve-run-info-popout')?.textContent.includes('Minimum stable duration')??root.querySelector('[aria-label="Run Analysis blockers"]').textContent.includes('Minimum stable duration'),'Info popout omitted owner blocker');
  checks.push('numeric input updates readiness immediately and native change does not repeat its semantic invalidation');

  // The readiness table is an output: changing its labels must never change decisions.
  const body=root.querySelector('[data-ve-analyzer="readiness-body"]');for(const cell of body.querySelectorAll('td'))cell.textContent='Resolved translated presentation';
  await settle();assert(!agree().canRun&&blockerText().includes('Minimum stable duration'),'Presentation text changed authoritative readiness');
  stable().value='0';stable().dispatchEvent(new Event('change',{bubbles:true}));await settle();assert(agree().canRun,'Valid setting did not recover');
  checks.push('rendered table text is presentation only and cannot hide required blockers');

  const saved=reads;change('min-rpm','');await settle();assert(agree().canRun&&reads===saved,'Optional blank bounds blocked or calculated');
  change('mixture-scale','lambda');await settle();assert(agree().blockers.some(b=>b.code==='mixture-scale'),'Mixture mismatch not represented');change('mixture-scale','afr');change('actual','afr');await settle();
  checks.push('optional blank bounds remain optional while mixture mismatch is structured and actionable');

  let release;load=()=>new Promise(r=>{release=r;});button.click();await wait(()=>!!release,'Pending run did not load');
  assert(agree().pending&&!view.getReadiness().canRun&&view.getReadiness().blockers.length===0,'Pending calculation presented as unresolved inputs');
  assert(root.querySelector('.ve-run-blocker-panel').hidden&&root.querySelector('.ve-run-quick-fix').hidden,'Pending run displayed stale fixes');
  view.setActive(false);const inactive=view.getReadiness();release(traces);await settle();assert(!agree().active&&!inactive.canRun&&!view.getPrimaryAnalysis(),'Inactive stale completion published');
  load=async(ids)=>traces.filter(t=>ids.includes(t.channel.id));view.setActive(true);await settle();assert(agree().canRun,'Re-entry failed to restore readiness');
  checks.push('pending and inactive states suppress misleading blockers and reject obsolete completion');

  load=async(ids)=>traces.filter(t=>t.channel.id!=='afr'&&ids.includes(t.channel.id));button.click();await wait(()=>!view.getReadiness().pending,'Missing-data run did not finish');
  assert(agree().blockers.some(b=>b.code==='actual'&&b.message.includes('Unavailable in scope')),'Loaded missing role was not reported by owner');
  load=async(ids)=>traces.filter(t=>ids.includes(t.channel.id));view.refresh();button.click();await wait(()=>!!view.getPrimaryAnalysis(),'Valid retry did not finish');await settle();assert(agree().canRun&&view.getReadiness().text==='VE proposal calculated','Completed state not shared');
  checks.push('loaded-scope availability and successful retry/completion use the same readiness result');
  unsubscribe();const count=notifications;stable().value='';stable().dispatchEvent(new Event('change',{bubbles:true}));assert(notifications===count,'Unsubscribed readiness consumer fired');
  checks.push('readiness subscription can be removed independently of primary-analysis notifications');
  stable().value='0';stable().dispatchEvent(new Event('change',{bubbles:true}));
  const responsive=traces.map((trace,index)=>({...trace,range:{...trace.range,values:Float64Array.from({length:60},(_,i)=>index===2?(i<12?15:14):index===3?(i<10?4:5):trace.range.values[i])}}));
  load=async(ids)=>responsive.filter(trace=>ids.includes(trace.channel.id));
  view.setTuneModel(model(),'recommendation-readiness.msq');change('delay-min-events','1');
  root.querySelector('[data-ve-analyzer="grab-delay"]').click();
  await wait(()=>!root.querySelector('[data-ve-analyzer="use-delay"]').disabled,'Recommendation did not become usable');await settle();
  assert(agree().delayState==='recommendation'&&!view.getReadiness().canRun&&view.getReadiness().blockers.some(b=>b.code==='delay-activate'),'Recommendation was silently treated as working delay');
  root.querySelector('[data-ve-analyzer="use-delay"]').click();await settle();
  assert(agree().delayState==='working'&&view.getReadiness().canRun,'Explicit recommendation activation did not update readiness');
  checks.push('delay discovery stays recommendation-only until explicit activation updates the shared result');

  return {passed:checks.length,checks};
 }finally{view.setActive(false);root.remove();}
}
