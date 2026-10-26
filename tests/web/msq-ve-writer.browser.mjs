import { createMsqDocumentLoader } from '../../apps/web/src/adapters/msq-document-loader';
import { prepareVeMsqWrite } from '../../apps/web/src/adapters/msq-ve-document-writer';
import { veProposalEditOwner } from '../../apps/web/src/pages/ve-analyzer-proposal-edit-owner';
import { setupVeLifecycleFixture } from './ve-analyzer-lifecycle.browser.mjs';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const settle=async()=>{await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));};
const ini=(shape='3x2',signature='test')=>`[MegaTune]\nsignature="${signature}"\n[Constants]\nveTable=array,U16,0,[${shape}],"%",0.01,0,0,650,1\n`;
const source=(encoding='ISO-8859-1')=>`<?xml version="1.0" encoding="${encoding}"?>\r\n<msq xmlns="http://www.msefi.com/:msq"><versionInfo signature="test"/><bibliography author="åäö" writeDate="unchanged"/><!-- <constant name="veTable">999</constant> --><?test keep?><settings note="a > b"><![CDATA[<constant>not markup</constant>]]></settings><page number="0"><constant name="rpm" rows="1" cols="3">600 1000 2000</constant><constant name="load" rows="2" cols="1">20 100</constant><constant name="veTable" units="%" rows="2" cols="3" digits="1" note="a &gt; b">\r\n 38.19  38.27\t38.32\r\n 38.36 38.40 38.48\r\n</constant><constant name="other">"Keep &amp;#65; literal"</constant></page></msq>`;
async function document(text=source(),utf8=false,bom=false){let accepted,error;const owner=createMsqDocumentLoader({loading(){},accepted:value=>{accepted=value;},rejected:(_name,issue)=>{error=issue;}});let bytes=utf8?new TextEncoder().encode(text):Uint8Array.from(text,c=>c.charCodeAt(0));if(bom){const b=new Uint8Array(bytes.length+3);b.set([239,187,191]);b.set(bytes,3);bytes=b;}await owner.loadFile(new File([bytes],'writer.msq'));if(error)throw error;return accepted;}
const snapshot=d=>({tuneModel:d.model,entry:d.model.byName.get('veTable'),rpmAxis:d.model.byName.get('rpm'),loadAxis:d.model.byName.get('load'),revision:0,authorityGeneration:1,rows:2,cols:3,values:[38.19,38.27,38.32,38.36,38.40,38.48]});
function rejects(fn,message){let issue;try{fn();}catch(error){issue=error;}assert(issue,message);}
export async function runMsqVeWriterChecks(){
 const checks=[];
 for(const utf8 of [false,true]){
  const d=await document(source(utf8?'UTF-8':'ISO-8859-1'),utf8,utf8),s=snapshot(d),before=d.bytes.slice();
  const noOp=prepareVeMsqWrite(d,s,ini());assert(noOp.changedCells===0&&noOp.bytes.every((b,i)=>b===before[i])&&noOp.bytes.length===before.length,'No-op rewrite changed bytes');
  const next={...s,values:[47.7375,38.27,39.005,38.36,0,650]};const plan=prepareVeMsqWrite(d,next,ini());
  const expected=d.text.replace('38.19  38.27\t38.32','47.74  38.27\t39.01').replace('38.36 38.40 38.48','38.36 0 650');
  assert(!new DOMParser().parseFromString(plan.text,'application/xml').querySelector('parsererror'),'Worker-compatible writer produced invalid XML');
  assert(plan.text===expected&&plan.changedCells===4&&plan.values[2]===39.01,'Rectangular VE-only patch changed whitespace/orientation/metadata or used digits1');
  assert(d.bytes.every((b,i)=>b===before[i])&&d.model.byName.get('veTable').numericValues[0]===38.19,'Writer mutated accepted document/model');
  assert((utf8&&plan.bytes[0]===239)||(!utf8&&plan.bytes.includes(229)),'Original encoding/BOM lost');
  checks.push(`${utf8?'UTF8 BOM':'Latin1'}: no-op byte identity and rectangular VE-only patch preserve unrelated content, whitespace and source authority`);
 }
 const d=await document(),s=snapshot(d);
 rejects(()=>prepareVeMsqWrite(d,{...s,tuneModel:{...s.tuneModel}},ini()),'Foreign tune accepted');
 rejects(()=>prepareVeMsqWrite(d,{...s,rows:3},ini()),'Wrong dimensions accepted');
 rejects(()=>prepareVeMsqWrite(d,{...s,values:[1,2]},ini()),'Wrong token count accepted');
 rejects(()=>prepareVeMsqWrite(d,{...s,values:[undefined,...s.values.slice(1)]},ini()),'Blank cell accepted');
 rejects(()=>prepareVeMsqWrite(d,s,ini('3x2','wrong')),'Mismatched INI accepted');
 checks.push('Foreign identity, geometry, blank and mismatched firmware are rejected');
 const offGrid=await document(source().replace('38.19  ','38.191  '));rejects(()=>prepareVeMsqWrite(offGrid,{...snapshot(offGrid),values:[38.191,...snapshot(offGrid).values.slice(1)]},ini()),'Writer silently changed an untouched off-grid source value');
 const duplicate=await document(source().replace('</page>','<constant name="veTable" units="%" rows="2" cols="3" digits="1">38.19 38.27 38.32 38.36 38.4 38.48</constant></page>'));
 rejects(()=>prepareVeMsqWrite(duplicate,snapshot(duplicate),ini()),'Ambiguous duplicate accepted');
 const entities=await document(source().replace('38.19  ','&#51;8.19  '));rejects(()=>prepareVeMsqWrite(entities,snapshot(entities),ini()),'Complex numeric payload accepted');
 const dtd=await document(source().replace('<msq xmlns','<!DOCTYPE msq []><msq xmlns'));rejects(()=>prepareVeMsqWrite(dtd,snapshot(dtd),ini()),'DTD accepted');
 rejects(()=>prepareVeMsqWrite({...d,text:d.text.replace('38.19','38.18')},s,ini()),'Mismatched bytes/text accepted');
 checks.push('Duplicate target, DTD, numeric entities and bytes/text disagreement fail closed');
 const f=await setupVeLifecycleFixture();
 try{
  const owner=veProposalEditOwner(f.root),first=owner.captureMsqWrite();assert(first&&owner.isMsqWriteCurrent(first),'No committed capture');
  const traces=await f.context.loadTraces(['rpm','map','afr','pw']),held=f.hold();f.run();await settle();assert(!owner.captureMsqWrite()&&!owner.isMsqWriteCurrent(first),'Pending analysis exports review authority');
  held.resolve(traces);const end=performance.now()+10000;while(f.view.getReadiness().pending){assert(performance.now()<end,'Analysis did not complete');await settle();}
  const primary=f.view.getPrimaryAnalysis(),reads=f.reads();assert(primary,'Missing generated result');
  const generated=owner.captureMsqWrite();assert(generated.values[0]===primary.proposal.cells[0].proposedValue&&f.model.byName.get('veTable').numericValues[0]===70,'Capture lost generated review or changed source');
  const cell=f.root.querySelector('td[data-ve-row="0"][data-ve-col="0"]');cell.title='Current 999';cell.querySelector('span').textContent='999';assert(owner.captureMsqWrite().values[0]===generated.values[0],'Capture inferred values from rendered text');
  owner.applyValues([{row:0,col:0,value:123.456}]);owner.setPinned([{row:0,col:0}]);const pinned=owner.captureMsqWrite();
  assert(pinned.values[0]===123.456&&pinned.entry===f.model.byName.get('veTable'),'Capture excluded manual/pinned work or selected wrong source');
  const select=f.root.querySelector('select[aria-label="VE Analyzer result view"]');select.value='samples';select.dispatchEvent(new Event('change',{bubbles:true}));await settle();
  assert(owner.captureMsqWrite().values[0]===123.456&&owner.isMsqWriteCurrent(pinned)&&f.reads()===reads,'Result View changed capture/source reads');
  owner.applyValues([{row:0,col:0,value:80}]);assert(pinned.values[0]===123.456&&!owner.isMsqWriteCurrent(pinned),'Snapshot not detached or old edit authority remains current');
  f.view.setActive(false);assert(!owner.captureMsqWrite(),'Hidden view exports');f.view.setActive(true);f.view.setTuneModel({...f.model},'replacement.msq');assert(!owner.isMsqWriteCurrent(pinned),'Old tune still current');
  checks.push('Owner capture retains committed manual/pinned values independent of Result View and rejects stale/pending/hidden authority');
 }finally{f.view.dispose();f.host.remove();}
 return{passed:checks.length,checks};
}

