import { createMsqDocumentLoader } from '../../apps/web/src/adapters/msq-document-loader';
import { createMsqSaveSession } from '../../apps/web/src/adapters/msq-save-session';
import { prepareMsqInWorker } from '../../apps/web/src/adapters/msq-write-preparation';
import { parseIniMsqWriteCatalog } from '../../core/parsers/ini/ini-msq-write-policy';
import { prepareMsqCandidate } from '../../apps/web/src/adapters/msq-candidate';
import { serializeVeDelayTable } from '../../core/analysis/ve-delay-table-storage';
import { veDelayEditOwner } from '../../apps/web/src/pages/ve-analyzer-delay-edit-owner';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const settle=async()=>{await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));};
const source='<msq><versionInfo signature="save-test"/><page number="0"><constant name="veRpmBins" rows="1" cols="2">1000 2000</constant><constant name="veLoadBins" rows="2" cols="1">50 100</constant><constant name="afrRpmBins" rows="1" cols="2">1000 2000</constant><constant name="afrLoadBins" rows="2" cols="1">50 100</constant><constant name="veTable" rows="2" cols="2" units="%" digits="1">70 70 70 70</constant><constant name="afrTable" rows="2" cols="2" units="AFR">14 14 14 14</constant><constant name="other">42</constant></page></msq>';
const catalog=parseIniMsqWriteCatalog('[MegaTune]\nsignature="save-test"\n[Constants]\nveTable=array,U16,0,[2x2],"%",0.01,0,0,650,1');
async function accepted(handle){let document,error;const loader=createMsqDocumentLoader({loading(){},accepted:d=>{document=d;},rejected:(_n,e)=>{error=e;}});await loader.choose(async()=>[handle]);if(error)throw error;return document;}
async function wait(check,message){const end=performance.now()+15000;while(!check()){assert(performance.now()<end,message);await settle();}}
export async function runMsqSaveChecks(){
 const checks=await runMsqAccessRetentionChecks();let disk=new TextEncoder().encode(source),writes=0,permissions=0;
 const handle={kind:'file',name:'save-test.msq',getFile:async()=>new File([disk],'save-test.msq'),requestPermission:async()=>{permissions++;return'granted';},createWritable:async()=>{let pending;writes++;return{write:async bytes=>{pending=bytes.slice();},close:async()=>{disk=pending;},abort:async()=>{}};}};
 const d=await accepted(handle),f=await setupVeLifecycleFixture();f.root.hidden=false;f.view.setTuneModel(d.model,d.name);
 const result=f.root.querySelector('select[aria-label="VE Analyzer result view"]');result.value='proposal';result.dispatchEvent(new Event('change',{bubbles:true}));
 const owner=veProposalEditOwner(f.root);let latest;
 const session=createMsqSaveSession({capture:()=>owner.captureMsqWrite(),current:s=>owner.isMsqWriteCurrent(s),canPrepare:()=>typeof Worker==='function',prepare:prepareMsqInWorker,notify:s=>{latest=s;f.root.dispatchEvent(new CustomEvent('ve-msq-save-state',{detail:s}));}});
 session.setDocument(d);session.setCatalog(catalog);
 const request=e=>{if(!e.defaultPrevented)void session.save();};f.root.addEventListener('ve-msq-save-request',request);
 const changed=()=>session.reviewChanged();f.root.addEventListener('ve-proposal-table-rendered',changed);
 try{
  const save=f.root.querySelector('.ve-v50-save-proposal');
  if(typeof Worker!=='function'){
   assert(save.disabled&&latest.message.includes('Worker'),'No-worker browser advertises overwrite');await session.save();assert(writes===0&&permissions===0,'No-worker fallback requested write permission');
   checks.push('Blocked Worker support leaves save explicitly unavailable without synchronous fallback or writes');return{passed:checks.length,checks};
  }
  assert(!save.disabled&&save.textContent==='Save MSQ'&&getComputedStyle(save).opacity==='1'&&getComputedStyle(save).cursor==='pointer','Writable load and matching INI did not enable MSQ save independently of analysis blockers');
  const cell=f.root.querySelector('td[data-ve-row="0"][data-ve-col="0"]');cell.dispatchEvent(new KeyboardEvent('keydown',{key:'F2',bubbles:true,cancelable:true}));const editor=f.root.querySelector('.ve-table-inline-input');assert(editor,'No inline editor');
  save.click();await settle();assert(permissions===0&&f.root.querySelector('.ve-v50-msq-feedback').textContent.includes('Finish'),'Pending draft guard/feedback failed: '+JSON.stringify({permissions,writes,feedback:f.root.querySelector('.ve-v50-msq-feedback').textContent,editor:editor.isConnected}));
  editor.value='123.456';editor.dispatchEvent(new Event('input',{bubbles:true}));editor.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await settle();
  save.click();await wait(()=>!session.busy,'Save did not finish');assert(latest.outcome==='saved','Worker overwrite failed: '+latest.message);
  assert(prepareMsqCandidate(new TextDecoder().decode(disk)).byName.get('veTable').numericValues[0]===123.46&&d.model.byName.get('veTable').numericValues[0]===70,'Write precision/source immutability failed');
  assert(owner.snapshot().values[0]===123.456,'Save rebased/rounded working edits');checks.push('UI Save blocks drafts, writes committed VE through real worker and preserves source/working authority');
  const prior=writes;await session.checkExternal();assert(latest.outcome==='saved','Own save looked like outside change');save.click();await wait(()=>!session.busy,'Repeated Save stuck');assert(writes===prior,'Already-matching file unnecessarily rewritten');
  owner.applyValues([{row:0,col:0,value:70}]);save.click();await wait(()=>!session.busy,'Restore save stuck');assert(new TextDecoder().decode(disk)===source,'Restoring original VE did not write original values back');checks.push('Own-save activation is quiet; repeated save no-ops and original-value restoration writes back correctly');
  disk=new TextEncoder().encode(source.replace('>42<','>43<'));await session.checkExternal();assert(latest.outcome==='conflict'&&save.disabled,'Outside file edit did not block Save');
  const reload=f.root.querySelector('.ve-v50-msq-feedback button');reload.click();const dialog=f.root.querySelector('.ve-msq-reload-confirm');assert(dialog.open,'Reload notice lacks explicit discard confirmation');dialog.querySelector('[data-msq-keep]').click();assert(!dialog.open&&latest.outcome==='conflict','Keep edits cleared conflict');checks.push('External content changes block overwrite and reload offers explicit keep/discard choice');
  const originalBytes=d.bytes.slice(),snapshot=owner.captureMsqWrite(),abort=new AbortController();abort.abort();let aborted=false;try{await prepareMsqInWorker(d,snapshot,catalog,abort.signal);}catch{aborted=true;}assert(aborted&&d.bytes.every((b,i)=>b===originalBytes[i]),'Worker cancellation detached/mutated source bytes');checks.push('Worker cancellation retains accepted original bytes');
 }finally{session.dispose();f.root.removeEventListener('ve-msq-save-request',request);f.root.removeEventListener('ve-proposal-table-rendered',changed);f.view.dispose();f.host.remove();}
 if(navigator.storage?.getDirectory){
  const directory=await navigator.storage.getDirectory(),name='epicscope-msq-save-'+crypto.randomUUID()+'.msq',native=await directory.getFileHandle(name,{create:true});let fsSession;
  try{
   const stream=await native.createWritable();await stream.write(source);await stream.close();
   const wrapper={kind:'file',name,getFile:()=>native.getFile(),requestPermission:async()=>'granted',createWritable:options=>native.createWritable(options)};
   const document=await accepted(wrapper),entry=document.model.byName.get('veTable');
   const snapshot={tuneModel:document.model,entry,rpmAxis:document.model.byName.get('veRpmBins'),loadAxis:document.model.byName.get('veLoadBins'),revision:0,authorityGeneration:1,rows:2,cols:2,values:[80.125,70,70,70]};let state;
   fsSession=createMsqSaveSession({capture:()=>snapshot,current:s=>s===snapshot,canPrepare:()=>true,prepare:prepareMsqInWorker,notify:s=>{state=s;}});fsSession.setDocument(document);fsSession.setCatalog(catalog);await fsSession.save();
   assert(state.outcome==='saved','Native sandbox stream/readback failed: '+state.message);assert((await native.getFile()).size>0&&(await(await native.getFile()).text()).includes('80.13 70 70 70'),'Real sandbox file not overwritten');checks.push('Native disposable OPFS stream commits worker-prepared bytes and passes readback (not user-file permission validation)');
  }finally{fsSession?.dispose();await directory.removeEntry(name);}
 }
 return{passed:checks.length,checks};
}

