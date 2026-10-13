import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  builtInWorkspaceRuntimeId,
  materializeBuiltInWorkspace,
  upsertBuiltInWorkspace,
} from '../../apps/web/src/state/prepopulated-workspace-runtime';
import { GENERAL_SINGLE_WORKSPACE } from '../../apps/web/src/state/built-in-workspace-templates';
import type { LoggerWorkspaceState } from '../../apps/web/src/state/workspace-state';

function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition {
  return {
    id,
    sourceName,
    displayName,
    valueType: 'number',
  };
}

function loggerState(): LoggerWorkspaceState {
  return {
    activeWorkspaceId: 'general',
    workspaces: [{
      id: 'general',
      name: 'General',
      channelIds: ['custom-rpm'],
      layout: 'single',
      activePaneId: 'pane-1',
      panes: [{ id: 'pane-1', channelIds: ['custom-rpm'] }],
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
      selectedGroup: '',
      visibilityFilter: 'all',
      sortKey: 'name',
      sortAscending: true,
    },
  };
}

const recordedChannels = (): ChannelDefinition[] => [
  channel('ini:RPMValue', 'RPMValue', 'RPM'),
  channel('ini:MAPValue', 'MAPValue', 'MAP'),
  channel('ini:TPSValue', 'TPSValue', 'TPS'),
  channel('ini:coolant', 'coolant', 'Coolant temp'),
  channel('ini:intake', 'intake', 'Intake air temp'),
  channel('ini:VBatt', 'VBatt', 'Battery'),
  channel('ini:lambdaValue', 'lambdaValue', 'Lambda'),
  channel('ini:correctedIgnitionAdvance', 'correctedIgnitionAdvance', 'Timing: ignition'),
];

const liveChannels = (): ChannelDefinition[] => [
  channel('RPMValue'),
  channel('MAPValue'),
  channel('TPSValue'),
  channel('coolant'),
  channel('intake'),
  channel('VBatt'),
  channel('lambdaValue'),
  channel('correctedIgnitionAdvance'),
];

describe('pre-populated workspace runtime', () => {
  it('materializes General Single against canonical INI identities', () => {
    const result = materializeBuiltInWorkspace(GENERAL_SINGLE_WORKSPACE, recordedChannels());

    expect(result.workspace.id).toBe('built-in:single-resolver-test');
    expect(result.workspace.name).toBe('General · Single');
    expect(result.workspace.layout).toBe('single');
    expect(result.workspace.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
      'ini:TPSValue',
      'ini:coolant',
      'ini:intake',
      'ini:VBatt',
      'ini:lambdaValue',
      'ini:correctedIgnitionAdvance',
    ]);
    expect(result.workspace.panes?.[0]?.channelIds).toEqual(result.workspace.channelIds);
  });

  it('re-resolves General Single from MLG/INI to Shim while preserving view state', () => {
    const first = materializeBuiltInWorkspace(GENERAL_SINGLE_WORKSPACE, recordedChannels());
    const previous = {
      ...first.workspace,
      cursorTimeMs: 1234,
      viewport: {
        fullStartMs: 0,
        fullEndMs: 10_000,
        visibleStartMs: 1000,
        visibleEndMs: 4000,
      },
      viewHistory: [{
        fullStartMs: 0,
        fullEndMs: 10_000,
        visibleStartMs: 1000,
        visibleEndMs: 4000,
      }],
      viewHistoryIndex: 0,
    };

    const live = materializeBuiltInWorkspace(GENERAL_SINGLE_WORKSPACE, liveChannels(), {}, previous);

    expect(live.workspace.channelIds).toEqual([
      'RPMValue',
      'MAPValue',
      'TPSValue',
      'coolant',
      'intake',
      'VBatt',
      'lambdaValue',
      'correctedIgnitionAdvance',
    ]);
    expect(live.workspace.cursorTimeMs).toBe(1234);
    expect(live.workspace.viewport).toEqual(previous.viewport);
    expect(live.workspace.viewHistory).toEqual(previous.viewHistory);
    expect(live.workspace.viewHistoryIndex).toBe(0);
  });

  it('round-trips Shim back to canonical INI identities', () => {
    const live = materializeBuiltInWorkspace(GENERAL_SINGLE_WORKSPACE, liveChannels());
    const recorded = materializeBuiltInWorkspace(
      GENERAL_SINGLE_WORKSPACE,
      recordedChannels(),
      {},
      live.workspace,
    );

    expect(recorded.workspace.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
      'ini:TPSValue',
      'ini:coolant',
      'ini:intake',
      'ini:VBatt',
      'ini:lambdaValue',
      'ini:correctedIgnitionAdvance',
    ]);
  });

  it('does not overwrite a user workspace with the same visible name', () => {
    const state = loggerState();
    const userCopy = {
      ...state.workspaces[0]!,
      id: 'graph-42',
      name: GENERAL_SINGLE_WORKSPACE.name,
      channelIds: ['user-selected-channel'],
      panes: [{ id: 'pane-1', channelIds: ['user-selected-channel'] }],
    };
    const withUserCopy: LoggerWorkspaceState = {
      ...state,
      workspaces: [...state.workspaces, userCopy],
    };

    const result = upsertBuiltInWorkspace(withUserCopy, GENERAL_SINGLE_WORKSPACE, [
      channel('RPMValue'),
      channel('MAPValue'),
    ]);

    expect(result.inserted).toBe(true);
    expect(result.state.workspaces.find((workspace) => workspace.id === 'graph-42')).toEqual(userCopy);
    expect(result.state.workspaces.find((workspace) => workspace.id === builtInWorkspaceRuntimeId(GENERAL_SINGLE_WORKSPACE))?.channelIds)
      .toEqual(['RPMValue', 'MAPValue']);
  });

  it('refreshes only the reserved built-in workspace and keeps it active across source changes', () => {
    const initial = upsertBuiltInWorkspace(loggerState(), GENERAL_SINGLE_WORKSPACE, recordedChannels(), { activate: true });

    expect(initial.state.activeWorkspaceId).toBe('built-in:single-resolver-test');
    expect(initial.inserted).toBe(true);

    const refreshed = upsertBuiltInWorkspace(initial.state, GENERAL_SINGLE_WORKSPACE, [
      channel('RPMValue'),
      channel('MAPValue'),
      channel('TPSValue'),
    ]);

    expect(refreshed.inserted).toBe(false);
    expect(refreshed.state.activeWorkspaceId).toBe('built-in:single-resolver-test');
    expect(refreshed.state.workspaces).toHaveLength(2);
    expect(refreshed.materialized.workspace.channelIds).toEqual(['RPMValue', 'MAPValue', 'TPSValue']);
    expect(refreshed.materialized.resolution.unresolvedPreferredRoleIds).toEqual(['temperature.coolant']);
    expect(refreshed.materialized.resolution.unresolvedOptionalRoleIds).toEqual([
      'temperature.intakeAir',
      'electrical.batteryVoltage',
      'fuel.lambda',
      'ignition.advance',
    ]);
  });

  it('honors explicit semantic overrides when materializing a built-in workspace', () => {
    const result = materializeBuiltInWorkspace(
      GENERAL_SINGLE_WORKSPACE,
      [channel('RPMValue'), channel('MAPValue'), channel('TPSValue'), channel('customThrottle')],
      { overrides: new Map([['engine.throttle.position', 'customThrottle']]) },
    );

    expect(result.workspace.channelIds).toEqual(['RPMValue', 'MAPValue', 'customThrottle']);
    expect(result.resolution.unresolvedRequiredRoleIds).toEqual([]);
    expect(result.resolution.unresolvedPreferredRoleIds).toEqual(['temperature.coolant']);
  });
});
