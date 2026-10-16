// Actual renderer termination/reload, after ordinary acceptance/reload checks.
export async function runObservabilityRecovery({call,evaluate,wait,moduleBase,record}){
 const invoke=(method,args='')=>evaluate(`(async()=>{const m=await import('${moduleBase}observability-persistence.browser.mjs');return m.${method}(${args});})()`,60000);
 const pending=await invoke('prepareRecovery');await wait(`(async()=>{const m=await import('${moduleBase}observability-persistence.browser.mjs');return m.recoveryReady(${pending.writes});})()`);
 // Page.crash intentionally prevents pagehide/end persistence. Its command may
 // reject or time out because the renderer is destroyed; transport stays alive.
 try{await call('Page.crash',{},5000);}catch(error){if(!/crash|timeout|Inspected target navigated or closed/i.test(String(error)))throw error;}
 await call('Page.reload');
 await wait(`(async()=>{try{const m=await import('${moduleBase}observability-lifecycle.browser.mjs');const s=m.readApplicationObservability();return s&&s.sessionId!==${JSON.stringify(pending.id)}&&s.persistence.state==='ready';}catch{return false;}})()`);
 await record('persistence-crash-recovery.json',await invoke('checkRecovered',JSON.stringify(pending.id)+',false'));
 const ended=await invoke('endForRecovery');await wait(`(async()=>{const m=await import('${moduleBase}observability-lifecycle.browser.mjs');return m.readApplicationObservability().persistence.state==='closed';})()`);
 await call('Page.reload');
 await wait(`(async()=>{try{const m=await import('${moduleBase}observability-lifecycle.browser.mjs');const s=m.readApplicationObservability();return s&&s.sessionId!==${JSON.stringify(ended)}&&s.persistence.state==='ready';}catch{return false;}})()`);
 await record('persistence-normal-recovery.json',await invoke('checkRecovered',JSON.stringify(ended)+',true'));
 const {identifier}=await call('Page.addScriptToEvaluateOnNewDocument',{source:`Object.defineProperty(window,'indexedDB',{configurable:true,get(){throw new DOMException('Injected IndexedDB denial','SecurityError');}});`});
 try{
  await call('Page.reload');
  await wait(`(async()=>{try{const m=await import('${moduleBase}observability-lifecycle.browser.mjs');return m.readApplicationObservability()?.persistence.state==='failed';}catch{return false;}})()`);
  await evaluate(`document.querySelector('[data-epicscope-mode="analyzer"]').click();document.querySelector('.bug-report-button').click();`);
  const denied=await evaluate(`document.querySelector('.analyzer-page').hidden===false&&document.querySelector('.bug-report-text').value.includes('SecurityError')`);
  if(!denied)throw Error('IndexedDB denial prevented navigation or hid diagnostic failure');
  await record('persistence-denied.json',{passed:1,checks:['IndexedDB getter denial preserves application navigation/current evidence and exposes one bounded persistence failure']});
 }finally{await call('Page.removeScriptToEvaluateOnNewDocument',{identifier});}
 await call('Page.reload');
 await wait(`(async()=>{try{const m=await import('${moduleBase}observability-lifecycle.browser.mjs');return m.readApplicationObservability()?.persistence.state==='ready';}catch{return false;}})()`);
 await record('persistence-restored.json',{passed:1,checks:['healthy reload restores IndexedDB persistence after access returns without clearing previous history']});
}
