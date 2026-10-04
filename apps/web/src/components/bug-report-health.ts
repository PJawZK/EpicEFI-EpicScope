import type { LoggerRuntimeDiagnosticSnapshot } from '../pages/logger-page';

export interface BugReportHealthContext {
  readonly logLoaded: boolean;
  readonly iniLoaded: boolean;
  readonly bindingActive: boolean;
  readonly runtimeErrorCount: number;
}

export interface BugReportHealth {
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
}

export function evaluateBugReportHealth(
  snapshot: LoggerRuntimeDiagnosticSnapshot,
  context: BugReportHealthContext,
): BugReportHealth {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (context.logLoaded && !snapshot.hasChannelDataSource) {
    issues.push('Log is loaded but Logger has no channel data source.');
  }
  if (context.logLoaded && snapshot.channelDefinitionCount === 0) {
    issues.push('Log is loaded but Logger has zero channel definitions.');
  }
  if (
    snapshot.renderableAssignedChannelCount > 0
    && snapshot.activeTraceCount < snapshot.renderableAssignedChannelCount
  ) {
    issues.push(
      `${snapshot.renderableAssignedChannelCount - snapshot.activeTraceCount} of `
      + `${snapshot.renderableAssignedChannelCount} renderable channels assigned to visible panes are not active.`,
    );
  }
  if (snapshot.unavailableAssignedChannelCount > 0) {
    warnings.push(
      `${snapshot.unavailableAssignedChannelCount} assigned visible-pane channel(s) are unavailable in the current log.`,
    );
  }
  if (snapshot.activeTraceCount > snapshot.renderableAssignedChannelCount) {
    warnings.push('Active trace count exceeds renderable assigned visible-channel count.');
  }
  if (context.runtimeErrorCount > 0) {
    issues.push(`${context.runtimeErrorCount} runtime error/unhandled rejection event(s) captured.`);
  }
  if (context.logLoaded && context.iniLoaded && !context.bindingActive) {
    warnings.push('INI catalog and log are loaded but no current INI/MLG binding is recorded.');
  }

  return { issues, warnings };
}
