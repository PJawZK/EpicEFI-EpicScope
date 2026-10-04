import { describe, expect, it } from 'vitest';

import type { LoggerRuntimeDiagnosticSnapshot } from '../../apps/web/src/pages/logger-page';
import { evaluateBugReportHealth } from '../../apps/web/src/components/bug-report-health';

const cleanSnapshot = (): LoggerRuntimeDiagnosticSnapshot => ({
  hasChannelDataSource: true,
  channelDefinitionCount: 10,
  catalogChannelCount: 10,
  unavailableChannelCount: 0,
  aliasCount: 0,
  activeWorkspaceId: 'general',
  workspaceCount: 1,
  restoringWorkspaceState: false,
  visiblePaneCount: 1,
  assignedChannelCount: 1,
  renderableAssignedChannelCount: 1,
  unavailableAssignedChannelCount: 0,
  activeTraceCount: 1,
  panes: [],
});

describe('bug report runtime health', () => {
  it('reports a clean runtime state as having no issues or warnings', () => {
    expect(evaluateBugReportHealth(cleanSnapshot(), {
      logLoaded: true,
      iniLoaded: true,
      bindingActive: true,
      runtimeErrorCount: 0,
    })).toEqual({ issues: [], warnings: [] });
  });

  it('detects missing data, inactive renderable traces and runtime errors as issues', () => {
    const snapshot = {
      ...cleanSnapshot(),
      hasChannelDataSource: false,
      channelDefinitionCount: 0,
      renderableAssignedChannelCount: 3,
      activeTraceCount: 1,
    };
    const health = evaluateBugReportHealth(snapshot, {
      logLoaded: true,
      iniLoaded: false,
      bindingActive: false,
      runtimeErrorCount: 2,
    });

    expect(health.issues).toEqual([
      'Log is loaded but Logger has no channel data source.',
      'Log is loaded but Logger has zero channel definitions.',
      '2 of 3 renderable channels assigned to visible panes are not active.',
      '2 runtime error/unhandled rejection event(s) captured.',
    ]);
    expect(health.warnings).toEqual([]);
  });

  it('keeps unavailable channels, trace over-count and missing binding as warnings', () => {
    const snapshot = {
      ...cleanSnapshot(),
      renderableAssignedChannelCount: 1,
      unavailableAssignedChannelCount: 2,
      activeTraceCount: 2,
    };
    const health = evaluateBugReportHealth(snapshot, {
      logLoaded: true,
      iniLoaded: true,
      bindingActive: false,
      runtimeErrorCount: 0,
    });

    expect(health.issues).toEqual([]);
    expect(health.warnings).toEqual([
      '2 assigned visible-pane channel(s) are unavailable in the current log.',
      'Active trace count exceeds renderable assigned visible-channel count.',
      'INI catalog and log are loaded but no current INI/MLG binding is recorded.',
    ]);
  });
});
