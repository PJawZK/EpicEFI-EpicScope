import fs from 'node:fs/promises';

// Run against the real application shell using native file inputs.
export async function runAcceptance({ call, evaluate, file, wait, fixture, moduleBase, mode, record, log }) {
 async function step(label, fn) {
   log('start ' + label);
   const started = Date.now();
   const value = await fn();
   log('done ' + label, { ms: Date.now() - started });
   return value;
 }
 await record('histogram-math-preview.json', await evaluate(`(async()=>{const m=await import('${moduleBase}histogram-math-preview.browser.mjs');return m.runHistogramMathPreviewChecks();})()`,60000));
 await record('histogram-formula.json', await evaluate(`(async()=>{const m=await import('${moduleBase}histogram-formula-pipeline.browser.mjs');return m.runHistogramFormulaPipelineChecks();})()`,60000));
 await record('source-integrity-marker.json', await evaluate(`(async()=>{const m=await import('${moduleBase}source-integrity-marker.browser.mjs');return m.runSourceIntegrityMarkerChecks();})()`,60000));
 await step('INI',async()=>{await file('input[accept=".ini,text/plain"]',fixture('navigation.ini'));await wait('document.querySelector(".load-ini").dataset.loadState==="success"');});
 await step('MSQ',async()=>{await file('input[accept^=".msq"]',fixture('audit.msq'));await wait('document.querySelector(".load-msq").dataset.loadState==="success"');});
 await step('MLG',async()=>{await file('input[accept^=".mlg"]',fixture('navigation.mlg'));await wait(mode === 'staged' ? 'document.querySelector(".parser-status").textContent.includes("CRC validated")' : 'document.querySelector(".open-log").dataset.loadState==="success"');});
 await step('Analyzer click',()=>evaluate('document.querySelector("[data-epicscope-mode=analyzer]").click()'));
 await step('VE select',()=>evaluate('(()=>{const s=document.querySelector(".analyzer-header-view-select");s.value="ve";s.dispatchEvent(new Event("change",{bubbles:true}));return document.querySelector("[data-ve-analyzer=stage]").textContent;})()'));
 const select=async(selector,value)=>evaluate(`(()=>{const s=document.querySelector(${JSON.stringify(selector)});s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await select('.ve-analyzer-view select[data-role=load]','ini:map');
 await file('input[data-ve-analyzer="load-delay-file"]',fixture('delay.json'));
 await wait('!document.querySelector(".ve-workbench-run").disabled');
 await step('edit delay',()=>evaluate(`(()=>{const cell=document.querySelector('[data-delay-row="0"][data-delay-col="0"]');cell.onclick.call(cell,new PointerEvent('click'));document.querySelector('[data-ve-analyzer="delay-cell-working"]').value='125';document.querySelector('[data-ve-analyzer="delay-cell-apply"]').click();})()`));
 await step('Run Analysis',async()=>{await evaluate('document.querySelector(".ve-workbench-run").click()',60000);await wait('document.querySelector("[data-ve-analyzer=stage]").textContent.startsWith("Guarded")');});
 const goodSource=await fs.readFile(fixture('audit.msq'),'utf8');
 const result=await evaluate(`(async()=>{const m=await import('${moduleBase}msq-replacement.browser.mjs');return m.runMsqReplacementChecks(${JSON.stringify(goodSource)});})()`,60000);
 log('replacement checks',{result});await record('replacement-result.json',result);
 const inputs = { msqSource: goodSource, iniSource: await fs.readFile(fixture('navigation.ini'),'utf8'), mlgBase64: (await fs.readFile(fixture('navigation.mlg'))).toString('base64') };
 const publication=await evaluate(`(async()=>{const m=await import('${moduleBase}accepted-input-publication.browser.mjs');return m.runAcceptedInputPublicationChecks(${JSON.stringify(inputs)});})()`,120000);
 log('publication checks',{result:publication});await record('publication-result.json',publication);
 const lifecycle=await evaluate(`(async()=>{const m=await import('${moduleBase}ve-analyzer-lifecycle.browser.mjs');return m.runVeAnalyzerLifecycleChecks();})()`,60000);
 log('lifecycle checks',{result:lifecycle});await record('lifecycle-result.json',lifecycle);
 const contexts=await evaluate(`(async()=>{const m=await import('${moduleBase}logger-analysis-context.browser.mjs');return m.runLoggerAnalysisContextChecks();})()`,60000);
 log('context checks',{result:contexts});await record('context-result.json',contexts);
 const activity=await evaluate(`(async()=>{const m=await import('${moduleBase}analyzer-activity.browser.mjs');return m.runAnalyzerActivityChecks();})()`,60000);
 log('activity checks',{result:activity});await record('activity-result.json',activity);
 const delayEdits=await evaluate(`(async()=>{const m=await import('${moduleBase}ve-delay-editing.browser.mjs');return m.runVeDelayEditingChecks();})()`,60000);
 log('delay edit checks',{result:delayEdits});await record('delay-edit-result.json',delayEdits);

 await record('result-view.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-analyzer-result-view.browser.mjs');return m.runVeAnalyzerResultViewChecks();})()`,60000));
}
