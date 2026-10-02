import { describe, expect, it } from 'vitest';

import {
  mergeLogSpecificWorkspaceState,
  migrateReusableChannelAssignmentsFromLog,
  parseWebApplicationWorkspace,
  serializeWebApplicationWorkspace,
  toApplicationWorkspaceState,
  WEB_APPLICATION_WORKSPACE_SCHEMA,
  WEB_APPLICATION_WORKSPACE_VERSION,
} from '../../apps/web/src/state/application-workspace-persistence';
import {
  parseIniCatalog,
  restoreIniCatalog,
  serializeIniCatalog,
  WEB_INI_CATALOG_SCHEMA,
  WEB_INI_CATALOG_VERSION,
} from '../../apps/web/src/state/ini-catalog-persistence';
import type { WebWorkspaceState } from '../../apps/web/src/state/workspace-state';
import type { ChannelCatalog } from '../../core/channels/channel-catalog';

const workspace: WebWorkspaceState = {
  logger: {
    activeWorkspaceId: 'boost',
    workspaces: [{
      id: 'boost',
      name: 'Boost',
      channelIds: ['ini:RPMValue', 'ini:MAPValue'],
      layout: 'grid4',
      activePaneId: 'pane-1',
      panes: [
        { id: 'pane-1', channelIds: ['ini:RPMValue', 'ini:MAPValue'] },
        { id: 'pane-2', channelIds: ['ini:lwgDutyPct'] },
        { id: 'pane-3', channelIds: [] },
        { id: 'pane-4', channelIds: [] },
        { id: 'pane-5', channelIds: [] },
        { id: 'pane-6', channelIds: [] },
      ],
      viewport: {
        fullStartMs: 0,
        fullEndMs: 10_000,
        visibleStartMs: 2_000,
        visibleEndMs: 5_000,
      },
      cursorTimeMs: 3_000,
      viewHistory: [{
        fullStartMs: 0,
        fullEndMs: 10_000,
        visibleStartMs: 2_000,
        visibleEndMs: 5_000,
      }],
      viewHistoryIndex: 0,
    }],
    timeline: {
      expanded: true,
      userMarkers: [{ timeMs: 2_500, label: 'Pull' }],
      aTimeMs: 2_000,
      bTimeMs: 4_000,
      savedRanges: [{ label: 'Boost pull', startMs: 2_000, endMs: 4_000 }],
    },
    inspector: {
      visible: true,
      favoriteChannelIds: ['ini:RPMValue'],
      recentChannelIds: ['ini:MAPValue'],
      searchQuery: '',
      selectedGroup: '',
      visibilityFilter: 'all',
      sortKey: 'name',
      sortAscending: true,
    },
  },
  settings: {
    playbackSpeed: 1,
    highZoomSamplePointsVisible: true,
    timelineOverviewTracesVisible: true,
    performanceDiagnosticsVisible: true,
  },
};

