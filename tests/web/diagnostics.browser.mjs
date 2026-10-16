import { createDiagnosticsView } from '../../apps/web/src/components/diagnostics-view';
import { createDiagnosticsCapture } from '../../apps/web/src/observability/diagnostics';
import { createObservabilitySession } from '../../apps/web/src/observability/session';
import { readApplicationObservability } from './observability-lifecycle.browser.mjs';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export function runDiagnosticsChecks(){
 const checks=[],s=createObservabilitySession(),retention=s.recorder.status();let refreshed=0;
 const view=createDiagnosticsView(()=>{refreshed++;},()=>{});document.body.append(view.element);
 const records=Array.from({length:20001},(_,i)=>({schemaVersion:1,sessionId:'fixture',sequence:i+1,wallTime:1000,monotonicTime:i,recordKind:'event',subsystem:'owners',component:'fixture',name:i===0?'<img src=x onerror=alert(1)>':'analysis.started',origin:'async',priority:'normal',operationId:'op'+i,...(i?{parentOperationId:'op'+(i-1)}:{}),sourceRevision:i%2,metadata:{index:i}}));
 const capture=createDiagnosticsCapture({capturedAt:new Date().toISOString(),sessionId:'fixture',reportText:'full-report',health:{issues:[],warnings:[]},records,retention,anomalyTracking:undefined,persistence:{state:'ready',lastError:'',writes:1,lastSavedSequence:0,previous:[]},performanceReport:'exact Perf report',parserReport:'full canonical Parser '+ '界'.repeat(2000),parserDiagnostics:[{code:'CRC',severity:'error',message:'界'.repeat(2000),recoverable:false,offset:123}],resources:{incomplete:0,truncated:0,retention}});
 try{
  view.setCapture(capture);const select=view.element.querySelector('select');const lens=name=>{select.value=name;select.dispatchEvent(new Event('change'));};
  const start=performance.now();lens('Timeline');const timelineMs=performance.now()-start;
  assert(view.element.querySelectorAll('.diagnostics-records li').length===200&&view.element.querySelector('.diagnostics-page-status').textContent.includes('20001')&&!view.element.querySelector('img'),'Timeline is unbounded or interpolates HTML');
  view.element.querySelector('.diagnostics-pager button:last-child').click();assert(view.element.querySelector('ol').start===201,'Pagination lost chronology');
  checks.push('20001-record captured history renders at most 200 safe text rows and pages chronologically');
  const filter=view.element.querySelector('[aria-label="Diagnostics sourceRevision"]');filter.value='1';filter.dispatchEvent(new Event('change'));
  assert(view.element.querySelector('.diagnostics-page-status').textContent.includes('10000 matches'),'Exact revision filtering lost or invented records');
  view.element.querySelector('.diagnostics-filters button').click();lens('Operations');
  assert(view.element.querySelectorAll('.diagnostics-records li').length===200&&view.element.querySelector('li').textContent.includes('parent=root'),'Deep operation tree overflowed or lost parent identity');
  checks.push('filters and deep operation traversal reuse the capture with bounded DOM and explicit ancestry');
  for(const name of ['Health','Anomalies','Performance','Parser','Resources','Errors','Previous session','Export report'])lens(name);
  lens('Parser');assert(view.element.querySelector('pre').textContent===capture.parserReport,'Full canonical Parser text changed');
  lens('Performance');assert(view.element.querySelector('pre').textContent===capture.performanceReport,'Perf text changed');
  assert(refreshed===0&&view.getCapture()===capture,'Lens/filter interaction recollected evidence');
  view.element.querySelector('.diagnostics-toolbar button').click();assert(refreshed===1,'Explicit Refresh does not call owner once');
  checks.push('all Diagnostics lenses preserve captured Perf/complete Parser evidence and recollect only on explicit Refresh');
  return {passed:checks.length,checks,observed:{timeline20001RecordsMs:timelineMs,maxVisibleRows:200}};
 }finally{view.element.remove();}
}
export function prepareIntegratedDiagnostics(){
 const button=document.querySelector('.bug-report-button');if(button.getAttribute('aria-expanded')==='true')button.click();button.click();
 const before=readApplicationObservability(),text=document.querySelector('.bug-report-text').value;
 const select=document.querySelector('[aria-label="Diagnostics view"]');
 for(const lens of ['Health','Timeline','Operations','Anomalies','Performance','Parser','Resources','Errors','Previous session','Export report']){select.value=lens;select.dispatchEvent(new Event('change'));}
 const after=readApplicationObservability();
 assert(document.querySelector('.bug-report-text').value===text,'Switching lenses silently changed captured report');
 const inputs=records=>records.filter(r=>r.name==='logger.analysis-traces.started'||r.name==='analysis.context.changed'||r.name==='ve.analysis.started').length;
 assert(inputs(before.records)===inputs(after.records),'Diagnostics triggered domain reads/context/analysis');
 assert(before.records.at(-1).sequence===after.records.at(-1).sequence,'Presentation-only lenses recorded or reprobed evidence');
 return {sessionId:before.sessionId,reportText:text,records:before.records.length};
}
