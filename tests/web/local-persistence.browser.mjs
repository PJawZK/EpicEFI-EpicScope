import { createHistogramMathChannelsView } from '../../apps/web/src/pages/histogram-math-channels-view';
// Real-browser fault injection only: application storage/cache ownership is unchanged.
import { createHistogramDistributionView } from '../../apps/web/src/pages/histogram-distribution-view';
import { createScatterView } from '../../apps/web/src/pages/scatter-view';
import { createHistogramTableGeneratorView } from '../../apps/web/src/pages/histogram-table-generator-view';
import * as tableStorage from '../../apps/web/src/state/histogram-table-storage';
import * as distributionStorage from '../../apps/web/src/state/histogram-distribution-storage';
import * as scatterStorage from '../../apps/web/src/state/histogram-scatter-storage';
const specs = [
 ['math-channels',createHistogramMathChannelsView,'.math-channel',tableStorage.loadHistogramCalculatedFields,tableStorage.saveHistogramCalculatedFields,'formulas'],
 ['distribution-presets',createHistogramDistributionView,'.distribution-preset',distributionStorage.loadHistogramDistributionPresets,distributionStorage.saveHistogramDistributionPresets,'distribution-presets'],
 ['scatter-presets',createScatterView,'.scatter-preset',scatterStorage.loadHistogramScatterPresets,scatterStorage.saveHistogramScatterPresets,'scatter-presets'],
 ['table-presets',createHistogramTableGeneratorView,'.histogram-preset',tableStorage.loadHistogramTablePresets,tableStorage.saveHistogramTablePresets,'table-presets'],
 ['filter-sets',createHistogramTableGeneratorView,'.histogram-filter-set',tableStorage.loadHistogramFilterSets,tableStorage.saveHistogramFilterSets,'filter-sets'],
 ['calculated-fields',createHistogramTableGeneratorView,'.histogram-formula',tableStorage.loadHistogramCalculatedFields,tableStorage.saveHistogramCalculatedFields,'formulas'],
];
const channels=[{id:'rpm',sourceName:'RPM',displayName:'RPM',unit:'rpm',valueType:'number'}];
const context={source:{identity:{},sampleCount:0,revision:0},channels,traces:[],loadTraces:async()=>[],aTimeMs:0,bTimeMs:1000,savedRanges:[]};
const assert=(value,message)=>{if(!value)throw Error(message);};
const settle=async()=>{await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));};
export async function runLocalPersistenceChecks(){
 const passed=[];const expected={};const originalSet=Storage.prototype.setItem,originalPrompt=window.prompt;
 let blockedKey='',errorName='QuotaExceededError';
 Storage.prototype.setItem=function(key,value){if(key===blockedKey)throw new DOMException('Injected browser storage failure',errorName);return originalSet.call(this,key,value);};
 try {
  for(const [name,create,prefix,load,save,suffix]of specs){
   const key=`epicscope.histogram.${suffix}.v1`;
   for(const failure of ['QuotaExceededError','SecurityError']){
    blockedKey='';save([]);const view=create(),root=view.element;root.hidden=false;root.style.cssText='position:fixed;inset:0;z-index:9999;width:100vw;height:100vh';document.body.append(root);view.setContext(context);
    const feedback=root.querySelector(`[data-persistence="${name}"]`),select=root.querySelector(prefix+'-select')??{get value(){return load()[0]?.id??'';},options:[]};
    const saveButton=root.querySelector(prefix+'-save'),deleteButton=root.querySelector(prefix+'-delete');
    root.querySelectorAll('details').forEach(detail=>detail.open=detail.contains(saveButton));
    const retry=feedback.querySelector('button');window.prompt=()=>`${name} ${failure}`;
    const fillFormula=()=>{if(name==='calculated-fields'){root.querySelector('.histogram-formula-name').value='Double RPM';root.querySelector('.histogram-formula-expression').value='[RPM] * 2';}if(name==='math-channels'){root.querySelector('.math-channel-name').value='Double RPM';root.querySelector('.math-channel-formula').value='[RPM] * 2';}};fillFormula();
    errorName=failure;blockedKey=key;const before=localStorage.getItem(key);saveButton.scrollIntoView({block:'center'});saveButton.click();await settle();
    assert(load().length===1&&select.value,'Failed save discarded session item');
    assert(localStorage.getItem(key)===before,'Failed save changed durable storage');
    assert(feedback.dataset.state==='error'&&!retry.hidden&&feedback.textContent.includes('session only'),'Save failure not actionable');
    if(name!=='calculated-fields'){const rect=feedback.getBoundingClientRect();assert(rect.width>0&&rect.height>0&&rect.top>=0&&rect.bottom<=innerHeight,'Failure feedback is not visible in the viewport: '+name);} // Legacy formula UI is intentionally hidden; visible Math Channels is tested separately.
    if(name==='math-channels')assert(!deleteButton.hidden,'Session math channel cannot be deleted');
    const selected=select.value;retry.click();assert(feedback.dataset.state==='error'&&select.value===selected,'Repeated failure lost selection or cleared warning');
    blockedKey='';retry.click();assert(feedback.dataset.state==='saved'&&retry.hidden&&JSON.parse(localStorage.getItem(key)).length===1,'Retry did not persist session item');
    if(name==='math-channels')assert(!root.querySelector('.math-channel-validation').textContent.includes('could not save'),'Retry left a contradictory storage warning');
    assert(!deleteButton.disabled,'New session item cannot be deleted');
    blockedKey=key;const saved=localStorage.getItem(key);deleteButton.click();await settle();
    assert(load().length===0&&!Array.from(select.options).some(o=>o.value===selected),'Failed deletion did not update session');
    assert(localStorage.getItem(key)===saved&&feedback.dataset.state==='error'&&feedback.textContent.includes('may return after reload'),'Deletion failure hid durable state');
    blockedKey='';retry.click();assert(feedback.dataset.state==='saved'&&JSON.parse(localStorage.getItem(key)).length===0,'Deletion retry failed');
    // A later writer changes the shared session cache. Retry must not resurrect a captured collection.
    if(name==='calculated-fields')select.value='';fillFormula();
    blockedKey=key;saveButton.click();assert(load().length===1,'Missing retained retry fixture');save([]);
    blockedKey='';retry.click();assert(JSON.parse(localStorage.getItem(key)).length===0,'Retry persisted an obsolete owner snapshot');
    // Leave one successful record for a real page reload / module-cache reconstruction check.
    saveButton.click();assert(feedback.dataset.state==='saved'&&load().length===1,'Successful save not confirmed');
    expected[key]=JSON.parse(localStorage.getItem(key));
    root.remove();await settle();passed.push(`${name}: ${failure} save/delete failures, repeated failure, retry, current-cache safety and success`);
   }
  }
  return {passed:passed.length,checks:passed,expectedAfterReload:expected};
 }finally{Storage.prototype.setItem=originalSet;window.prompt=originalPrompt;}
}
export function readPersistenceAfterReload(){return Object.fromEntries(specs.map(([, , ,load,,suffix])=>[`epicscope.histogram.${suffix}.v1`,load()]));}
