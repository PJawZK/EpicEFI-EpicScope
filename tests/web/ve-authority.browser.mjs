import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const settle=async()=>{for(let i=0;i<2;i++)await new Promise(r=>setTimeout(r,0));};
const change=(node,value)=>{node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));};
export async function runVeAuthorityChecks(){
 const checks=[];
 const channels=[['rpm','RPM','rpm'],['map','MAP','kPa'],['afr','AFR','AFR'],['pw','PW','ms'],['trim','stftCorrection1','%']].map(([id,sourceName,unit])=>({id,sourceName,displayName:sourceName,unit,valueType:'number'}));
 const traces=channels.map((channel,index)=>({channel,complete:true,color:'#58aef6',range:{startSampleIndex:0,timeMs:Float64Array.from({length:60},(_,i)=>i*100),values:new Float64Array(60).fill([1000,50,14,4,5][index]),validity:new Uint8Array(60).fill(1)}}));
 const s=await setupVeLifecycleFixture(undefined,{channels,traces});s.root.hidden=false;
 const result=s.root.querySelector('select[aria-label="VE Analyzer result view"]');
 const open=()=>s.root.dispatchEvent(new CustomEvent('ve-cell-evidence-open',{detail:{cell:s.root.querySelector('td[data-ve-row="0"][data-ve-col="0"]')}}));
 const panel=()=>s.host.querySelector('.ve-cell-detail-popover');
 const metric=label=>[...panel().querySelectorAll('.ve-evidence-detail-metric')].find(n=>n.firstElementChild.textContent===label)?.lastElementChild.textContent;
 const complete=async()=>{s.run();const end=performance.now()+10000;while(!s.view.getPrimaryAnalysis()||s.view.getReadiness().pending){assert(performance.now()<end,'Authority fixture timed out');await settle();}};
 try{
  change(s.root.querySelector('[data-role="stft"]'),'trim');change(s.root.querySelector('[data-role="fuel-correction-mode"]'),'percent');await complete();
  const primary=s.view.getPrimaryAnalysis(),reads=s.reads(),revision=s.view.sessionRevision,generated=primary.proposal.cells[0].proposedValue;
  open();await settle();
  assert(Math.abs(primary.evidence.cells[0].correctionPercent-5)<1e-9,'On-target +5% applied-trim fixture is wrong');
  assert(metric('Base-VE correction')==='+5%'&&metric('Correction basis').includes('applied fuel trim'),'Popup disguises compensated correction as raw mixture error');
  assert([...result.options].find(o=>o.value==='mixture-error').textContent==='Base-VE correction %','Result View has misleading mixture-error label');
  checks.push('On-target mixture with +5% applied trim is explicitly labeled as base-VE correction, with owner-derived basis');
  change(result,'samples');await settle();
  const empty=s.root.querySelector('td[data-ve-row="1"][data-ve-col="1"] > span');
  assert(empty.textContent==='70'&&empty.title.includes('original VE'),'Missing metric fallback disguises source VE as metric units');
  checks.push('Missing metric fallback retains original VE and explicitly identifies its source rather than implying sample/percent units');
  change(result,'proposal');await settle();
  const grid=panel().querySelector('.ve-evidence-detail-grid'),owner=veProposalEditOwner(s.root),proposalBytes=JSON.stringify(primary.proposal);
  owner.applyValues([{row:0,col:0,value:123.456}]);await settle();
  assert(metric('Working VE')==='123.46'&&metric('Working change')==='+53.46','Open popup failed to project the current working owner against original tune');
  assert(metric('Generated proposed VE')===generated.toFixed(2).replace(/0+$/,'').replace(/\.$/,''),'Generated proposal was replaced by working edits');
  assert(panel().querySelector('.ve-evidence-detail-grid')===grid&&s.view.getPrimaryAnalysis()===primary&&JSON.stringify(primary.proposal)===proposalBytes,'Working projection rebuilt evidence or mutated primary');
  checks.push('Open cached evidence patches working review values while retaining original/generated authorities and DOM');
  for(const option of result.options){change(result,option.value);await settle();open();await settle();assert(panel().querySelector('.ve-evidence-detail-grid')===grid,'Result View invalidated cached detail');}
  owner.applyValues([{row:0,col:0,value:undefined}]);await settle();assert(metric('Working VE')==='—'&&metric('Working change')==='—','Cleared working value silently fell back to generated/source');
  owner.applyValues([{row:0,col:0,value:0}]);await settle();assert(metric('Working VE')==='0'&&metric('Working change')==='-70','Zero working value treated as absent');
  assert(s.reads()===reads&&s.view.sessionRevision===revision&&s.model.byName.get('veTable').numericValues[0]===70,'Presentation loaded traces, invalidated analysis or changed original tune');
  checks.push('All Result Views, cleared/zero working cells and cached popup reuse preserve source, generation and trace-read count');
  change(s.root.querySelector('[data-role="max-absolute-change"]'),'0');await complete();open();await settle();
  assert(s.view.getPrimaryAnalysis()!==primary&&panel().querySelector('.ve-evidence-detail-grid')!==grid,'Semantic invalidation reused old evidence');
  assert(metric('Generated proposed VE')==='—'&&metric('Raw evidence candidate')==='73.5'&&metric('Proposal state')==='withheld-limit','Withheld raw candidate presented as an accepted proposal');
  assert(metric('Analysis change basis').includes('raw candidate')&&metric('Analysis VE change')==='+3.5'&&metric('Working VE')==='70'&&metric('Working change')==='0','Withheld analysis change or working fallback has the wrong authority');
  checks.push('Real parameter changes retire cache; withheld candidate, generated proposal and working fallback stay explicit');
 }finally{s.view.dispose();s.host.remove();}
 return{passed:checks.length,checks};
}
