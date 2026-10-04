import type { LoggerRuntimeDiagnosticSnapshot } from '../pages/logger-page';
import type { LoggerWorkspaceState } from '../state/workspace-state';

export interface BugReportRuntimeErrorEntry {
  readonly time: number;
  readonly kind: 'error' | 'unhandledrejection';
  readonly message: string;
  readonly source?: string;
  readonly line?: number;
  readonly column?: number;
  readonly stack?: string;
}

export interface BugReportSourceContext {
  readonly logLoaded: boolean;
  readonly logName?: string;
  readonly logSizeBytes?: number;
  readonly recordCount: number;
  readonly logChannelCount: number;
  readonly dataSourceSamples: number;
  readonly iniLoaded: boolean;
  readonly iniSourceName?: string;
  readonly iniCatalogEntries: number;
  readonly bindingActive: boolean;
  readonly bindingMetrics?: {
    readonly boundChannelCount: number;
    readonly knownNoDataCount: number;
    readonly logOnlyCount: number;
    readonly ambiguousLogChannelCount: number;
  };
}

export interface BugReportApplicationContext {
  readonly generatedAtIso: string;
  readonly url: string;
  readonly userAgent: string;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly devicePixelRatio: number;
  readonly documentVisibility: string;
  readonly online: boolean;
  readonly hardwareConcurrency?: number;
  readonly appStatus: string;
  readonly parserStatus: string;
  readonly openLogState: string;
  readonly openLogTitle: string;
  readonly loadIniState: string;
  readonly loadIniTitle: string;
}

export interface BuildBugReportInput {
  readonly snapshot: LoggerRuntimeDiagnosticSnapshot;
  readonly workspaceState: LoggerWorkspaceState;
  readonly issues: readonly string[];
  readonly warnings: readonly string[];
  readonly source: BugReportSourceContext;
  readonly runtimeErrors: readonly BugReportRuntimeErrorEntry[];
  readonly application: BugReportApplicationContext;
  readonly performanceReport: string;
}

export interface BuiltBugReport {
  readonly text: string;
  readonly issueCount: number;
}

export function buildBugReportText(input: BuildBugReportInput): BuiltBugReport {
  const {
    snapshot,
    workspaceState,
    issues,
    warnings,
    source,
    runtimeErrors,
    application,
    performanceReport,
  } = input;
  const lines = [
    'EpicScope runtime bug report',
    `Generated: ${application.generatedAtIso}`,
    `URL: ${application.url}`,
    `User agent: ${application.userAgent}`,
    `Viewport: ${application.viewportWidth}x${application.viewportHeight} @ DPR ${application.devicePixelRatio}`,
    `Document visibility: ${application.documentVisibility}`,
    `Online: ${application.online ? 'yes' : 'no'}`,
    `CPU threads: ${application.hardwareConcurrency || 'unknown'}`,
    '',
    `[Health] ${issues.length} ISSUE / ${warnings.length} WARN`,
    ...issues.map((item) => `ISSUE | ${item}`),
    ...warnings.map((item) => `WARN | ${item}`),
    ...(issues.length === 0 && warnings.length === 0 ? ['PASS | No obvious runtime-state inconsistency detected.'] : []),
    '',
    '[Source]',
    `logLoaded=${source.logLoaded ? 'yes' : 'no'}`,
    `logName=${source.logName ?? '—'}`,
    `logSize=${source.logSizeBytes ?? '—'}`,
    `records=${source.recordCount}`,
    `logChannels=${source.logChannelCount}`,
    `dataSourceSamples=${source.dataSourceSamples}`,
    `iniLoaded=${source.iniLoaded ? 'yes' : 'no'}`,
    `iniSource=${source.iniSourceName ?? '—'}`,
    `iniCatalogEntries=${source.iniCatalogEntries}`,
    `bindingActive=${source.bindingActive ? 'yes' : 'no'}`,
    ...(source.bindingMetrics ? [
      `bindingBound=${source.bindingMetrics.boundChannelCount}`,
      `bindingKnownNoData=${source.bindingMetrics.knownNoDataCount}`,
      `bindingLogOnly=${source.bindingMetrics.logOnlyCount}`,
      `bindingAmbiguous=${source.bindingMetrics.ambiguousLogChannelCount}`,
    ] : []),
    '',
    '[Logger runtime]',
    `hasChannelDataSource=${snapshot.hasChannelDataSource}`,
    `channelDefinitions=${snapshot.channelDefinitionCount}`,
    `catalogChannels=${snapshot.catalogChannelCount}`,
    `unavailableChannels=${snapshot.unavailableChannelCount}`,
    `channelAliases=${snapshot.aliasCount}`,
    `workspaceCount=${snapshot.workspaceCount}`,
    `activeWorkspace=${snapshot.activeWorkspaceId}`,
    `restoringWorkspace=${snapshot.restoringWorkspaceState}`,
    `visiblePanes=${snapshot.visiblePaneCount}`,
    `assignedVisibleChannels=${snapshot.assignedChannelCount}`,
    `renderableAssignedVisibleChannels=${snapshot.renderableAssignedChannelCount}`,
    `unavailableAssignedVisibleChannels=${snapshot.unavailableAssignedChannelCount}`,
    `activeVisibleTraces=${snapshot.activeTraceCount}`,
    ...snapshot.panes.map((pane) =>
      `pane=${pane.id}; visible=${pane.visible}; assigned=[${pane.assignedChannelIds.join(',')}]; `
      + `renderable=[${pane.renderableAssignedChannelIds.join(',')}]; `
      + `unavailable=[${pane.unavailableAssignedChannelIds.join(',')}]; active=[${pane.activeChannelIds.join(',')}]`
    ),
    '',
    '[Workspace state]',
    JSON.stringify(workspaceState, null, 2),
    '',
    `[Runtime errors] ${runtimeErrors.length}`,
    ...runtimeErrors.flatMap((item) => [
      `${new Date(item.time).toISOString()} ${item.kind.toUpperCase()} ${item.message}${item.source ? ` · ${item.source}:${item.line ?? 0}:${item.column ?? 0}` : ''}`,
      ...(item.stack ? [item.stack] : []),
    ]),
    '',
    '[Application status]',
    `appStatus=${application.appStatus}`,
    `parserStatus=${application.parserStatus}`,
    `openLogState=${application.openLogState}`,
    `openLogTitle=${application.openLogTitle}`,
    `loadIniState=${application.loadIniState}`,
    `loadIniTitle=${application.loadIniTitle}`,
    '',
    performanceReport,
  ];

  return { text: lines.join('\n'), issueCount: issues.length };
}
