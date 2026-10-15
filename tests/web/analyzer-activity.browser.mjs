// Real-browser regression module. Import through Vite and await runAnalyzerActivityChecks().
import { createAnalyzerPage } from '../../apps/web/src/pages/analyzer-page';
import { createTuneTableView } from '../../apps/web/src/pages/tune-table-view';
import { createBoostAnalyzerView } from '../../apps/web/src/pages/boost-analyzer-view';
import { createSpecializedAnalyzerSuiteView } from '../../apps/web/src/pages/specialized-analyzer-suite-view';
import { createIgnitionAnalyzerView } from '../../apps/web/src/pages/ignition-analyzer-view';
import { createFuelInjectorAnalyzerView } from '../../apps/web/src/pages/fuel-injector-analyzer-view';
import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
const channels = [
 ['rpm','RPM','rpm',1500],['map','MAP','kPa',70],['afr','AFRValue','AFR',15],['pw','PW','ms',4],
 ['idleTarget','Idle target','rpm',900],['advance','Ignition advance','deg',25],['tps','TPS','%',20],['clt','CLT','C',90],['sync','Sync state','',1],
].map(([id,sourceName,unit,value])=>({id,sourceName,displayName:sourceName,unit,value,valueType:'number'}));
const traces=channels.map(channel=>({channel,color:'#abc',complete:true,range:{startSampleIndex:0,timeMs:Float64Array.from({length:60},(_,i)=>100*i),values:new Float64Array(60).fill(channel.value),validity:new Uint8Array(60).fill(1)}}));
const model=()=>normalizeMsqTune(parseMsq('<msq><page><constant name="veTable" rows="2" cols="2">70 70 70 70</constant><constant name="veRpmBins" rows="1" cols="2">1000 2000</constant><constant name="veLoadBins" rows="2" cols="1">50 100</constant><constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant><constant name="afrLoadBins" rows="2" cols="1">50 100</constant><constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant><constant name="ignitionTable" rows="2" cols="2" units="deg">20 20 20 20</constant></page></msq>'));
const context=loadTraces=>({source:{identity:{},sampleCount:60,revision:0},channels,traces:[],loadTraces,aTimeMs:0,bTimeMs:3000,savedRanges:[]});
const wait=async()=>{await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));};
async function until(predicate){const deadline=performance.now()+10000;while(!predicate()){if(performance.now()>deadline)throw Error('VE completion timed out');await wait();}}
function assert(ok,message){if(!ok)throw Error(message);}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function host(view){const h=document.createElement('section');h.append(view.element);document.body.append(h);return h;}
function change(root,role,value){const s=root.querySelector(`select[data-role="${role}"]`);assert(s,'Missing '+role);s.value=value;s.dispatchEvent(new Event('change',{bubbles:true}));}
async function loadDelay(view){
 const input=view.element.querySelector('[data-ve-analyzer="load-delay-file"]');
 const text=serializeVeDelayTable({rpmBins:[1000,2000],loadBins:[50,100],rows:2,cols:2,origin:'saved-file',cells:Array.from({length:4},(_,i)=>({row:Math.floor(i/2),col:i%2,state:'measured',workingMs:100,recommendedMs:100,workingProvenance:'measured-recommendation',eventCount:5,confidence:'moderate',sourceEvents:[]}))});
 Object.defineProperty(input,'files',{configurable:true,value:[{name:'delay.json',text:async()=>text}]});input.dispatchEvent(new Event('change',{bubbles:true}));await wait();
}
export async function runAnalyzerActivityChecks(){
 const passed=[];const check=async(name,test)=>{await test();passed.push(name);};
 const factories=[['tune correlation',createTuneTableView],['boost',createBoostAnalyzerView],['suite',createSpecializedAnalyzerSuiteView],['ignition',createIgnitionAnalyzerView],['fuel pressure',createFuelInjectorAnalyzerView]];
 for(const [name,create] of factories){
  for(const reject of [false,true])await check(`${name}: defers hidden work and rejects obsolete ${reject?'errors':'results'}`,async()=>{
   const view=create(),h=host(view),old=deferred();let reads=0;
   view.setActive(false);view.setContext(context(async()=>{reads++;return old.promise}));
   if(view.setDomain)view.setDomain('fueling');if(view.setTuneModel)view.setTuneModel(model(),'old.msq');view.refresh();await wait();
   assert(reads===0&&!view.element.querySelector('option[value="rpm"]'),'Inactive controller rebuilt/loaded');
   view.setActive(true);await wait();assert(reads===1,name+': activation did not perform exactly one load: '+reads);
   view.setActive(false);const html=view.element.innerHTML;
   view.refresh();if(reject)old.reject(Error('obsolete request failed'));else old.resolve(traces);await wait();
   assert(reads===1&&view.element.innerHTML===html,'Inactive completion changed DOM or started work');
   let latest=0;view.setContext(context(async ids=>{latest++;return traces.filter(t=>ids.includes(t.channel.id))}));if(view.setTuneModel)view.setTuneModel(model(),'new.msq');await wait();assert(latest===0,'Hidden replacement started work');
   view.setActive(true);await wait();assert(latest===1,'Latest inputs were not applied once');h.remove();
  });
  await check(`${name}: resumed result cannot be overwritten by an older session`,async()=>{
   const view=create(),h=host(view),old=deferred();
   view.setActive(false);view.setContext(context(async()=>old.promise));if(view.setDomain)view.setDomain('fueling');if(view.setTuneModel)view.setTuneModel(model(),'old.msq');view.setActive(true);await wait();view.setActive(false);
   view.setContext(context(async ids=>traces.filter(t=>ids.includes(t.channel.id))));if(view.setTuneModel)view.setTuneModel(model(),'new.msq');view.setActive(true);await wait();
   const html=view.element.innerHTML;old.resolve(traces);await wait();assert(view.element.innerHTML===html,'Old completion overwrote resumed output');h.remove();
  });
 }
 await check('Analyzer page only routes context/calculation to the selected active domain',async()=>{
  const page=createAnalyzerPage(),h=host(page);h.append(page.headerControl);let reads=0;
  const ctx=context(async ids=>{reads++;return traces.filter(t=>ids.includes(t.channel.id))});page.setActive(false);page.setContext(ctx);page.setTuneModel(model(),'test.msq');page.refresh();await wait();assert(reads===0,'Inactive page loaded traces');
  page.setActive(true);await wait();assert(reads===1,'Comparison activation loaded hidden domains');
  assert(!page.element.querySelector('.ve-analyzer-view option[value="rpm"]')&&!page.element.querySelector('.ignition-behavior-analyzer-view option[value="rpm"]'),'Hidden context/tune was forwarded');
  const select=page.headerControl.querySelector('select');
  for(const value of ['tune-table','boost','idle','ae-map','fueling','ignition','fuel-injector','trigger-sync','ve','compare']){
   const before=reads;select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));await wait();const expected=value==='ve'?0:1;assert(reads-before===expected,`${value}: expected ${expected} loads, got ${reads-before}`);
  }
  page.setActive(false);const before=reads;page.setContext({...ctx,source:{...ctx.source,identity:{}}});page.setTuneModel(model(),'new.msq');page.refresh();await wait();assert(reads===before,'Inactive page forwarded updates');
  page.setActive(true);await wait();assert(reads===before+1,'Page resume loaded multiple domains');h.remove();
 });
 await check('comparison late rejection after deactivation is ignored',async()=>{
  const page=createAnalyzerPage(),h=host(page),old=deferred();page.setContext(context(async()=>old.promise));await wait();page.setActive(false);const html=page.element.innerHTML;old.reject(Error('old comparison failed'));await wait();assert(page.element.innerHTML===html,'Old comparison error changed inactive output');h.remove();
 });
 await check('VE keeps completed authority, defers hidden inputs and rejects pending analysis after leaving',async()=>{
  const view=createVeAnalyzerView(),h=host(view);let reads=0;const ctx=context(async ids=>{reads++;return traces.filter(t=>ids.includes(t.channel.id))});const tune=model();
  view.setActive(false);view.setContext(ctx);view.setTuneModel(tune,'ve.msq');await wait();assert(!view.element.querySelector('option[value="rpm"]')&&reads===0,'Hidden VE rebuilt inputs');view.setActive(true);await wait();change(view.element,'rpm','rpm');change(view.element,'load','map');change(view.element,'actual','afr');change(view.element,'fuelCommand','pw');await loadDelay(view);
  view.element.querySelector('.ve-workbench-run').click();await until(()=>!!view.getPrimaryAnalysis());const primary=view.getPrimaryAnalysis();assert(primary,'Missing VE primary result');view.setActive(false);view.setContext({...ctx});view.setTuneModel(tune,'ve.msq');view.setActive(true);await wait();assert(view.getPrimaryAnalysis()===primary&&reads===1,'Completed VE authority lost/recomputed on navigation');
  const old=deferred();view.setContext({...ctx,loadTraces:async()=>old.promise});view.element.querySelector('.ve-workbench-run').click();await wait();view.setActive(false);old.resolve(traces);await wait();assert(!view.getPrimaryAnalysis(),'Inactive VE analysis committed');view.setActive(true);await wait();assert(!view.getPrimaryAnalysis()&&view.element.querySelector('[data-ve-analyzer="stage"]').textContent.includes('cancelled'),'VE resume showed stale proposal instead of cancellation');h.remove();
 });
 for(const [name,create] of [['tune correlation',createTuneTableView],['ignition',createIgnitionAnalyzerView]])await check(`${name}: active tune replacement rejects an older read`,async()=>{
  const view=create(),h=host(view),old=deferred();let reads=0;
  view.setActive(false);view.setTuneModel(model(),'first.msq');view.setContext(context(async ids=>{reads++;return reads===1?old.promise:traces.filter(t=>ids.includes(t.channel.id))}));view.setActive(true);await wait();assert(reads===1,'Initial tune request missing');
  view.setTuneModel(model(),'replacement.msq');await wait();assert(reads===2,'Replacement did not start one new request');const html=view.element.innerHTML;old.reject(Error('obsolete tune read'));await wait();assert(view.element.innerHTML===html,'Obsolete rejection changed replacement tune state');h.remove();
 });
 await check('VE discovery/re-grab and delay-file completion cannot commit after leaving',async()=>{
  const view=createVeAnalyzerView(),h=host(view);let pending;
  const ctx=context(async ids=>pending?pending.promise:traces.filter(t=>ids.includes(t.channel.id)));
  view.setTuneModel(model(),'ve.msq');view.setContext(ctx);change(view.element,'rpm','rpm');change(view.element,'load','map');change(view.element,'actual','afr');change(view.element,'fuelCommand','pw');await loadDelay(view);
  pending=deferred();view.element.querySelector('[data-ve-analyzer="grab-delay"]').click();await wait();view.setActive(false);view.setActive(true);await wait();const html=view.element.innerHTML;pending.resolve(traces);await wait();assert(view.element.innerHTML===html,'Cancelled discovery/re-grab committed after return');
  const oldFile=deferred();const input=view.element.querySelector('[data-ve-analyzer="load-delay-file"]');Object.defineProperty(input,'files',{configurable:true,value:[{name:'old.json',text:()=>oldFile.promise}]});input.dispatchEvent(new Event('change',{bubbles:true}));view.setActive(false);view.setActive(true);await wait();const current=view.element.innerHTML;oldFile.resolve('invalid obsolete file');await wait();assert(view.element.innerHTML===current,'Old file completion/error changed resumed session');h.remove();
 });
 await check('inactive VE defers real source/tune replacement until activation',async()=>{
  const view=createVeAnalyzerView(),h=host(view),tune=model();const ctx=context(async ids=>traces.filter(t=>ids.includes(t.channel.id)));
  view.setContext(ctx);view.setTuneModel(tune,'old.msq');change(view.element,'rpm','rpm');change(view.element,'load','map');change(view.element,'actual','afr');await loadDelay(view);view.element.querySelector('.ve-workbench-run').click();await until(()=>!!view.getPrimaryAnalysis());assert(view.getPrimaryAnalysis(),'Initial result missing');
  view.setActive(false);const html=view.element.innerHTML;view.setContext({...ctx,source:{...ctx.source,identity:{}}});view.setTuneModel(model(),'replacement.msq');await wait();assert(view.element.innerHTML===html,'Hidden replacement rebuilt VE');view.setActive(true);await wait();assert(!view.getPrimaryAnalysis()&&view.element.querySelector('[data-ve-analyzer="save-delay"]').disabled,'Old VE authority survived real replacement');h.remove();
 });
 await check('comparison A/B navigation issues one request and unrelated tune changes do not recalculate',async()=>{
  const page=createAnalyzerPage(),h=host(page);let reads=0;page.setContext(context(async ids=>{reads++;return traces.filter(t=>ids.includes(t.channel.id))}));await wait();const before=reads;page.openRangeCompareScope('ab');await wait();assert(reads===before+1,'A/B navigation issued duplicate requests');page.setTuneModel(model(),'unrelated.msq');page.refresh();await wait();assert(reads===before+1,'Tune-independent comparison recalculated on tune load');h.remove();
 });
 await check('unchanged page context does not cancel an active pending VE run',async()=>{
  const page=createAnalyzerPage(),h=host(page);h.append(page.headerControl);const old=deferred();let reads=0;const ctx=context(async()=>{reads++;return old.promise});const tune=model();
  page.setActive(false);const select=page.headerControl.querySelector('select');select.value='ve';select.dispatchEvent(new Event('change',{bubbles:true}));page.setContext(ctx);page.setTuneModel(tune,'ve.msq');page.setActive(true);await wait();
  const root=page.element.querySelector('.ve-analyzer-view');change(root,'rpm','rpm');change(root,'load','map');change(root,'actual','afr');await loadDelay({element:root});root.querySelector('.ve-workbench-run').click();await wait();assert(reads===1,'VE request missing');
  page.setContext({...ctx,openSamplesInLogger:()=>{}});old.resolve(traces);await until(()=>[...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].some(cell=>cell.title.startsWith('Measured proposal')));assert([...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].some(cell=>cell.title.startsWith('Measured proposal'))&&reads===1,'Unchanged active page context cancelled/restarted VE');h.remove();
 });
 await check('page tune-only update starts one new active correlation request',async()=>{
  const page=createAnalyzerPage(),h=host(page);h.append(page.headerControl);const old=deferred();let reads=0;
  page.setActive(false);const select=page.headerControl.querySelector('select');select.value='tune-table';select.dispatchEvent(new Event('change',{bubbles:true}));page.setTuneModel(model(),'first.msq');page.setContext(context(async ids=>{reads++;return reads===1?old.promise:traces.filter(t=>ids.includes(t.channel.id))}));page.setActive(true);await wait();assert(reads===1,'Initial correlation request missing');
  page.setTuneModel(model(),'second.msq');await wait();assert(reads===2,'Tune-only update duplicated context/calculation');const html=page.element.innerHTML;old.reject(Error('old page tune request'));await wait();assert(page.element.innerHTML===html,'Old tune failure affected the page');h.remove();
 });
 return {passed:passed.length,checks:passed};
}
