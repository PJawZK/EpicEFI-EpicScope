import { describe, expect, it } from 'vitest';
import { createObservabilitySession } from '../../apps/web/src/observability/session';
import { buildParserDiagnosticsReport, prepareParserDiagnostics, buildParserSessionEvidence } from '../../apps/web/src/observability/reports/parser-report';
import { recordParserEvidence } from '../../apps/web/src/observability/producers/parser';
import { parserEvidenceFixtures as fixtures } from './parser-evidence-fixtures';

describe('canonical parser evidence bridge', () => {
  it('retains the full canonical list and exact offsets/messages without mutation or truncation', () => {
    const diagnostics = Object.freeze(fixtures[3]!);
    const model = prepareParserDiagnostics(diagnostics);
    expect(model.diagnostics).toBe(diagnostics);
    const report = buildParserDiagnosticsReport(diagnostics, model);
    expect(report).toContain('界'.repeat(1000)); expect(report).toContain('occurrence 44');
    expect(model.unresolved).toHaveLength(46); expect(model.counts).toEqual({ info: 1, warning: 45, error: 1, recoverable: 46 });
  });
  it('preserves retry recovery/pattern distinctions and unresolved summary exclusions', () => {
    const model = prepareParserDiagnostics(fixtures[1]!);
    expect(model.sourceIntegrity).toEqual({ recoveredRetryArtifacts: 2, validRetryLikeRuns: 1, unrecoveredCrcRecords: 0, counterAnomalies: 0, groupedUnresolvedEvents: 0 });
    expect(model.unresolved).toHaveLength(0); expect(model.worst).toBe('warning');
  });
  it('publishes compact owner-correlated counters without serializing diagnostics', () => {
    const session = createObservabilitySession({ sessionId: 'parser' });
    const operation = session.beginOperation({ subsystem: 'source', component: 'load', name: 'source.load', origin: 'user' })!;
    recordParserEvidence(session.recorder, prepareParserDiagnostics(fixtures[3]!), { operationId: operation.id, sourceIdentity: 'actual-source-id', sourceRevision: 7 });
    operation.finish('success');
    const summary = session.recorder.snapshot().find(r => r.name === 'parser.source-integrity.summary');
    expect(summary).toMatchObject({ operationId: operation.id, sourceIdentity: 'actual-source-id', sourceRevision: 7, metadata: { total: 47, unresolved: 46, error: 1, warning: 45 } });
    expect(JSON.stringify(summary)).not.toContain('界'); expect(JSON.stringify(summary).length).toBeLessThan(2048);
    expect(session.recorder.status().rejected).toBe(0);
  });
  it('uses the latest pending/validated snapshot without double-counting a source session', () => {
    const session = createObservabilitySession({ sessionId: 'parser' });
    const context = { operationId: 'operation-A', sourceIdentity: 'source-A' };
    recordParserEvidence(session.recorder, prepareParserDiagnostics(fixtures[1]!), context);
    recordParserEvidence(session.recorder, prepareParserDiagnostics(fixtures[2]!), context);
    const report = buildParserSessionEvidence(session.recorder.snapshot());
    expect(report.match(/operation=operation-A/g)).toHaveLength(1);
    expect(report).toContain('total=4; unresolved=3; recovered=0; crc=2; counters=1');
  });
  it('keeps same-named replacement loads distinct through operation identity', () => {
    const session = createObservabilitySession({ sessionId: 'parser' });
    for (const operationId of ['load-A','load-B']) recordParserEvidence(session.recorder, prepareParserDiagnostics(fixtures[1]!), { operationId, sourceIdentity: 'same-file' });
    const report = buildParserSessionEvidence(session.recorder.snapshot());
    expect(report).toContain('operation=load-A'); expect(report).toContain('operation=load-B');
  });
  it('bounds the session projection to 20 recent sources and moves updated sources to the tail', () => {
    const session = createObservabilitySession({ sessionId: 'parser' }); const model = prepareParserDiagnostics([]);
    for (let i=0;i<30;i++) recordParserEvidence(session.recorder, model, { operationId: `load-${i}` });
    recordParserEvidence(session.recorder, model, { operationId: 'load-0' });
    const report = buildParserSessionEvidence(session.recorder.snapshot());
    expect(report.match(/operation=/g)).toHaveLength(20); expect(report).not.toContain('operation=load-10;'); expect(report).toContain('operation=load-0;');
  });
  it('does not rely on retained summaries to rebuild the complete current canonical report', () => {
    const session = createObservabilitySession({ sessionId: 'parser', maxRecords: 1 });
    const model = prepareParserDiagnostics(fixtures[3]!);
    recordParserEvidence(session.recorder, model, { operationId: 'load-A' });
    recordParserEvidence(session.recorder, prepareParserDiagnostics([]), { operationId: 'load-B' });
    expect(buildParserSessionEvidence(session.recorder.snapshot())).not.toContain('load-A');
    expect(buildParserDiagnosticsReport(model.diagnostics, model)).toContain('occurrence 44');
  });
});
