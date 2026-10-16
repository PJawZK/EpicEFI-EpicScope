// Real Chromium checks: presentation must be committed by each component owner.
import { createAnalyzerPage } from '../../apps/web/src/pages/analyzer-page';
import { createTuneTableView } from '../../apps/web/src/pages/tune-table-view';
import { createBoostAnalyzerView } from '../../apps/web/src/pages/boost-analyzer-view';
import { createSpecializedAnalyzerSuiteView } from '../../apps/web/src/pages/specialized-analyzer-suite-view';
import { createHistogramTableGeneratorView } from '../../apps/web/src/pages/histogram-table-generator-view';
import { createVeAnalyzerView } from '../../apps/web/src/pages/ve-analyzer-view';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
const channels = [
 ['rpm','RPM','rpm',900],['map','MAP','kPa',70],['afr','AFRValue','AFR',15],['target','Target AFR','AFR',14],['pw','PW','ms',4],
 ['idleTarget','Idle target','rpm',900],['advance','Ignition advance','deg',25],['tps','TPS','%',20],['clt','CLT','C',90],['sync','Sync state','',1],
].map(([id,sourceName,unit,value])=>({id,sourceName,displayName:sourceName,unit,value,valueType:'number'}));
const traces=channels.map(channel=>({channel,color:'#abc',complete:true,range:{startSampleIndex:0,timeMs:Float64Array.from({length:60},(_,i)=>100*i),values:new Float64Array(60).fill(channel.value),validity:new Uint8Array(60).fill(1)}}));
const settle=async()=>{await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));};
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const helpFor=(root,text)=>[...root.querySelectorAll('label > span')].find(n=>n.childNodes[0]?.textContent?.trim()===text)?.querySelector('.epicscope-inline-help');
export async function runPresentationOwnershipChecks(){
 const checks=[], views=[];
 const host=document.createElement('section');document.querySelector('#app').append(host);
 const attach=view=>{views.push(view);host.append(view.element);view.element.hidden=false;return view;};
 const record=(name,test)=>{test();checks.push(name);};
 let loads=0;
 const context={source:{identity:{},sampleCount:60,revision:0},channels,traces:[],loadTraces:async ids=>{loads++;return traces.filter(t=>ids.includes(t.channel.id));},aTimeMs:0,bTimeMs:3000,savedRanges:[]};
 try {
  const compare=attach(createAnalyzerPage()),tune=attach(createTuneTableView()),boost=attach(createBoostAnalyzerView());
  record('Compare/Tune/Boost owners attach help and icon styling synchronously without an application installer',()=>{
   assert(helpFor(compare.element,'Channel'),'Compare help missing before mutation delivery');
   assert(tune.element.querySelector('.epicscope-inline-help.epicscope-info-icon'),'Tune help/icon missing');
   assert(boost.element.querySelector('.boost-result-section > header .epicscope-inline-help'),'Boost section help missing');
  });
  record('Boost owns sortable headers, disclosure controls and initial pressure-rise feedback',()=>{
   assert(boost.element.querySelector('.boost-operating-table th[tabindex="0"][aria-sort]'),'Sort headers missing');
   assert(boost.element.querySelector('.analyzer-columns-toggle'),'Column disclosure missing');
   assert(boost.element.querySelector('[data-boost-empty-state="true"]'),'Pressure-rise empty feedback missing');
  });
  const suite=attach(createSpecializedAnalyzerSuiteView());suite.setContext(context);
  record('Idle controls receive help at construction and advanced options start collapsed',()=>{
   assert(helpFor(suite.element,'Idle system')&&helpFor(suite.element,'RPM · Engine'),'Idle rebuilt controls lack help');
   assert(!suite.element.querySelector('.specialized-analyzer-options').open,'Advanced options were not collapsed');
  });
  await settle();
  record('Idle summary receives help and disclosure; help opens its existing accessible popover',()=>{
   const summary=suite.element.querySelector('.specialized-analyzer-summary');
   const button=summary.querySelector('.epicscope-inline-help');
   assert(button&&suite.element.querySelector('.analyzer-summary-toggle'),'Idle summary help/disclosure missing');
   button.click();
   assert(button.getAttribute('aria-expanded')==='true','Help did not open');
   assert(document.querySelector('#epicscope-inline-help-popover:not([hidden])'),'Help popover missing');
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  });
  const options=suite.element.querySelector('.specialized-analyzer-options');options.open=true;
  suite.refresh();await settle();
  record('User-expanded advanced options survive result refresh without duplicate help/toggles',()=>{
   assert(options.open,'Refresh collapsed user disclosure');
   assert(suite.element.querySelectorAll('.analyzer-summary-toggle').length===1,'Duplicate summary toggle');
   for(const span of suite.element.querySelectorAll('label > span'))assert(span.querySelectorAll(':scope > .epicscope-inline-help').length<=1,'Duplicate control help');
  });
  suite.setDomain('ae-map');
  record('Changing suite domain immediately decorates replacement controls and clears Idle-only header help',()=>{
   assert(helpFor(suite.element,'TPS'),'AE controls lack help');
   assert(!suite.element.querySelector('.specialized-analyzer-evidence > header > div > .epicscope-inline-help'),'Idle header help leaked into AE');
   assert(!suite.element.querySelector('canvas').title,'Idle canvas tooltip leaked into AE');
  });
  await settle();
  suite.setDomain('fueling');await settle();
  record('Fueling result retains coverage feedback, sortable map and column disclosures',()=>{
   const table=suite.element.querySelector('.specialized-analyzer-map-table');
   assert(table.classList.contains('analyzer-sortable-table'),'Fueling sorting missing');
   assert(suite.element.querySelector('.analyzer-columns-toggle'),'Fueling columns missing');
   assert(suite.element.querySelector('.specialized-analyzer-summary .epicscope-inline-help'),'Fueling summary help missing');
   const header=table.querySelector('thead th');header.click();
   assert(header.getAttribute('aria-sort')==='ascending','Mouse sort failed');
   header.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
   assert(header.getAttribute('aria-sort')==='descending','Keyboard sort failed');
  });
  const histogram=attach(createHistogramTableGeneratorView());
  record('Histogram owner constructs final aggregation/scope wording immediately',()=>{
   const root=histogram.element;
   assert(root.querySelector('option[value="weighted-mean"]').textContent==='Weighted Mean','Aggregation needs external rewriting');
   assert(root.querySelector('.histogram-table-scope option[value="ab"]').textContent==='Current A/B','A/B label incorrect');
   assert(root.querySelector('.histogram-table-scope option[value="full"]').textContent==='Full Log','Full label incorrect');
  });
  const ve=attach(createVeAnalyzerView());
  ve.setTuneModel(normalizeMsqTune(parseMsq('<msq><page><constant name="veRpmBins" rows="1" cols="2">1000 2000</constant><constant name="veLoadBins" rows="2" cols="1">50 100</constant><constant name="veTable" rows="2" cols="2">60 70 80 90</constant></page></msq>')),'presentation.msq');
  record('VE table owner commits lower-left load orientation before observers run',()=>{
   const table=ve.element.querySelector('[data-ve-analyzer="ve-table-view"] table');
   assert(table&&table.dataset.veLoadOrigin==='lower-left','VE orientation not committed');
   assert(table.tBodies[0].rows[0].cells[0].textContent==='100','VE first row is not highest load');
   assert(table.tBodies[0].rows[0].cells[1].textContent==='80','VE coordinates changed during orientation');
  });
  const graph=document.querySelector('.graph-selector-button > span');
  record('Logger owns graph suffix labels without changing workspace identity',()=>{
   assert(/ - Graph$/.test(graph.textContent),'Graph label missing suffix');
   for(const label of document.querySelectorAll('.graph-selector-choice > span'))assert(/ - Graph$/.test(label.textContent),'Graph choice label missing suffix');
  });
  const decoy=document.createElement('section');decoy.className='specialized-analyzer-view';
  decoy.innerHTML='<strong data-specialized="title">AE / MAP Predict · Experimental</strong><div class="specialized-analyzer-controls"><label><span>TPS</span><select></select></label></div><details class="specialized-analyzer-options" open><summary>Analysis thresholds</summary></details>';
  host.append(decoy);const html=decoy.innerHTML,reads=loads;await settle();
  record('Unowned/unrelated DOM changes cause no application-wide help or hierarchy decoration',()=>{
   assert(decoy.innerHTML===html,'An application observer decorated unrelated markup');
   assert(loads===reads,'Unrelated DOM change triggered analysis');
  });
  return {passed:checks.length,checks};
 } finally {for(const view of views)view.setActive?.(false);host.remove();}
}
