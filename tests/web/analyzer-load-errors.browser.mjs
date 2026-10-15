// Real-browser regression module. Import through Vite and await runAnalyzerActivityChecks().
import { createAnalyzerPage } from '../../apps/web/src/pages/analyzer-page';
import { createTuneTableView } from '../../apps/web/src/pages/tune-table-view';
import { createBoostAnalyzerView } from '../../apps/web/src/pages/boost-analyzer-view';
import { createSpecializedAnalyzerSuiteView } from '../../apps/web/src/pages/specialized-analyzer-suite-view';
import { createIgnitionAnalyzerView } from '../../apps/web/src/pages/ignition-analyzer-view';
import { createFuelInjectorAnalyzerView } from '../../apps/web/src/pages/fuel-injector-analyzer-view';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
const channels = [
 ['rpm','RPM','rpm',1500],['map','MAP','kPa',70],['afr','AFRValue','AFR',15],['pw','PW','ms',4],
 ['idleTarget','Idle target','rpm',900],['advance','Ignition advance','deg',25],['tps','TPS','%',20],['clt','CLT','C',90],['sync','Sync state','',1],
].map(([id,sourceName,unit,value])=>({id,sourceName,displayName:sourceName,unit,value,valueType:'number'}));
const traces=channels.map(channel=>({channel,color:'#abc',complete:true,range:{startSampleIndex:0,timeMs:Float64Array.from({length:60},(_,i)=>100*i),values:new Float64Array(60).fill(channel.value),validity:new Uint8Array(60).fill(1)}}));
const model=()=>normalizeMsqTune(parseMsq('<msq><page><constant name="veTable" rows="2" cols="2">70 70 70 70</constant><constant name="veRpmBins" rows="1" cols="2">1000 2000</constant><constant name="veLoadBins" rows="2" cols="1">50 100</constant><constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant><constant name="afrLoadBins" rows="2" cols="1">50 100</constant><constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant><constant name="ignitionTable" rows="2" cols="2" units="deg">20 20 20 20</constant></page></msq>'));
const context=loadTraces=>({source:{identity:{},sampleCount:60,revision:0},channels,traces:[],loadTraces,aTimeMs:0,bTimeMs:3000,savedRanges:[]});
const wait=async()=>{await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));};
function assert(ok,message){if(!ok)throw Error(message);}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};}
function host(view){const h=document.createElement('section');h.append(view.element);document.body.append(h);return h;}
const factories=[
 ['comparison',createAnalyzerPage,'.analyzer-empty','.analyzer-content','.analyzer-refresh'],
 ['tune',createTuneTableView,'.tune-table-empty','.tune-table-content','.tune-table-refresh'],
 ['boost',createBoostAnalyzerView,'.boost-analyzer-empty','.boost-analyzer-content','.boost-refresh'],
 ['fuel pressure',createFuelInjectorAnalyzerView,'.specialized-analyzer-empty','.specialized-analyzer-content',null],
 ['ignition',createIgnitionAnalyzerView,'.specialized-analyzer-empty','.specialized-analyzer-content',null],
 ['suite',createSpecializedAnalyzerSuiteView,'.specialized-analyzer-empty','.specialized-analyzer-content',null],
];
async function setup(spec,loader){
 const [name,create,emptySelector,contentSelector,buttonSelector]=spec;
 const view=create(),h=host(view);h.style.cssText='position:fixed;inset:0;z-index:9999';view.element.hidden=false;view.element.style.cssText='height:100%;width:100%';if(view.headerControl)h.append(view.headerControl);
 view.setActive(false);const ctx=context(loader);view.setContext(ctx);if(view.setDomain)view.setDomain('fueling');if(view.setTuneModel)view.setTuneModel(model(),'fixture.msq');view.setActive(true);await wait();
 const empty=view.element.querySelector(emptySelector),content=view.element.querySelector(contentSelector);
 const button=buttonSelector?view.element.querySelector(buttonSelector):[...view.element.querySelectorAll('.specialized-analyzer-controls button')].find(b=>b.textContent==='Analyze');
 assert(button,'Missing retry control for '+name);
 return {view,h,ctx,empty,content,button};
}
export async function runAnalyzerLoadErrorChecks(){
 const passed=[];const check=async(name,run)=>{await run();passed.push(name);};
 for(const spec of factories){const name=spec[0];
  for(const failure of [new Error('Browser fixture read failed <b>detail</b>'),'Decode fixture failed',undefined])await check(`${name}: current ${failure instanceof Error?'Error':typeof failure} rejection hides stale output and recovers through the visible retry control`,async()=>{
   let failing=false,reads=0;
   const s=await setup(spec,async ids=>{reads++;if(failing)throw failure;return traces.filter(t=>ids.includes(t.channel.id));});
   assert(!s.content.hidden,'No baseline result in '+name);const good=s.content.textContent;failing=true;const before=reads;s.button.click();await wait();
   assert(reads===before+1,'Duplicate/missing retry request');assert(!s.empty.hidden&&s.content.hidden,'Failed read left stale content visible');assert(s.empty.getBoundingClientRect().width>0&&s.empty.getBoundingClientRect().height>0,'Error area is not rendered');
   assert(s.empty.querySelector('strong').textContent.includes('could not load log channels'),'Missing load error title');
   const message=s.empty.querySelector('span');assert(message.textContent.includes('Retry with')&&!message.querySelector('b'),'Missing retry hint or error interpreted as HTML');
   assert(message.textContent.includes(failure instanceof Error?failure.message:typeof failure==='string'?failure:'The log data could not be loaded.'),'Missing current failure detail/fallback');
   assert(!s.button.disabled,'Retry is disabled after read failure');failing=false;s.button.click();await wait();
   assert(s.empty.hidden&&!s.content.hidden&&s.content.textContent===good,'Retry did not recover same result');s.view.setActive(false);s.h.remove();
  });
  await check(`${name}: an older rejection cannot overwrite a newer successful request`,async()=>{
   let pending;const s=await setup(spec,async ids=>pending?pending.promise:traces.filter(t=>ids.includes(t.channel.id)));
   pending=deferred();const old=pending;s.button.click();await wait();pending=undefined;s.button.click();await wait();const html=s.view.element.innerHTML;old.reject(Error('obsolete read failed'));await wait();assert(s.view.element.innerHTML===html&&!s.content.hidden,'Obsolete rejection replaced a newer result');s.view.setActive(false);s.h.remove();
  });
  await check(`${name}: a newer error cannot be cleared by an older successful request`,async()=>{
   let pending,fail=false;const s=await setup(spec,async ids=>{if(pending)return pending.promise;if(fail)throw Error('new current failure');return traces.filter(t=>ids.includes(t.channel.id));});
   pending=deferred();const old=pending;s.button.click();await wait();pending=undefined;fail=true;s.button.click();await wait();const html=s.view.element.innerHTML;old.resolve(traces);await wait();assert(s.view.element.innerHTML===html&&s.content.hidden&&s.empty.textContent.includes('new current failure'),'Old success erased current error');s.view.setActive(false);s.h.remove();
  });
  await check(`${name}: hidden rejection is ignored and reactivation can recover`,async()=>{
   let pending;const s=await setup(spec,async ids=>pending?pending.promise:traces.filter(t=>ids.includes(t.channel.id)));
   pending=deferred();const old=pending;s.button.click();await wait();s.view.setActive(false);const html=s.view.element.innerHTML;old.reject(Error('hidden read failed'));await wait();assert(s.view.element.innerHTML===html,'Hidden error mutated view');pending=undefined;s.view.setActive(true);await wait();assert(!s.content.hidden,'Resume failed to recover');s.view.setActive(false);s.h.remove();
  });
  await check(`${name}: missing inputs after a failure restore setup guidance`,async()=>{
   const s=await setup(spec,async()=>{throw Error('old storage failure');});assert(!s.empty.hidden,'Missing fixture failure');
   s.view.setContext({...s.ctx,source:undefined,channels:[],traces:[]});await wait();assert(!s.empty.textContent.includes('old storage failure')&&!s.empty.querySelector('strong').textContent.includes('could not load'),'Old failure leaked into a new setup');s.view.setActive(false);s.h.remove();
  });
 }
 return {passed:passed.length,checks:passed};
}
