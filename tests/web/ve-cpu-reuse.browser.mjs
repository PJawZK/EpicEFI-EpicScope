import { strongestVeEvidenceVisit } from '../../apps/web/src/pages/ve-analyzer-cell-evidence';
import { applyVeQualificationValidityBatch, applyVeQualificationValidity } from '../../apps/web/src/pages/ve-analyzer-qualification';
import { analyzeAfrDelay } from '../../core/analysis/afr-delay-analyzer';
import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const count = 320459;
const range = (values, startSampleIndex = 0) => ({startSampleIndex, values:Float64Array.from({length:count},(_,i)=>typeof values === 'function'?values(i):values),timeMs:Float64Array.from({length:count},(_,i)=>i*10),validity:new Uint8Array(count).fill(1)});
export async function runVeCpuReuseChecks() {
 const checks=[];
 const indices=Uint32Array.from({length:count},(_,i)=>i);
 const continuous=strongestVeEvidenceVisit(indices,i=>i===1000?-500:i*10);
 assert(continuous.sampleIndices.length===count && continuous.durationMs===(count-1)*10+500 && continuous.timeMs[1000]===-500,'Large continuous visit lost full-range extrema/data');
 const fragmented=strongestVeEvidenceVisit(Uint32Array.from(indices,i=>i*2),i=>i===0?undefined:i*10);
 assert(fragmented.sampleIndices.length===1 && fragmented.startSampleIndex===2,'Fragmented visit lost earliest timestamped tie');
 const source=Uint32Array.from([9,3,2,2,1]);
 assert(strongestVeEvidenceVisit(source,i=>i).sampleIndices.join(',')==='1,2,2,3' && source[0]===9,'Visit normalization mutated input or discarded duplicates');
 checks.push('320459-sample visits preserve extrema, fragmented ties, duplicate semantics and caller ownership');

 const clt=range(i=>i%101===0?60:85),tps=range(i=>i%23===0?95:35),sample=range(1000);
 const ranges=Array.from({length:12},(_,i)=>{const validity=new Uint8Array(sample.validity);validity[i]=0;return{...sample,validity};});
 const settings={minimumClt:70,maximumTps:90};
 const output=applyVeQualificationValidityBatch(ranges,settings,clt,tps);
 for(let i=0;i<ranges.length;i++){
  const expected=applyVeQualificationValidity(ranges[i],settings,clt,tps);
  assert(output[i].validity.every((v,j)=>v===expected.validity[j]) && output[i].validity!==ranges[i].validity && ranges[i].validity[i]===0,'Batch qualification changed independent trace validity');
 }
 assert(applyVeQualificationValidityBatch(ranges,{})===ranges,'Disabled qualification lost its no-op path');
 checks.push('Twelve aligned large traces share qualification without changing their independent validity, source buffers or no-op behavior');

 const command=range(i=>Math.floor(i/100)%2?5:4),actual=range(i=>Math.floor(Math.max(0,i-2)/100)%2?14:15);
 const input={fuelCommand:command,actualAfr:actual};
 const config={commandDeltaThreshold:0.5,afrResponseThreshold:0.2,searchWindowMs:500,minimumEventSpacingMs:250};
 const full=analyzeAfrDelay(input,config),ordered=analyzeAfrDelay(input,config,indices);
 assert(full.usableEventCount===3204 && ordered.usableEventCount===full.usableEventCount && JSON.stringify(full.onsetDelay)===JSON.stringify(ordered.onsetDelay),'Large discovery fast paths changed event count/distribution');
 const reversed=Array.from(indices).reverse();reversed.push(2,2,NaN,1.5);
 const messy=analyzeAfrDelay(input,config,reversed);
 assert(messy.usableEventCount===full.usableEventCount && messy.events.at(-1).commandSampleIndex===full.events.at(-1).commandSampleIndex && reversed[0]===count-1,'Discovery fallback changed normalization/caller input');
 checks.push('Large default/ordered discovery and unsorted duplicate fallback preserve event evidence and distributions');

 const channels=[['rpm','RPM','rpm'],['map','MAP','kPa'],['afr','AFR','AFR'],['pw','PW','ms'],['clt','CLT','C'],['tps','TPS','%']].map(([id,sourceName,unit])=>({id,sourceName,displayName:sourceName,unit,valueType:'number'}));
 const values=[sample,range(50),range(15),range(4),clt,tps];
 const traces=channels.map((channel,i)=>({channel,range:values[i],complete:true,color:'#abc'}));
 const originals=values.map(r=>r.validity.slice());
 const s=await setupVeLifecycleFixture(undefined,{channels,traces,sampleCount:count});s.root.hidden=false;
 try{
  for(const [selector,value]of [['[data-ve-quick="clt-source"]','clt'],['[data-ve-quick="min-clt"]','70'],['[data-ve-quick="tps-source"]','tps'],['[data-ve-quick="max-tps"]','90'],['[data-role="stable-ms"]','0']]){
   const control=s.root.querySelector(selector);control.value=value;control.dispatchEvent(new Event('change',{bubbles:true}));
  }
  assert(s.view.getReadiness().canRun,'Qualified production fixture not ready');
  s.run();const deadline=performance.now()+60000;
  while(!s.view.getPrimaryAnalysis()){assert(performance.now()<deadline,'Large qualified run timed out');await settle();}
  const primary=s.view.getPrimaryAnalysis(),samples=primary.evidence.cells[0].sampleIndices;
  assert(samples.length>100000 && samples.every(i=>clt.values[i]>=70 && tps.values[i]<=90),'Production wrapped loader skipped qualification or returned bad sample identity');
  assert(values.every((r,i)=>r.validity.every((v,j)=>v===originals[i][j])) && s.reads()===1,'Qualification mutated source ranges or repeated source reads');
  const cell=s.root.querySelector('[data-ve-analyzer="ve-table-view"] td[data-ve-row="0"][data-ve-col="0"]');
  for(let i=0;i<2;i++)s.root.dispatchEvent(new CustomEvent('ve-cell-evidence-open',{detail:{cell}}));
  s.view.refresh();
  assert(s.view.getPrimaryAnalysis()===primary && s.reads()===1 && !s.host.querySelector('.ve-cell-detail-popover').hidden,'Popup/reuse withdrew authority or reread cached data');
  checks.push('Production large qualified load publishes only accepted samples, preserves source validity and reuses primary/popup authority with one source read');
 }finally{s.view.dispose();s.host.remove();}
 return{passed:checks.length,checks};
}