describe('application workspace persistence v2 foundation', () => {
  it('keeps reusable graph/channel structure while stripping log-specific navigation', () => {
    const reusable = toApplicationWorkspaceState(workspace);

    expect(reusable.logger.workspaces[0]?.panes?.[0]?.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
    ]);
    expect(reusable.logger.workspaces[0]?.layout).toBe('grid4');
    expect(reusable.logger.workspaces[0]?.viewport).toBeUndefined();
    expect(reusable.logger.workspaces[0]?.cursorTimeMs).toBe(0);
    expect(reusable.logger.workspaces[0]?.viewHistory).toEqual([]);
    expect(reusable.logger.timeline.userMarkers).toEqual([]);
    expect(reusable.logger.timeline.aTimeMs).toBeUndefined();
    expect(reusable.logger.timeline.bTimeMs).toBeUndefined();
    expect(reusable.logger.timeline.savedRanges).toEqual([]);
    expect(reusable.logger.inspector.favoriteChannelIds).toEqual(['ini:RPMValue']);
    expect(reusable.logger.inspector.recentChannelIds).toEqual([]);
  });

  it('merges only recording-specific state from an old per-log artifact', () => {
    const reusable: WebWorkspaceState = {
      ...workspace,
      logger: {
        ...workspace.logger,
        workspaces: [{
          ...workspace.logger.workspaces[0]!,
          layout: 'grid4',
          panes: [
            { id: 'pane-1', channelIds: ['ini:RPMValue'] },
            { id: 'pane-2', channelIds: ['ini:MAPValue'] },
            { id: 'pane-3', channelIds: ['ini:TPSValue'] },
            { id: 'pane-4', channelIds: ['ini:lwgDutyPct'] },
            { id: 'pane-5', channelIds: [] },
            { id: 'pane-6', channelIds: [] },
          ],
          activePaneId: 'pane-2',
        }],
      },
    };

    const oldPerLog: WebWorkspaceState = {
      ...workspace,
      logger: {
        ...workspace.logger,
        activeWorkspaceId: 'general',
        workspaces: [{
          ...workspace.logger.workspaces[0]!,
          id: 'boost',
          name: 'Old log layout',
          layout: 'single',
          activePaneId: 'pane-1',
          panes: [
            { id: 'pane-1', channelIds: ['mlg:0', 'mlg:1'] },
            { id: 'pane-2', channelIds: [] },
            { id: 'pane-3', channelIds: [] },
            { id: 'pane-4', channelIds: [] },
            { id: 'pane-5', channelIds: [] },
            { id: 'pane-6', channelIds: [] },
          ],
          viewport: {
            fullStartMs: 0,
            fullEndMs: 12_000,
            visibleStartMs: 4_000,
            visibleEndMs: 7_000,
          },
          cursorTimeMs: 5_500,
          viewHistory: [{
            fullStartMs: 0,
            fullEndMs: 12_000,
            visibleStartMs: 4_000,
            visibleEndMs: 7_000,
          }],
          viewHistoryIndex: 0,
        }],
        timeline: {
          expanded: false,
          userMarkers: [{ timeMs: 5_000, label: 'Saved log marker' }],
          aTimeMs: 4_500,
          bTimeMs: 6_500,
          savedRanges: [{ label: 'Saved range', startMs: 4_500, endMs: 6_500 }],
        },
      },
    };

    const merged = mergeLogSpecificWorkspaceState(reusable, oldPerLog);
    const mergedWorkspace = merged.logger.workspaces[0]!;

    expect(merged.logger.activeWorkspaceId).toBe('boost');
    expect(mergedWorkspace.layout).toBe('grid4');
    expect(mergedWorkspace.activePaneId).toBe('pane-2');
    expect(mergedWorkspace.panes?.[0]?.channelIds).toEqual(['ini:RPMValue']);
    expect(mergedWorkspace.panes?.[3]?.channelIds).toEqual(['ini:lwgDutyPct']);

    expect(mergedWorkspace.viewport).toEqual(oldPerLog.logger.workspaces[0]?.viewport);
    expect(mergedWorkspace.cursorTimeMs).toBe(5_500);
    expect(mergedWorkspace.viewHistory).toEqual(oldPerLog.logger.workspaces[0]?.viewHistory);
    expect(merged.logger.timeline.expanded).toBe(true);
    expect(merged.logger.timeline.userMarkers).toEqual([
      { timeMs: 5_000, label: 'Saved log marker' },
    ]);
    expect(merged.logger.timeline.aTimeMs).toBe(4_500);
    expect(merged.logger.timeline.bTimeMs).toBe(6_500);
    expect(merged.logger.timeline.savedRanges).toEqual([
      { label: 'Saved range', startMs: 4_500, endMs: 6_500 },
    ]);
  });

  it('migrates empty reusable panes from historical exact-log MLG assignments', () => {
    const reusable: WebWorkspaceState = {
      ...workspace,
      logger: {
        ...workspace.logger,
        workspaces: [{
          ...workspace.logger.workspaces[0]!,
          layout: 'grid4',
          panes: [
            { id: 'pane-1', channelIds: [] },
            { id: 'pane-2', channelIds: [] },
            { id: 'pane-3', channelIds: ['ini:TPSValue'] },
            { id: 'pane-4', channelIds: [] },
            { id: 'pane-5', channelIds: [] },
            { id: 'pane-6', channelIds: [] },
          ],
        }],
      },
    };

    const historicalLog: WebWorkspaceState = {
      ...workspace,
      logger: {
        ...workspace.logger,
        workspaces: [{
          ...workspace.logger.workspaces[0]!,
          panes: [
            { id: 'pane-1', channelIds: ['mlg:0', 'mlg:1'] },
            { id: 'pane-2', channelIds: ['mlg:2'] },
            { id: 'pane-3', channelIds: ['mlg:3'] },
            { id: 'pane-4', channelIds: [] },
            { id: 'pane-5', channelIds: [] },
            { id: 'pane-6', channelIds: [] },
          ],
          channelIds: ['mlg:0', 'mlg:1'],
        }],
      },
    };

    const migrated = migrateReusableChannelAssignmentsFromLog(
      reusable,
      historicalLog,
      new Map([
        ['mlg:0', 'ini:RPMValue'],
        ['mlg:1', 'ini:MAPValue'],
        ['mlg:2', 'ini:lwgDutyPct'],
        ['mlg:3', 'ini:ShouldNotOverwrite'],
      ]),
    );

    expect(migrated.logger.workspaces[0]?.panes?.[0]?.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
    ]);
    expect(migrated.logger.workspaces[0]?.panes?.[1]?.channelIds).toEqual([
      'ini:lwgDutyPct',
    ]);
    expect(migrated.logger.workspaces[0]?.panes?.[2]?.channelIds).toEqual([
      'ini:TPSValue',
    ]);
  });

  it('round-trips the reusable application artifact', () => {
    const parsed = parseWebApplicationWorkspace(
      serializeWebApplicationWorkspace(workspace),
    );

    expect(parsed.schema).toBe(WEB_APPLICATION_WORKSPACE_SCHEMA);
    expect(parsed.version).toBe(WEB_APPLICATION_WORKSPACE_VERSION);
    expect(parsed.payload.workspace.logger.activeWorkspaceId).toBe('boost');
    expect(parsed.payload.workspace.logger.workspaces[0]?.panes?.[1]?.channelIds)
      .toEqual(['ini:lwgDutyPct']);
  });
});

