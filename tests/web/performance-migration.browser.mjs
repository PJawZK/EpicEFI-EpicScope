import expected from '../fixtures/browser/performance-parity.json';
import { createPerformanceDiagnostics } from '../../apps/web/src/components/performance-diagnostics';
import { performanceFixtures as f } from './performance-fixtures';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export function capturePerformanceParity(){
 const view=createPerformanceDiagnostics(),root=view.element;
 view.setRuntimeMemoryProvider(()=>({activeTraceRangeBytes:123456}));
 view.recordIniLoad(f.IniLoad);view.recordBinding(f.ChannelBinding);view.recordLoad(f.Load);view.recordWorkspaceRestore(f.WorkspaceRestore);view.recordValidation(f.Validation);
 view.recordChannel(f.Channel);
 const report=view.reportText();root.querySelector('.performance-diagnostics-button').click();
 const ui=root.querySelector('.performance-content').textContent;
 assert(report===expected.report,'Perf text differs from frozen pre-migration fixture');
 assert(ui===expected.ui,'Perf UI differs from frozen pre-migration fixture');
 assert(report.includes('[Load]')&&report.includes('[INI load]')&&report.includes('[Workspace restore]')&&report.includes('[Channel selections]')&&report.includes('[Retained memory]'),'Missing Perf evidence');
 assert(report.includes('physicalReads=0; physicalBytes=0; physicalReadMs=0.00 ms'),'Cache hit misreported as physical I/O');
 root.querySelector('.performance-close').click();
 const hiddenMarkup=root.innerHTML;
 const timings=[];
 for(let j=0;j<9;j++){
  const start=performance.now();for(let i=0;i<200;i++)view.recordChannel(f.Channel);timings.push(performance.now()-start);
 }
 assert(root.innerHTML===hiddenMarkup,'Hidden performance updates rebuilt DOM');
 const coldStart=performance.now();view.reportText();const coldReportMs=performance.now()-coldStart;
 const reportStart=performance.now();for(let i=0;i<20;i++)view.reportText();const reportMs=(performance.now()-reportStart)/20;
 view.clear();assert(!view.reportText().includes('[Load]')&&!view.reportText().includes('[Channel selections]'),'Perf clear retained run history');
 view.recordChannel(f.Channel);view.recordLoad(f.Load);assert(!view.reportText().includes('[Channel selections]'),'New load retained previous channel evidence');
 return {passed:3,checks:['deterministic complete Perf report and UI fixture captured','cache-hit CPU/render evidence stays distinct from physical I/O','clear/new-load lens boundaries preserve existing semantics'],observed:{report,ui,timings,reportMs,coldReportMs}};
}

export async function runIntegratedPerformanceChecks(){
 const { readApplicationObservability } = await import('./observability-lifecycle.browser.mjs');
 const checks=[],snapshot=()=>readApplicationObservability();
 for(const kind of ['ini','load','binding','restore'])assert(snapshot().records.some(r=>r.name===`performance.${kind}`),`Missing real ${kind} performance producer`);
 checks.push('actual INI/log/binding/workspace owners publish completion metrics to the shell session');
 const contextBefore=snapshot().records.filter(r=>r.name==='analysis.context.changed').length;
 const perf=document.querySelector('.performance-diagnostics-wrap');perf.querySelector('.performance-diagnostics-button').click();
 assert(!perf.querySelector('.performance-content').hidden&&perf.querySelector('.performance-load').textContent.includes('navigation.mlg'),'Perf UI is not projected from accepted load');
 perf.querySelector('.performance-close').click();
 const reportButton=document.querySelector('.bug-report-button');reportButton.click();
 const report=document.querySelector('.bug-report-text').value;
 assert(report.includes('[Load]')&&report.includes('[INI load]')&&report.includes('[Blob source runtime]')&&report.includes('[Retained memory]')&&report.includes('[Observability session]'),'Integrated report lost source/timing/resource evidence');
 reportButton.click();
 assert(snapshot().records.filter(r=>r.name==='analysis.context.changed').length===contextBefore,'Opening Perf/report republished analysis context');
 checks.push('real Perf and Bug Report preserve load, source, resource and session evidence without context mutation');
 assert(snapshot().records.some(r=>r.name==='performance.blob')&&snapshot().records.some(r=>r.name==='performance.memory'),'Explicit report did not capture owner probes');
 assert(snapshot().health.rejected===0,'Integrated Perf metadata exceeded the record budget');
 checks.push('explicit resource probes use the common bounded stream without rejected records');
 return {passed:checks.length,checks,observed:{records:snapshot().health.records,report}};
}
