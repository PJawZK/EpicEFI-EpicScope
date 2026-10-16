import { createLoggerPage } from '../../apps/web/src/pages/logger-page';
const assert = (ok, message) => { if (!ok) throw Error(message); };
export async function runSourceIntegrityOwnerChecks() {
  const checks = [], logger = createLoggerPage(), other = createLoggerPage();
  document.body.append(logger.element, other.element);
  const data = { sampleCount: 0, async readChannelRange() { throw Error('No source reads expected'); } };
  const identity = () => ({ id: 'reused-id', displayName: 'Example', format: 'MLG', sizeBytes: 0 });
  const a = identity(), b = identity();
  const diagnostic = message => [{ code: 'mlg-crc-mismatch', severity: 'warning', message, recoverable: true, timeMs: 0, sourceIntegrity: { kind: 'corrupt-record', breaksContinuity: true } }];
  const old = diagnostic('old'), current = diagnostic('current');
  const summary = (source, diagnostics) => ({ source, channels: [], diagnostics, markers: [] });
  try {
    logger.setLog(summary(a, old), 0, data);
    logger.setLog(summary(b, current), 0, { ...data });
    logger.setDiagnostics(old, a);
    assert(logger.getParserDiagnosticsEvidence() === current, 'Same-ID obsolete source replaced current evidence');
    await logger.restoreWorkspaceState(logger.getWorkspaceState());
    assert(logger.getParserDiagnosticsEvidence() === current, 'Workspace restore lost current evidence');
    checks.push('Logger rejects obsolete same-ID source identities and retains evidence through workspace restore');
    other.setLog(summary(a, old), 0, data);
    other.setDiagnostics([]);
    assert(logger.getParserDiagnosticsEvidence() === current, 'Separate Logger owner changed current evidence');
    logger.setImportError('unloaded');
    const unloaded = logger.getParserDiagnosticsEvidence();
    logger.setDiagnostics(current, b);
    assert(logger.getParserDiagnosticsEvidence() === unloaded, 'Unloaded Logger accepted obsolete source evidence');
    checks.push('separate Logger owners are isolated and unload rejects delayed source evidence');
    logger.disposeSourceIntegrity();
    logger.disposeSourceIntegrity();
    logger.setDiagnostics(current);
    assert(logger.getParserDiagnosticsEvidence() === unloaded, 'Disposed Logger accepted delayed integrity update');
    checks.push('integrity disposal is idempotent and rejects delayed owner updates');
    return { passed: checks.length, checks };
  } finally {
    logger.disposeSourceIntegrity(); other.disposeSourceIntegrity();
    logger.element.remove(); other.element.remove();
  }
}
