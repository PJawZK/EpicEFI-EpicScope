import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { installVeAnalyzerUiRefinements } from '../../apps/web/src/app/ve-analyzer-ui-refinements';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const settle=async()=>{await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));};
export async function runVeCellEvidenceReleaseChecks(){
 const checks=[];
 for(const afr of [15,13]){
  const channels=[['rpm','RPM','rpm'],['map','MAP','kPa'],['afr','AFR','AFR'],['pw','PW','ms']].map(([id,sourceName,unit])=>({id,sourceName,displayName:sourceName,unit,valueType:'number'}));
  const traces=channels.map((channel,i)=>({channel,complete:true,range:{startSampleIndex:0,timeMs:Float64Array.from({length:60},(_,j)=>j*100),values:new Float64Array(60).fill([1000,50,afr,4][i]),validity:new Uint8Array(60).fill(1)}}));
  const s=await setupVeLifecycleFixture(undefined,{channels,traces});
  const shell=document.createElement('section'),domain=document.createElement('select');domain.className='analyzer-header-view-select';domain.append(new Option('VE','ve'));shell.append(domain,s.host);document.body.append(shell);installVeAnalyzerUiRefinements(shell);s.root.hidden=false;
  try{
   s.run();const end=performance.now()+10000;while(s.view.getReadiness().pending){assert(performance.now()<end,'Analysis did not finish');await settle();}
   const primary=s.view.getPrimaryAnalysis();assert(primary,'Missing primary');s.root.querySelector('.ve-v50-completion-x').click();
   const cell=s.root.querySelector('td[data-ve-row="0"][data-ve-col="0"]'),panel=s.host.querySelector('.ve-cell-detail-popover'),reads=s.reads(),revision=s.view.sessionRevision;
   assert(primary.proposal.cells[0].state==='measured','Fixture needs a generated change');
   cell.setPointerCapture=()=>{};
   cell.dispatchEvent(new PointerEvent('pointerdown',{pointerId:12,pointerType:'mouse',bubbles:true,cancelable:true}));
   await settle();cell.dispatchEvent(new PointerEvent('pointerup',{pointerId:12,pointerType:'mouse',bubbles:true,cancelable:true}));cell.click();await settle();
   assert(!panel||panel.hidden,'Default cell selection opened evidence while toggle is off');
   const toggle=s.root.querySelector('.ve-v50-table-header button[aria-label="Cell Evidence"]')??s.root.querySelector('.ve-v50-table-icon-button[aria-label="Cell Evidence"]');toggle.click();await settle();
   assert(!panel.hidden&&panel.querySelector('.ve-evidence-detail-grid')&&panel.querySelectorAll('.ve-evidence-detail-metric').length>=18,'Mouse release replaced structured evidence with tooltip text');
   const grid=panel.querySelector('.ve-evidence-detail-grid');
   cell.click();await settle();assert(panel.querySelector('.ve-evidence-detail-grid')===grid,'Repeated click rebuilt cached evidence');
   cell.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await settle();assert(panel.querySelector('.ve-evidence-detail-grid')===grid,'Keyboard activation replaced structured evidence');
   const editor=s.root.querySelector('.ve-table-inline-input');assert(editor,'Enter no longer starts the existing cell editor');editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));await settle();
   checks.push(`AFR ${afr}: changed-cell release/repeated click/keyboard preserve structured cached evidence`);
   const direction=afr>14?'higher':'lower',color=afr>14?'rgb(255, 125, 131)':'rgb(115, 191, 255)';
   assert(cell.dataset.tableValueState===direction&&getComputedStyle(cell).color===color,'Generated VE change lacks original-tune direction color');
   const owner=veProposalEditOwner(s.root),baseline=owner.snapshot().baselineValues[0];
   assert(baseline!==70,'Generated baseline must differ from original');
   owner.applyValues([{row:0,col:0,value:70}]);await settle();assert(cell.dataset.tableValueState==='same','Restored original value remains colored');
   owner.applyValues([{row:0,col:0,value:afr>14?60:80}]);await settle();assert(cell.dataset.tableValueState===(afr>14?'lower':'higher'),'Manual working edit did not reverse direction');
   owner.revert([{row:0,col:0}]);await settle();assert(owner.snapshot().values[0]===baseline&&cell.dataset.tableValueState===direction,'Revert baseline was changed to original tune');
   const result=s.root.querySelector('select[aria-label="VE Analyzer result view"]');
   result.value='samples';result.dispatchEvent(new Event('change',{bubbles:true}));await settle();
   assert(getComputedStyle(cell).color!==color,'Read-only sample count inherited working VE direction color');
   cell.click();cell.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await settle();
   assert(panel.querySelector('.ve-evidence-detail-grid')===grid&&!s.root.querySelector('.ve-table-inline-input'),'Read-only evidence activation rebuilt detail or started editing');
   result.value='proposal';result.dispatchEvent(new Event('change',{bubbles:true}));await settle();
   assert(cell.dataset.tableValueState===direction&&getComputedStyle(cell).color===color,'Result View round trip lost working direction color');
   assert(s.view.getPrimaryAnalysis()===primary&&s.reads()===reads&&s.view.sessionRevision===revision,'Presentation changed numerical authority or re-read traces');
   checks.push(`AFR ${afr}: generated/edit/revert colors use original tune while review baseline and primary stay retained`);
   const other=s.root.querySelector('td[data-ve-row="1"][data-ve-col="1"]');other.click();await settle();assert(!panel.hidden&&panel.querySelector('.ve-evidence-detail-grid'),'Unaffected cell lost structured evidence');
   toggle.click();cell.click();await settle();assert(panel.hidden&&toggle.getAttribute('aria-pressed')==='false','Disabled inspector reopened on selection');
   toggle.click();await settle();assert(!panel.hidden&&toggle.getAttribute('aria-pressed')==='true','Re-enabled inspector did not reopen selected evidence');
   panel.querySelector('header button').click();assert(toggle.getAttribute('aria-pressed')==='false','Close did not disable inspector');
   const brush=s.root.querySelector('.ve-proposal-shared-toolbar button[aria-label="Continuous brush editing"]');brush.click();cell.click();await settle();assert(panel.hidden,'Brush click opened evidence');brush.click();
   cell.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));const draft=s.root.querySelector('.ve-table-inline-input');assert(draft,'Missing edit draft');draft.click();await settle();assert(panel.hidden,'Editor click opened evidence');draft.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
   assert(s.reads()===reads,'Evidence selection loaded traces');checks.push(`AFR ${afr}: unaffected cells share the structured owner without trace reads`);
  }finally{s.view.dispose();shell.remove();}
 }
 return{passed:checks.length,checks};
}