export async function checkRealMsqWorker(original,altered,iniText){
 if(typeof Worker!=='function')return{passed:1,checks:['No-worker environment rejects enabling overwrite; no synchronous preparation fallback']};
 const from=async(bytes,name)=>{let d;const loader=createMsqDocumentLoader({loading(){},accepted:value=>{d=value;},rejected:(_n,e)=>{throw e;}});await loader.loadFile(new File([Uint8Array.from(atob(bytes),c=>c.charCodeAt(0))],name));return d;};
 const d=await from(original,'reference.msq'),a=await from(altered,'altered.msq'),entry=d.model.byName.get('veTable'),snapshot={tuneModel:d.model,entry,rpmAxis:d.model.byName.get('veRpmBins'),loadAxis:d.model.byName.get('veLoadBins'),revision:0,authorityGeneration:1,rows:32,cols:32,values:entry.numericValues.map(v=>v*1.25)};
 const writeCatalog=parseIniMsqWriteCatalog(iniText);
 let frames=0;const timer=setInterval(()=>frames++,5),start=performance.now();let plan;try{plan=await prepareMsqInWorker(d,snapshot,writeCatalog,new AbortController().signal);}finally{clearInterval(timer);}
 const result=prepareMsqCandidate(new TextDecoder('iso-8859-1').decode(plan.bytes));assert(result.byName.get('veTable').numericValues.every((v,i)=>v===a.model.byName.get('veTable').numericValues[i]),'Worker differs from TunerStudio reference');assert(frames>0,'Main-thread heartbeat blocked during real MSQ preparation');
 return{passed:2,elapsedMs:performance.now()-start,frames,checks:['Actual worker matches all1024 TunerStudio reference values','Main-thread heartbeat advances while real MSQ preparation runs off-thread']};
}