describe('normalized INI catalog persistence', () => {
  const entries = [{
    logicalKey: 'RPMValue',
    sourceName: 'RPMValue',
    displayName: 'RPM',
    valueType: 'integer' as const,
    unit: 'RPM',
    precision: 0,
    availability: 'known-no-data' as const,
    provenance: { kind: 'ini' as const },
  }, {
    logicalKey: 'MAPValue',
    sourceName: 'MAPValue',
    displayName: 'MAP',
    valueType: 'number' as const,
    unit: 'kPa',
    precision: 2,
    availability: 'known-no-data' as const,
    provenance: { kind: 'ini' as const },
  }];
  const catalog: ChannelCatalog = {
    entries,
    byLogicalKey: new Map(entries.map((entry) => [entry.logicalKey, entry] as const)),
  };

  it('round-trips the normalized catalog without storing raw INI text', () => {
    const parsed = parseIniCatalog(serializeIniCatalog('mainController.ini', catalog));

    expect(parsed.schema).toBe(WEB_INI_CATALOG_SCHEMA);
    expect(parsed.version).toBe(WEB_INI_CATALOG_VERSION);
    expect(parsed.payload.sourceName).toBe('mainController.ini');
    expect(parsed.payload.entries).toHaveLength(2);

    const restored = restoreIniCatalog(parsed.payload);
    expect(restored.byLogicalKey.get('RPMValue')).toMatchObject({
      logicalKey: 'RPMValue',
      displayName: 'RPM',
      unit: 'RPM',
      availability: 'known-no-data',
    });
  });
});
