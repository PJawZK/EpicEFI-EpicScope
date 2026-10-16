import { prepareMsqCandidate } from '../../apps/web/src/adapters/msq-candidate';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
const settle=async()=>{await new Promise(r=>setTimeout(r,0));await new Promise(r=>setTimeout(r,0));};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject};}
function pick(name,read){const input=document.querySelector('input[accept^=".msq"]');Object.defineProperty(input,'files',{configurable:true,value:{item:()=>name?{name,text:read}:null}});input.dispatchEvent(new Event('change',{bubbles:true}));}
const button=()=>document.querySelector('.load-msq');
const snapshot=()=>({summary:document.querySelector('[data-ve-analyzer="summary"]').textContent,delay:document.querySelector('[data-delay-row="0"][data-delay-col="0"]').dataset.delayValue,titles:[...document.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].map(c=>c.title)});
export async function runMsqReplacementChecks(goodSource){
 const passed=[];const check=async(name,test)=>{await test();passed.push(name);};
 await check('candidate validation accepts supported namespaced MSQ, text metadata and inferred vectors',()=>{
  const m=prepareMsqCandidate('<msq xmlns="http://www.msefi.com/:msq"><page><pcVariable name="label">"My tune"</pcVariable><constant name="bins">1 2 3</constant></page></msq>');assert(m.entries.length===2&&m.byName.get('label').kind==='text'&&m.byName.get('bins').kind==='vector','Valid non-VE tune was rejected');
 });
 await check('candidate preserves literal entity text and decodes numeric references once',()=>{
  const m=prepareMsqCandidate('<msq><versionInfo signature="&amp;#65;"/><page><pcVariable name="label">"&amp;lt; &#x1F600;"</pcVariable><constant name="value">&#49;</constant></page></msq>');
  assert(m.identity.signature==='&#65;'&&m.byName.get('label').textValue==='&lt; 😀'&&m.byName.get('value').numericValues[0]===1,'Entities decoded more than once');
 });
 await check('candidate keeps quoted numeric/empty values and dimensioned strings as text',()=>{
  const m=prepareMsqCandidate('<msq><page><constant name="numericLabel">"123"</constant><constant name="empty">""</constant><constant name="text" rows="1" cols="20">"Tune label"</constant><constant name="metadata">Unquoted metadata</constant></page></msq>');
  for(const name of ['numericLabel','empty','text','metadata'])assert(m.byName.get(name).kind==='text',name+' was coerced to numeric');
  assert(m.byName.get('empty').textValue==='','Quoted empty text was lost');
 });
 await check('candidate accepts finite dimensioned numbers and undimensioned vectors',()=>{
  const m=prepareMsqCandidate('<msq><page><constant name="x" rows="1" cols="3">-1 2.5 3e2</constant><constant name="bins">1 2 3</constant></page></msq>');
  assert(JSON.stringify(m.byName.get('x').numericValues)==='[-1,2.5,300]'&&m.byName.get('bins').kind==='vector','Valid numeric data rejected');
 });
 for(const [name,value]of [['mixed numeric table','1 2 bad 4'],['nonfinite numeric table','1 2 NaN 4'],['infinite numeric table','1 2 1e999 4'],['blank numeric table','']])await check('candidate rejects '+name,()=>{
  let error;try{prepareMsqCandidate(`<msq><page><constant name="veTable" rows="2" cols="2">${value}</constant></page></msq>`);}catch(e){error=e;}
  assert(error?.message.includes('veTable'),'Malformed numeric data was silently treated as text');
 });
 await check('candidate rejects blank declared dimensions',()=>{let error;try{prepareMsqCandidate('<msq><page><constant name="x" rows=" ">1</constant></page></msq>');}catch(e){error=e;}assert(error?.message.includes('positive integer'),'Blank dimension accepted');});
 for(const [name,source]of [['wrong root','<xml/>'],['empty','<msq/>'],['truncated',goodSource.slice(0,-6)],['mismatched XML','<msq><page></msq>'],['bad dimensions','<msq><page><constant name="x" rows="bad">1</constant></page></msq>'],['zero dimensions','<msq><page><constant name="x" rows="0">1</constant></page></msq>'],['incomplete numeric table','<msq><page><constant name="x" rows="2" cols="2">1 2 3</constant></page></msq>']])await check('candidate rejects '+name,()=>{let threw=false;try{prepareMsqCandidate(source);}catch{threw=true;}assert(threw,'Invalid candidate accepted');});
 const initial=snapshot();assert(initial.delay==='125'&&initial.titles.some(t=>t.startsWith('Measured proposal')),'Baseline VE session not ready');
 [...document.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find(c=>c.title.startsWith('Measured proposal')).click();await settle();
 const panel=document.querySelector('.ve-cell-detail-popover'),grid=panel.querySelector('.ve-evidence-detail-grid');assert(grid,'Missing cached popup');
 const preserved=()=>{assert(JSON.stringify(snapshot())===JSON.stringify(initial),'Existing VE session changed');assert(!panel.hidden&&panel.querySelector('.ve-evidence-detail-grid')===grid,'Retained popup/evidence replaced');};
 await check('cancelled file selection leaves the current session and status untouched',async()=>{const title=button().title;pick(null);await settle();preserved();assert(button().title===title,'Cancel changed load status');});
 for(const [name,read]of [['broken.msq',async()=>'<msq><page>'],['unreadable.msq',async()=>{throw Error('Local read denied');}],['mixed-table.msq',async()=>'<msq><page><constant name="veTable" rows="2" cols="2">1 2 bad 4</constant></page></msq>'],['invalid-entity.msq',async()=>'<msq><page><constant name="x">&#0;</constant></page></msq>'],['bad-shape.msq',async()=>'<msq><page><constant name="veTable" rows="2" cols="2">1 2 3</constant></page></msq>']])await check('failed replacement preserves the active tune/session: '+name,async()=>{
  pick(name,read);await settle();preserved();assert(button().dataset.loadState==='issue'&&button().title.includes('remains active')&&button().title.includes('retry'),'Failure feedback does not explain retained authority/recovery');
 });
 await check('failed replacement survives Logger navigation with retained shell tune authority',async()=>{
  document.querySelector('[data-epicscope-mode="logger"]').click();await settle();document.querySelector('[data-epicscope-mode="analyzer"]').click();await settle();assert(JSON.stringify(snapshot())===JSON.stringify(initial),'Shell reapplied cleared/replacement tune after failure');
  [...document.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find(c=>c.title.startsWith('Measured proposal')).click();await settle();assert(panel.querySelector('.ve-evidence-detail-grid')===grid,'Navigation lost retained evidence cache');
 });
 await check('later rejected candidate supersedes earlier valid read, preserving the original tune',async()=>{
  const a=deferred();pick('older-valid.msq',()=>a.promise);assert(!button().disabled&&button().dataset.loadState==='loading','Picker unavailable while reading');preserved();pick('newer-invalid.msq',async()=>'<xml/>');await settle();const title=button().title;a.resolve(goodSource);await settle();preserved();assert(button().title===title&&button().dataset.loadState==='issue','Older valid read committed over newer failure');
 });
 await check('older rejection cannot clear newer loading status or retained VE state',async()=>{
  const a=deferred(),b=deferred();pick('older-reject.msq',()=>a.promise);pick('newer-pending.msq',()=>b.promise);a.reject(Error('obsolete failure'));await settle();preserved();assert(button().dataset.loadState==='loading'&&button().title.includes('newer-pending'),'Stale rejection changed status');b.reject(Error('current read failure'));await settle();preserved();
 });
 await check('rejected candidate does not cancel an in-flight VE run',async()=>{
  document.querySelector('.ve-workbench-run').click();pick('bad-during-analysis.msq',async()=>'<msq>');
  const deadline=performance.now()+30000;while(!document.querySelector('[data-ve-analyzer="stage"]').textContent.startsWith('Guarded')){assert(performance.now()<deadline,'Rejected candidate cancelled active analysis');await settle();}
  assert(button().dataset.loadState==='issue'&&JSON.stringify(snapshot())===JSON.stringify(initial),'Failed candidate changed pending analysis inputs/delay');
  [...document.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find(c=>c.title.startsWith('Measured proposal')).click();await settle();assert(!panel.hidden&&panel.querySelector('.ve-evidence-detail-grid'),'Missing completed evidence after failed candidate');
 });
 await check('latest accepted replacement invalidates once; earlier completion cannot become authoritative',async()=>{
  const older=deferred();pick('older.msq',()=>older.promise);
  const changed=goodSource.replace(/(<constant name="veTable"[^>]*>)[\s\S]*?(<\/constant>)/,(_,open,close)=>open+new Array(256).fill('72').join(' ')+close);
  pick('accepted.msq',async()=>changed);await settle();assert(button().dataset.loadState==='success'&&button().title.startsWith('accepted.msq'),'Newest candidate not accepted');
  assert(document.querySelector('[data-ve-analyzer="summary"]').textContent===''&&document.querySelector('[data-ve-analyzer="save-delay"]').disabled,'Replacement did not invalidate dependent VE session');assert(panel.hidden&&!panel.querySelector('.ve-evidence-detail-grid'),'Accepted replacement retained old popup');
  const table=document.querySelector('[data-ve-analyzer="ve-table-view"] table');assert(parseFloat(table.querySelector('td').textContent)===72,'Wrong replacement table active');
  older.resolve(goodSource);await settle();assert(button().title.startsWith('accepted.msq')&&document.querySelector('[data-ve-analyzer="ve-table-view"] table')===table,'Older completion replaced accepted tune or rebuilt again');
  document.querySelector('[data-epicscope-mode="logger"]').click();await settle();document.querySelector('[data-epicscope-mode="analyzer"]').click();await settle();assert(parseFloat(document.querySelector('[data-ve-analyzer="ve-table-view"] td').textContent)===72,'Shell authority did not retain accepted replacement');
 });
 return {passed:passed.length,checks:passed};
}
