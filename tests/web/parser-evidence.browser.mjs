import expected from '../fixtures/browser/parser-evidence-parity.json';
const assert=(ok,message)=>{if(!ok)throw Error(message);};
import { createParserDiagnosticsIndicator } from '../../apps/web/src/components/parser-diagnostics-indicator';
import { buildParserDiagnosticsReport } from '../../apps/web/src/observability/reports/parser-report';
import { parserEvidenceFixtures } from './parser-evidence-fixtures';
export function runParserEvidenceParity(){
 const observed=parserEvidenceFixtures.map(diagnostics=>{const view=createParserDiagnosticsIndicator();view.setDiagnostics(diagnostics);assert(view.reportText()===buildParserDiagnosticsReport(diagnostics),'Owner report projection differs from canonical formatter');return {report:buildParserDiagnosticsReport(diagnostics),ui:view.element.textContent,className:view.element.querySelector('.parser-indicator').className};});
 assert(JSON.stringify(observed)===JSON.stringify(expected),'Parser text/UI/severity differs from pre-migration fixture');
 return {passed:observed.length,checks:observed.map((_,i)=>`parser report/UI fixture ${i} captured`),observed};
}

export async function runIntegratedParserEvidence(){
 const { readApplicationObservability } = await import('./observability-lifecycle.browser.mjs');
 const snapshot=()=>readApplicationObservability();
 const records=snapshot().records,summary=records.filter(r=>r.name==='parser.source-integrity.summary'&&r.operationId).at(-1);
 assert(summary?.sourceIdentity,'Accepted parser summary lacks actual source identity');
 const start=records.find(r=>r.name==='source.load.started'&&r.operationId===summary.operationId);
 const end=records.find(r=>r.name==='source.load.completed'&&r.operationId===summary.operationId);
 assert(start&&end?.outcome==='success','Parser evidence is not correlated with the completed real file load');
 const button=document.querySelector('.bug-report-button');button.click();const text=document.querySelector('.bug-report-text').value;button.click();
 assert(text.includes('EpicScope parser diagnostics')&&text.includes('[All diagnostics]')&&text.includes('[Parser/source integrity session]')&&text.includes(summary.operationId),'Unified Bug Report lost canonical/parser correlation evidence');
 return {passed:2,checks:['real indexed/validated or fallback parser findings correlate to their actual source load operation','Bug Report combines complete current canonical diagnostics and compact correlated session evidence'],observed:{sourceIdentity:summary.sourceIdentity,operationId:summary.operationId,summary:summary.metadata,report:text}};
}
