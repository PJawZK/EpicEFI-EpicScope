import { runNativeCompletionFocus } from './ve-completion-focus.mjs';
import { runDiagnosticsAcceptance } from './diagnostics.mjs';
import fs from 'node:fs/promises';

// Run against the real application shell using native file inputs.
export async function runAcceptance({ call, evaluate, file, wait, fixture, moduleBase, mode, record, log, downloadDir }) {
 async function step(label, fn) {
   log('start ' + label);
   const started = Date.now();
   const value = await fn();
   log('done ' + label, { ms: Date.now() - started });
   return value;
 }
 await record('shim-socket-ownership.json', await evaluate(`(async()=>{const m=await import('${moduleBase}shim-socket-ownership.browser.mjs');return m.runShimSocketOwnershipChecks();})()`,60000));
 await record('diagnostics-view.json', await evaluate(`(async()=>{const m=await import('${moduleBase}diagnostics.browser.mjs');return m.runDiagnosticsChecks();})()`,60000));
 await record('persistence-native.json', await evaluate(`(async()=>{const m=await import('${moduleBase}observability-persistence.browser.mjs');return m.runPersistenceChecks();})()`,60000));
 await record('anomaly-evidence.json', await evaluate(`(async()=>{const m=await import('${moduleBase}observability-anomalies.browser.mjs');return m.runAnomalyChecks();})()`,60000));
 await record('owner-evidence.json', await evaluate(`(async()=>{const m=await import('${moduleBase}owner-evidence.browser.mjs');return m.runOwnerEvidenceChecks();})()`,60000));
 await record('parser-evidence.json', await evaluate(`(async()=>{const m=await import('${moduleBase}parser-evidence.browser.mjs');return m.runParserEvidenceParity();})()`,60000));
 await record('performance-migration.json', await evaluate(`(async()=>{const m=await import('${moduleBase}performance-migration.browser.mjs');return m.capturePerformanceParity();})()`,60000));
 await record('observability-foundation.json', await evaluate(`(async()=>{const m=await import('${moduleBase}observability-foundation.browser.mjs');return m.runObservabilityFoundationChecks();})()`,60000));
 await record('presentation-ownership.json', await evaluate(`(async()=>{const m=await import('${moduleBase}presentation-ownership.browser.mjs');return m.runPresentationOwnershipChecks();})()`,60000));
 await record('ve-readiness-owner.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-readiness-owner.browser.mjs');return m.runVeReadinessOwnerChecks();})()`,60000));
 await record('histogram-math-preview.json', await evaluate(`(async()=>{const m=await import('${moduleBase}histogram-math-preview.browser.mjs');return m.runHistogramMathPreviewChecks();})()`,60000));
 await record('local-persistence.json', await evaluate(`(async()=>{const m=await import('${moduleBase}local-persistence.browser.mjs');return m.runLocalPersistenceChecks();})()`,60000));
 await record('histogram-formula.json', await evaluate(`(async()=>{const m=await import('${moduleBase}histogram-formula-pipeline.browser.mjs');return m.runHistogramFormulaPipelineChecks();})()`,60000));
 await record('mlg-integrity.json', await evaluate(`(async()=>{const m=await import('${moduleBase}mlg-integrity.browser.mjs');return m.runMlgIntegrityChecks();})()`,60000));
 await record('source-integrity-cpu.json', await evaluate(`(async()=>{const m=await import('${moduleBase}source-integrity-cpu.browser.mjs');return m.runSourceIntegrityCpuChecks();})()`,60000));
 await record('source-integrity-owner.json', await evaluate(`(async()=>{const m=await import('${moduleBase}source-integrity-owner.browser.mjs');return m.runSourceIntegrityOwnerChecks();})()`,60000));
 await record('source-integrity-marker.json', await evaluate(`(async()=>{const m=await import('${moduleBase}source-integrity-marker.browser.mjs');return m.runSourceIntegrityMarkerChecks();})()`,60000));
 await step('INI',async()=>{await file('input[accept=".ini,text/plain"]',fixture('navigation.ini'));await wait('document.querySelector(".load-ini").dataset.loadState==="success"');});
 await step('MSQ',async()=>{await file('input[accept^=".msq"]',fixture('audit.msq'));await wait('document.querySelector(".load-msq").dataset.loadState==="success"');});
 await step('MLG',async()=>{await file('input[accept^=".mlg"]',fixture('navigation.mlg'));await wait(mode === 'staged' ? 'document.querySelector(".parser-status").textContent.includes("CRC validated")' : 'document.querySelector(".open-log").dataset.loadState==="success"');});
 const authorityInputs = {iniSource: await fs.readFile(fixture('navigation.ini'), 'utf8'), msqSource: await fs.readFile(fixture('audit.msq'), 'utf8')};
 await record('ini-table-authority.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ini-table-authority.browser.mjs');return m.runIniTableAuthorityChecks(${JSON.stringify(authorityInputs)});})()`,60000));
 await step('Analyzer click',()=>evaluate('document.querySelector("[data-epicscope-mode=analyzer]").click()'));
 await step('VE select',()=>evaluate('(()=>{const s=document.querySelector(".analyzer-header-view-select");s.value="ve";s.dispatchEvent(new Event("change",{bubbles:true}));return document.querySelector("[data-ve-analyzer=stage]").textContent;})()'));
 const select=async(selector,value)=>evaluate(`(()=>{const s=document.querySelector(${JSON.stringify(selector)});s.value=${JSON.stringify(value)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await select('.ve-analyzer-view select[data-role=load]','ini:map');
 await file('input[data-ve-analyzer="load-delay-file"]',fixture('delay.json'));
 await wait('!document.querySelector(".ve-workbench-run").disabled');
 await step('edit delay',()=>evaluate(`(()=>{document.querySelector('.ve-v50-lambda-tool-trigger').click();const cell=document.querySelector('[data-delay-row="0"][data-delay-col="0"]');cell.focus();cell.dispatchEvent(new KeyboardEvent('keydown',{key:'F2',bubbles:true,cancelable:true}));const input=document.querySelector('.ve-table-inline-input');if(!input)throw Error('Shared delay editor did not open');input.value='125';input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));})()`));
 await step('Run Analysis', async () => record('ve-completion-shell.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-completion-contract.browser.mjs');return m.runVeShellCompletionChecks();})()`,60000)));
 await runDiagnosticsAcceptance({call,evaluate,wait,moduleBase,downloadDir,record});
 await record('anomaly-integrated.json', await evaluate(`(async()=>{const m=await import('${moduleBase}observability-anomalies.browser.mjs');return m.runIntegratedAnomalyChecks();})()`,60000));
 await record('owner-integrated.json', await evaluate(`(async()=>{const m=await import('${moduleBase}owner-evidence.browser.mjs');return m.runIntegratedOwnerEvidence();})()`,60000));
 await record('parser-integrated.json', await evaluate(`(async()=>{const m=await import('${moduleBase}parser-evidence.browser.mjs');return m.runIntegratedParserEvidence();})()`,60000));
 await record('performance-integrated.json', await evaluate(`(async()=>{const m=await import('${moduleBase}performance-migration.browser.mjs');return m.runIntegratedPerformanceChecks();})()`,60000));
 const goodSource=await fs.readFile(fixture('audit.msq'),'utf8');
 const result=await evaluate(`(async()=>{const m=await import('${moduleBase}msq-replacement.browser.mjs');return m.runMsqReplacementChecks(${JSON.stringify(goodSource)});})()`,60000);
 log('replacement checks',{result});await record('replacement-result.json',result);
 const inputs = { msqSource: goodSource, iniSource: await fs.readFile(fixture('navigation.ini'),'utf8'), mlgBase64: (await fs.readFile(fixture('navigation.mlg'))).toString('base64') };
 const publication=await evaluate(`(async()=>{const m=await import('${moduleBase}accepted-input-publication.browser.mjs');return m.runAcceptedInputPublicationChecks(${JSON.stringify(inputs)});})()`,120000);
 log('publication checks',{result:publication});await record('publication-result.json',publication);
 const lifecycle=await evaluate(`(async()=>{const m=await import('${moduleBase}ve-analyzer-lifecycle.browser.mjs');return m.runVeAnalyzerLifecycleChecks();})()`,60000);
 log('lifecycle checks',{result:lifecycle});await record('lifecycle-result.json',lifecycle);
 await record('ve-editing-retention.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-editing-retention.browser.mjs');return m.runVeEditingRetentionChecks();})()`,60000));
 await record('ve-numerical-boundaries.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-numerical-boundaries.browser.mjs');return m.runVeNumericalBoundaryChecks();})()`,60000));
 await record('ve-completion-summary.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-completion-summary.browser.mjs');return m.runVeCompletionSummaryChecks();})()`,60000));
 await record('ve-completion-focus-native.json', await runNativeCompletionFocus({ call, evaluate, moduleBase }));
 await record('ve-completion-focus.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-completion-focus.browser.mjs');return m.runVeCompletionFocusChecks();})()`,60000));
 await record('ve-view-proposal.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-view-proposal.browser.mjs');return m.runVeViewProposalChecks();})()`,60000));
 await record('ve-delay-workflow.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-delay-workflow.browser.mjs');return m.runVeDelayWorkflowChecks();})()`,60000));
 await record('ve-delay-replacement.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-delay-replacement.browser.mjs');return m.runVeDelayReplacementChecks();})()`,60000));
 await record('ve-authority.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-authority.browser.mjs');return m.runVeAuthorityChecks();})()`,60000));
 const contexts=await evaluate(`(async()=>{const m=await import('${moduleBase}logger-analysis-context.browser.mjs');return m.runLoggerAnalysisContextChecks();})()`,60000);
 log('context checks',{result:contexts});await record('context-result.json',contexts);
 const activity=await evaluate(`(async()=>{const m=await import('${moduleBase}analyzer-activity.browser.mjs');return m.runAnalyzerActivityChecks();})()`,60000);
 log('activity checks',{result:activity});await record('activity-result.json',activity);
 const delayEdits=await evaluate(`(async()=>{const m=await import('${moduleBase}ve-delay-editing.browser.mjs');return m.runVeDelayEditingChecks();})()`,60000);
 log('delay edit checks',{result:delayEdits});await record('delay-edit-result.json',delayEdits);
 await record('ve-cpu-reuse.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-cpu-reuse.browser.mjs');return m.runVeCpuReuseChecks();})()`,60000));
 await record('ve-presentation-lifetime.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-presentation-lifetime.browser.mjs');return m.runVePresentationLifetimeChecks();})()`,60000));
 await record('ve-history-policy.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-history-policy.browser.mjs');return m.runVeHistoryPolicyChecks();})()`,60000));
 await record('ve-group3.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-group3.browser.mjs');return m.runVeGroup3Checks();})()`,60000));
 await record('ve-lambda-render.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-lambda-render.browser.mjs');return m.runVeLambdaRenderChecks();})()`,60000));
 await record('ve-target-render.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-target-render.browser.mjs');return m.runVeTargetRenderChecks();})()`,60000));
 await record('ve-result-projection.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-result-projection.browser.mjs');return m.runVeResultProjectionChecks();})()`,60000));
 await record('ve-table-layout.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-table-layout.browser.mjs');return m.runVeTableLayoutChecks();})()`,60000));
 await record('ve-transient-editing.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-transient-editing.browser.mjs');return m.runVeTransientEditingChecks();})()`,60000));
 const sharedDelayEdits=await evaluate(`(async()=>{const m=await import('${moduleBase}ve-shared-table-interaction.browser.mjs');return m.runVeSharedTableInteractionChecks();})()`,60000);
 log('shared delay interaction checks',{result:sharedDelayEdits});await record('shared-delay-interaction-result.json',sharedDelayEdits);
 const proposalEdits=await evaluate(`(async()=>{const m=await import('${moduleBase}ve-proposal-table-interaction.browser.mjs');return m.runVeProposalTableInteractionChecks();})()`,60000);
 log('VE Proposal interaction checks',{result:proposalEdits});await record('ve-proposal-interaction-result.json',proposalEdits);

 // Focus the real application shell before geometry assertions. Focused component
 // fixtures above intentionally create/remove their own Analyzer roots and may leave
 // the shell on another Analyzer domain.
 await evaluate(`(()=>{const mode=document.querySelector('[data-epicscope-mode=analyzer]');mode?.click();const s=document.querySelector('.analyzer-header-view-select');if(!s)throw Error('Analyzer domain selector missing before responsive acceptance');s.value='ve';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(`!!document.querySelector('.analyzer-page:not([hidden]) .ve-analyzer-view.ve-v50-port:not([hidden])')`);
 // Publication/replacement fixtures above can intentionally leave the shell with
 // a new tune and no remembered VE table. Select the first real table candidate so
 // responsive acceptance measures the actual rendered work surface, not an empty
 // "No table selected" placeholder.
 await evaluate(`(()=>{const root=document.querySelector('.analyzer-page:not([hidden]) .ve-analyzer-view.ve-v50-port:not([hidden])');for(const role of ['ve-table','target-table']){const s=root?.querySelector('select[data-role="'+role+'"]');if(!s)continue;const option=[...s.options].find(o=>o.value);if(option&&s.value!==option.value){s.value=option.value;s.dispatchEvent(new Event('change',{bubbles:true}));}}})()`);
 await wait(`!!document.querySelector('.analyzer-page:not([hidden]) .ve-analyzer-view.ve-v50-port:not([hidden]) .ve-workbench-table td')`);

 for (const width of [1024,1366,1920]) {
   await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
   const responsive = await evaluate(`(async()=>{const m=await import('${moduleBase}ve-v50-responsive.browser.mjs');return m.runVeV50ResponsiveChecks(${width});})()`,60000);
   await record(`ve-v50-responsive-${width}.json`, responsive);
   await fs.mkdir(downloadDir, { recursive: true });
   const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
   await fs.writeFile(`${downloadDir}/ve-v50-${width}.png`, Buffer.from(screenshot.data, 'base64'));
 }
 await call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });

 await record('result-view.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-analyzer-result-view.browser.mjs');return m.runVeAnalyzerResultViewChecks();})()`,60000));
 // Final integration gate: native shell import -> authoritative Parser state ->
 // captured JSON/ZIP, then real source replacement withdraws old findings.
 for (const corrupt of [true, false]) {
   const name = await evaluate(`(async()=>{const m=await import('${moduleBase}source-integrity-integrated.browser.mjs');return m.loadIntegrityAcceptanceFile(${corrupt});})()`);
   await wait(`document.querySelector('.loaded-log strong').textContent===${JSON.stringify(name)}&&['success','issue'].includes(document.querySelector('.open-log').dataset.loadState)`);
   const prefix = corrupt ? 'integrity-source-' : 'integrity-replacement-';
   const captured = await runDiagnosticsAcceptance({call,evaluate,wait,moduleBase,downloadDir:downloadDir+'-'+prefix,record:(name,result)=>record(prefix+name,result)});
   const crc = captured.parserDiagnostics.filter(d=>d.code==='mlg-crc-retry-recovered'||d.code==='mlg-crc-mismatch');
   if (corrupt) {
     if(crc.length!==2||crc.some(d=>!Number.isFinite(d.timeMs))||crc[0].sourceIntegrity?.kind!=='recovered-retry'||crc[0].sourceIntegrity.breaksContinuity!==false||crc[1].sourceIntegrity?.kind!=='corrupt-record'||crc[1].sourceIntegrity.breaksContinuity!==true)throw Error('Actual shell lost CRC source times/semantics in exported capture');
   } else if(crc.length!==0)throw Error('Clean replacement exported obsolete source CRC evidence');
   await record(prefix+'acceptance.json',{passed:1,checks:[corrupt?'actual shell MLG import and native Diagnostics ZIP retain recovered/corrupt source times and semantics':'clean source replacement withdraws prior CRC findings from native Diagnostics ZIP'],observed:{name,crc}});
 }

}
