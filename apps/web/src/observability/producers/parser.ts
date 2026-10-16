import type { ObservabilityRecorder } from '../recorder';
import type { ParserDiagnosticsModel } from '../reports/parser-report';

export interface ParserEvidenceContext {
  readonly sourceIdentity?: string;
  readonly operationId?: string;
  readonly sourceRevision?: number;
}

/** The full ParserDiagnostic list remains canonical at its owner. This stream is
 * compact, correlated summary evidence, never a replacement/truncated parser list.
 */
export function recordParserEvidence(recorder: ObservabilityRecorder, model: ParserDiagnosticsModel, context: ParserEvidenceContext): void {
  recorder.record({ ...context, recordKind: 'snapshot', subsystem: 'parser', component: 'source-integrity', name: 'parser.source-integrity.summary', origin: 'system',
    metadata: { total: model.diagnostics.length, unresolved: model.unresolved.length, ...model.counts, ...model.sourceIntegrity },
  });
}

