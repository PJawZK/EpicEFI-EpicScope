import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
import { parseMsq } from '../../core/parsers/msq/msq-parser';
import { normalizeMsqTune } from '../../core/tune/tune-model';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => { await new Promise(r => setTimeout(r,0)); await new Promise(r => setTimeout(r,0)); };
let visual;
export async function prepareVeHeatmapCapture() {
  visual = await setupVeLifecycleFixture(); visual.root.hidden = false;
  visual.host.style.cssText = 'position:fixed;inset:0;background:#081018;z-index:10000;overflow:auto';
  const axis = Array.from({length:16},(_,i)=>(i+1)*500).join(' '), load = Array.from({length:16},(_,i)=>(i+1)*10).join(' ');
  const model=normalizeMsqTune(parseMsq(`<msq><page><constant name="veRpmBins" rows="1" cols="16">${axis}</constant><constant name="veLoadBins" rows="16" cols="1">${load}</constant><constant name="afrRpmBins" rows="1" cols="16">${axis}</constant><constant name="afrLoadBins" rows="16" cols="1">${load}</constant><constant name="veTable" rows="16" cols="16">${Array(256).fill(70).join(' ')}</constant><constant name="afrTable" rows="16" cols="16">${Array(256).fill(14).join(' ')}</constant></page></msq>`));
  visual.view.setTuneModel(model,'visual.msq');
  const layout=visual.root.querySelector('select[aria-label="VE Analyzer table view"]');layout.value='single';layout.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  return [...visual.root.querySelectorAll('td[data-ve-row][data-ve-col]')].map(c=>{const r=c.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};});
}
export function disposeVeHeatmapCapture(){visual?.view.dispose();visual?.host.remove();visual=undefined;}
export async function runVeVisualPresentationChecks(){
 const channels=[['rpm','RPM','rpm'],['map','MAP','kPa'],['afr','AFR','AFR'],['pw','PW','ms']].map(([id,sourceName,unit])=>({id,sourceName,displayName:sourceName,unit,valueType:'number'}));
 const traces=channels.map((channel,i)=>({channel,complete:true,range:{startSampleIndex:0,timeMs:Float64Array.from({length:60},(_,j)=>j*100),values:new Float64Array(60).fill([1432.17,71.23,15,4][i]),validity:new Uint8Array(60).fill(1)}}));
 const s=await setupVeLifecycleFixture(undefined,{channels,traces});s.root.hidden=false;s.host.style.cssText='position:fixed;inset:0;background:#081018;z-index:10000';
 const checks=[];
 try{
  s.run();const end=performance.now()+5000;while(s.view.getReadiness().pending){assert(performance.now()<end,'Visual fixture did not finish');await settle();}
  const primary=s.view.getPrimaryAnalysis(),reads=s.reads(),revision=s.view.sessionRevision;
  assert(primary,'Missing primary');s.root.querySelector('.ve-v50-completion-x').click();
  const result=s.root.querySelector('select[aria-label="VE Analyzer result view"]'),cell=s.root.querySelector('td[data-ve-row="0"][data-ve-col="0"]');
  result.value='weight';result.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  s.root.dispatchEvent(new CustomEvent('ve-cell-evidence-open',{detail:{cell}}));await settle();
  const metric=label=>[...s.host.querySelectorAll('.ve-evidence-detail-metric')].find(el=>el.firstElementChild.textContent===label)?.lastElementChild.textContent;
  assert(cell.querySelector('span').textContent===metric('Evidence weight'),'Result View and Cell Evidence disagree on evidence-weight precision');
  checks.push('Fractional evidence weight uses identical precision in Result View and retained evidence');
  result.value='proposal';result.dispatchEvent(new Event('change',{bubbles:true}));veProposalEditOwner(s.root).applyValues([{row:0,col:0,value:123.456789}]);await settle();
  assert(Number(cell.querySelector('span').textContent)===Number(metric('Working VE')),'Working table and evidence use different VE precision');
  assert(veProposalEditOwner(s.root).snapshot().values[0]===123.456789&&s.view.getPrimaryAnalysis()===primary&&s.view.sessionRevision===revision&&s.reads()===reads,'Formatting mutated authority or loaded traces');
  checks.push('Formatting preserves fractional working values, retained primary and trace-read count');
  const summary=s.root.querySelector('.ve-v50-setup-group > summary span');
  assert([summary,...s.root.querySelectorAll('.ve-v50-advanced-button')].every(el=>parseFloat(getComputedStyle(el).fontSize)>=10),'Compact setup typography is below the reference baseline');
  checks.push('Setup summaries meet the frozen reference typography baseline');
  const rect=cell.getBoundingClientRect();cell.setPointerCapture=()=>{};
  for(const type of ['pointerdown','pointerup'])cell.dispatchEvent(new PointerEvent(type,{pointerId:34,pointerType:'mouse',bubbles:true,cancelable:true}));
  s.root.querySelector('.ve-proposal-shared-toolbar button[aria-label="Pin or unpin selected cells"]').click();await settle();
  const after=cell.getBoundingClientRect();
  assert(cell.dataset.tableSelected==='true'&&getComputedStyle(cell).outlineWidth==='2px'&&cell.dataset.tablePinned==='true'
    &&getComputedStyle(cell,'::before').content.includes('◆')&&rect.width===after.width&&rect.height===after.height,'Heat edge treatment hid selection/pins or changed geometry');
  checks.push('Selection outline, symbol-only pin and cell geometry survive the heatmap paint treatment');
  return{passed:checks.length,checks};
 }finally{s.view.dispose();s.host.remove();}
}
