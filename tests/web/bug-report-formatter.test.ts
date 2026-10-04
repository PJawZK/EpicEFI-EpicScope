import { describe, expect, it } from 'vitest';

import type { LoggerRuntimeDiagnosticSnapshot } from '../../apps/web/src/pages/logger-page';
import type { LoggerWorkspaceState } from '../../apps/web/src/state/workspace-state';
import { buildBugReportText } from '../../apps/web/src/components/bug-report-formatter';

const snapshot: LoggerRuntimeDiagnosticSnapshot = {
  hasChannelDataSource: true,
  channelDefinitionCount: 3,
  catalogChannelCount: 4,
  unavailableChannelCount: 1,
  aliasCount: 2,
  activeWorkspaceId: 'workspace-1',
  workspaceCount: 2,
  restoringWorkspaceState: false,
  visiblePaneCount: 1,
  assignedChannelCount: 2,
  renderableAssignedChannelCount: 1,
  unavailableAssignedChannelCount: 1,
  activeTraceCount: 1,
  panes: [{
    id: 'pane-1',
    visible: true,
    assignedChannelIds: ['ini:RPMValue', 'ini:missing'],
    renderableAssignedChannelIds: ['ini:RPMValue'],
    unavailableAssignedChannelIds: ['ini:missing'],
    activeChannelIds: ['ini:RPMValue'],
  }],
};

const workspaceState: LoggerWorkspaceState = {
  activeWorkspaceId: 'workspace-1',
  workspaces: [{
    id: 'workspace-1',
    name: 'Workspace 1',
    channelIds: ['ini:RPMValue'],
    viewport: undefined,
    cursorTimeMs: 0,
    viewHistory: [],
    viewHistoryIndex: -1,
  }],
  timeline: {
    expanded: true,
    userMarkers: [],
    aTimeMs: undefined,
    bTimeMs: undefined,
    savedRanges: [],
  },
  inspector: {
    visible: true,
    favoriteChannelIds: [],
    recentChannelIds: [],
    searchQuery: '',
    selectedGroup: 'All',
    visibilityFilter: 'all',
    sortKey: 'name',
    sortAscending: true,
  },
};

describe('bug report formatter', () => {
  it('serializes health, source, logger, errors, app status and performance evidence', () => {
    const report = buildBugReportText({
      snapshot,
      workspaceState,
      issues: ['One issue'],
      warnings: ['One warning'],
      source: {
        logLoaded: true,
        logName: 'test.mlg',
        logSizeBytes: 1234,
        recordCount: 12,
        logChannelCount: 3,
        dataSourceSamples: 12,
        iniLoaded: true,
        iniSourceName: 'mainController.ini',
        iniCatalogEntries: 4,
        bindingActive: true,
        bindingMetrics: {
          boundChannelCount: 3,
          knownNoDataCount: 1,
          logOnlyCount: 0,
          ambiguousLogChannelCount: 0,
        },
      },
      runtimeErrors: [{
        time: Date.parse('2026-10-04T12:00:00.000Z'),
        kind: 'error',
        message: 'boom',
        source: 'app.js',
        line: 10,
        column: 4,
        stack: 'stack text',
      }],
      application: {
        generatedAtIso: '2026-10-04T12:30:00.000Z',
        url: 'https://example.test/',
        userAgent: 'test-agent',
        viewportWidth: 1366,
        viewportHeight: 645,
        devicePixelRatio: 1,
        documentVisibility: 'visible',
        online: true,
        hardwareConcurrency: 2,
        appStatus: 'Ready',
        parserStatus: 'LOG-MLG · local file parsing',
        openLogState: 'success',
        openLogTitle: 'Loaded',
        loadIniState: 'success',
        loadIniTitle: 'Loaded INI',
      },
      performanceReport: 'EpicScope performance diagnostics\n[Load]\ntotal=100.00 ms',
    });

    expect(report.issueCount).toBe(1);
    expect(report.text).toContain('[Health] 1 ISSUE / 1 WARN');
    expect(report.text).toContain('ISSUE | One issue');
    expect(report.text).toContain('WARN | One warning');
    expect(report.text).toContain('logName=test.mlg');
    expect(report.text).toContain('bindingKnownNoData=1');
    expect(report.text).toContain('pane=pane-1; visible=true');
    expect(report.text).toContain('2026-10-04T12:00:00.000Z ERROR boom · app.js:10:4');
    expect(report.text).toContain('stack text');
    expect(report.text).toContain('appStatus=Ready');
    expect(report.text).toContain('EpicScope performance diagnostics');
  });

  it('emits a PASS line when health has no issues or warnings', () => {
    const report = buildBugReportText({
      snapshot,
      workspaceState,
      issues: [],
      warnings: [],
      source: {
        logLoaded: false,
        recordCount: 0,
        logChannelCount: 0,
        dataSourceSamples: 0,
        iniLoaded: false,
        iniCatalogEntries: 0,
        bindingActive: false,
      },
      runtimeErrors: [],
      application: {
        generatedAtIso: '2026-10-04T12:30:00.000Z',
        url: 'https://example.test/',
        userAgent: 'test-agent',
        viewportWidth: 1,
        viewportHeight: 1,
        devicePixelRatio: 1,
        documentVisibility: 'visible',
        online: true,
        appStatus: 'Ready',
        parserStatus: 'Ready',
        openLogState: 'idle',
        openLogTitle: '',
        loadIniState: 'idle',
        loadIniTitle: '',
      },
      performanceReport: 'EpicScope performance diagnostics',
    });

    expect(report.issueCount).toBe(0);
    expect(report.text).toContain('PASS | No obvious runtime-state inconsistency detected.');
    expect(report.text).toContain('logName=—');
    expect(report.text).toContain('CPU threads: unknown');
  });
});