// External user files remain outside the repo; numerical reference validation only.
export async function checkRealMsqVeWriter(original,altered,iniText,compiledWriterUrl){
 const write=compiledWriterUrl?(await import(/* @vite-ignore */ compiledWriterUrl)).prepareVeMsqWrite:prepareVeMsqWrite;
 const fromBytes=async bytes=>{let accepted,error;const loader=createMsqDocumentLoader({loading(){},accepted:d=>{accepted=d;},rejected:(_n,e)=>{error=e;}});await loader.loadFile(new File([Uint8Array.from(atob(bytes),c=>c.charCodeAt(0))],'reference.msq'));if(error)throw error;return accepted;};
 const a=await fromBytes(original),b=await fromBytes(altered),entry=a.model.byName.get('veTable');
 const s={tuneModel:a.model,entry,rpmAxis:a.model.byName.get('veRpmBins'),loadAxis:a.model.byName.get('veLoadBins'),revision:0,authorityGeneration:1,rows:32,cols:32,values:entry.numericValues.map(v=>v*1.25)};
 const started=performance.now(),plan=write(a,s,iniText),preparationMs=performance.now()-started,expected=b.model.byName.get('veTable').numericValues;
 assert(plan.values.length===1024&&plan.values.every((v,i)=>v===expected[i])&&plan.changedCells===1024,'TunerStudio25% numerical reference differs');
 const payload=t=>/<constant\b(?=[^>]*\bname="veTable")[^>]*>([\s\S]*?)<\/constant>/.exec(t);
 const strip=t=>{const match=payload(t);assert(match,'Reference VE payload absent');return t.slice(0,match.index)+match[0].replace(match[1],'__VE_VALUES__')+t.slice(match.index+match[0].length);};
 assert(strip(plan.text)===strip(a.text)&&a.bytes.length>0,'Non-VE source content changed');
 return{passed:2,preparationMs,checks:['All1024 rounded Working VE25% changes match TunerStudio3.3.01 ALT values despite digits1','Original ISO-8859-1 document outside VE payload is unchanged, including writeDate and metadata']};
}
