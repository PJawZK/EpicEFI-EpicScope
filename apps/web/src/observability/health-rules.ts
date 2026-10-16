/** Compact structural health input; no dependency on Logger implementation or domain arrays. */
export interface HealthSnapshot {
  readonly hasChannelDataSource: boolean;
  readonly channelDefinitionCount: number;
  readonly catalogChannelCount: number;
  readonly renderableAssignedChannelCount: number;
  readonly unavailableAssignedChannelCount: number;
  readonly activeTraceCount: number;
}
export interface HealthContext {
  readonly logLoaded: boolean;
  readonly iniLoaded: boolean;
  readonly bindingActive: boolean;
  readonly runtimeErrorCount: number;
}
export interface HealthFinding {
  readonly code: string;
  readonly severity: 'error' | 'warning';
  readonly message: string;
}
/** Existing health policy, in its original order. Formatters do not define rule identity. */
export function evaluateHealthRules(snapshot: HealthSnapshot, context: HealthContext): readonly HealthFinding[] {
  const findings: HealthFinding[] = [];

  if (context.logLoaded && !snapshot.hasChannelDataSource) {
    findings.push({ code: 'logger.missing-source', severity: 'error', message: 'Log is loaded but Logger has no channel data source.' });
  }
  if (context.logLoaded && snapshot.channelDefinitionCount === 0) {
    findings.push({ code: 'logger.missing-channels', severity: 'error', message: 'Log is loaded but Logger has zero channel definitions.' });
  }
  if (
    context.logLoaded
    && snapshot.renderableAssignedChannelCount > 0
    && snapshot.activeTraceCount < snapshot.renderableAssignedChannelCount
  ) {
    findings.push({ code: 'logger.missing-traces', severity: 'error', message: `${snapshot.renderableAssignedChannelCount - snapshot.activeTraceCount} of `
      + `${snapshot.renderableAssignedChannelCount} renderable channels assigned to visible panes are not active.` });
  }
  if (context.logLoaded && snapshot.unavailableAssignedChannelCount > 0) {
    findings.push({ code: 'logger.unavailable-channels', severity: 'warning', message: `${snapshot.unavailableAssignedChannelCount} assigned visible-pane channel(s) are unavailable in the current log.` });
  }
  if (context.logLoaded && snapshot.activeTraceCount > snapshot.renderableAssignedChannelCount) {
    findings.push({ code: 'logger.excess-traces', severity: 'warning', message: 'Active trace count exceeds renderable assigned visible-channel count.' });
  }
  if (context.runtimeErrorCount > 0) {
    findings.push({ code: 'runtime.errors', severity: 'error', message: `${context.runtimeErrorCount} runtime error/unhandled rejection event(s) captured.` });
  }
  if (
    context.logLoaded
    && context.iniLoaded
    && !context.bindingActive
    && snapshot.channelDefinitionCount !== snapshot.catalogChannelCount
  ) {
    findings.push({ code: 'logger.missing-binding', severity: 'warning', message: 'INI catalog and log are loaded but no current INI/MLG binding is recorded.' });
  }

  return findings;
}

/** Current presentation shared by badge and explicit capture; never records/polls history. */
export function projectCurrentHealth(snapshot: HealthSnapshot, context: HealthContext) {
  const findings = evaluateHealthRules(snapshot, context);
  return {
    issues: findings.filter(f => f.severity === 'error').map(f => f.message),
    warnings: findings.filter(f => f.severity === 'warning').map(f => f.message),
  };
}