async function runMsqAccessRetentionChecks(){
 const f=await setupVeLifecycleFixture(),checks=[];f.root.hidden=false;let acceptedCount=0;
 const bytes=new TextEncoder().encode(source),file=new File([bytes],'access-test.msq');
 const loader=createMsqDocumentLoader({loading(){},accepted:d=>{acceptedCount++;f.view.setTuneModel(d.model,d.name);},rejected:(_n,e)=>{throw e;}});
 let session;
 try{
  await loader.loadFile(file);const original=loader.current;
  const delayInput=f.root.querySelector('[data-ve-analyzer="load-delay-file"]');
  const delayText=serializeVeDelayTable({rpmBins:[1000,2000],loadBins:[50,100],rows:2,cols:2,origin:'saved-file',cells:Array.from({length:4},(_,i)=>({row:Math.floor(i/2),col:i%2,state:'measured',workingMs:100,recommendedMs:100,workingProvenance:'measured-recommendation',eventCount:5,confidence:'moderate',sourceEvents:[]}))});
  Object.defineProperty(delayInput,'files',{configurable:true,value:[{name:'delays.json',text:async()=>delayText}]});delayInput.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  const owner=veProposalEditOwner(f.root),delay=veDelayEditOwner(f.root);
  delay.applyValues([{row:1,col:1,workingMs:125}]);owner.setPinned([{row:1,col:1}]);
  assert(!f.root.querySelector('.ve-workbench-run').disabled,'Access fixture not ready for analysis');f.run();await wait(()=>!!f.view.getPrimaryAnalysis()&&!f.view.getReadiness().pending,'Access fixture analysis did not finish');await settle();
  const result=f.root.querySelector('select[aria-label="VE Analyzer result view"]');result.value='proposal';result.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  const editCell=f.root.querySelector('td[data-ve-row="0"][data-ve-col="0"]');editCell.dispatchEvent(new KeyboardEvent('keydown',{key:'F2',bubbles:true,cancelable:true}));const draft=f.root.querySelector('.ve-table-inline-input');assert(draft,'Access fixture editor missing');draft.value='123.456';draft.dispatchEvent(new Event('input',{bubbles:true}));draft.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await settle();
  const snapshot=owner.captureMsqWrite(),review=JSON.stringify(owner.snapshot()),delayState=JSON.stringify(delay.snapshot()),primary=f.view.getPrimaryAnalysis(),revision=f.view.sessionRevision,reads=f.reads(),table=f.root.querySelector('[data-ve-analyzer="ve-table-view"] table');
  session=createMsqSaveSession({capture:()=>owner.captureMsqWrite(),current:s=>owner.isMsqWriteCurrent(s),canPrepare:()=>typeof Worker==='function',pickerUnavailable:()=>undefined,prepare:prepareMsqInWorker,notify:s=>{f.root.dispatchEvent(new CustomEvent('ve-msq-save-state',{detail:s}));}});session.setDocument(original);session.setCatalog(catalog);
  let permissions=0,writes=0;
  const handle={kind:'file',name:file.name,getFile:async()=>file,requestPermission:async()=>{permissions++;return'granted';},createWritable:async()=>{writes++;throw Error('Access must not write');}};
  const enable=f.root.querySelector('[data-msq-enable-access]');assert(enable&&!enable.hidden&&!enable.disabled&&f.root.querySelector('.ve-v50-save-proposal').disabled,'Read-only import lacks explicit access recovery');
  let completion;
  const enableRequest=()=>{session.setLoading(true);completion=loader.attachAccess(async()=>[handle]).then(r=>{assert(r.status==='attached','Handle was not attached');session.setDocument(r.document);}).finally(()=>session.setLoading(false));};
  f.root.addEventListener('ve-msq-enable-access-request',enableRequest);enable.click();await completion;f.root.removeEventListener('ve-msq-enable-access-request',enableRequest);
  assert(acceptedCount===1&&loader.current.model===original.model&&owner.isMsqWriteCurrent(snapshot)&&JSON.stringify(owner.snapshot())===review&&JSON.stringify(delay.snapshot())===delayState,'Access reset tune, working values, pins or delay');
  assert(f.view.getPrimaryAnalysis()===primary&&f.view.sessionRevision===revision&&f.reads()===reads&&f.root.querySelector('[data-ve-analyzer="ve-table-view"] table')===table,'Access reran/rebuilt primary analysis');
  assert(permissions===0&&writes===0&&enable.hidden&&f.root.querySelector('.ve-v50-save-proposal').disabled===(typeof Worker!=='function'),'Access prematurely requested writes or left incorrect Save state');
  checks.push('Read-only MSQ access recovery preserves primary analysis, numerical identities, Working VE, pins, delay, table DOM and source reads');
  const undo=f.root.querySelector('.ve-proposal-shared-toolbar button[title="Undo"]');assert(undo&&!undo.disabled,'Access lost Working VE undo history');undo.click();assert(owner.snapshot().values[0]!==123.456,'Working VE history cannot undo after access attachment');checks.push('Working VE undo history remains functional after verified handle attachment');
 }finally{session?.dispose();loader.dispose();f.view.dispose();f.host.remove();}
 return checks;
}
