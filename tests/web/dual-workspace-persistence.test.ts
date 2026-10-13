import { describe, expect, it } from 'vitest';

import {
  parseWebApplicationWorkspace,
  serializeWebApplicationWorkspace,
} from '../../apps/web/src/state/application-workspace-persistence';
import {
  parseWebWorkspace,
  serializeWebWorkspace,
} from '../../apps/web/src/state/workspace-persistence';
import type { WebWorkspaceState } from '../../apps/web/src/state/workspace-state';

const dualWorkspace: WebWorkspaceState = {
  logger: {
    activeWorkspaceId: 'graph-idle',
    workspaces: [{
      id: 'graph-idle',
      name: 'Idle',
      channelIds: ['ini:RPMValue', 'ini:idleTarget', 'ini:MAPValue', 'ini:TPSValue'],
      layout: 'dual',
      activePaneId: 'pane-1',
      panes: [
        {
          id: 'pane-1',
          channelIds: ['ini:RPMValue', 'ini:idleTarget', 'ini:MAPValue', 'ini:TPSValue'],
        },
        {
          id: 'pane-2',
          channelIds: [
            'ini:currentIdlePosition',
            'ini:correctedIgnitionAdvance',
            'ini:coolant',
            'ini:lambdaValue',
          ],
        },
        { id: 'pane-3', channelIds: [] },
        { id: 'pane-4', channelIds: [] },
        { id: 'pane-5', channelIds: [] },
        { id: 'pane-6', channelIds: [] },
      ],
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
  },
  settings: {
    playbackSpeed: 1,
    highZoomSamplePointsVisible: true,
    timelineOverviewTracesVisible: true,
    performanceDiagnosticsVisible: true,
  },
};

describe('dual workspace persistence', () => {
  it('round-trips a dual workspace through log-specific persistence', () => {
    const parsed = parseWebWorkspace(serializeWebWorkspace({
      id: 'file:test.mlg:123:456',
      displayName: 'test.mlg',
      format: 'mlg-v2',
      sizeBytes: 123,
    }, dualWorkspace));

    expect(parsed.payload.workspace.logger.activeWorkspaceId).toBe('graph-idle');
    expect(parsed.payload.workspace.logger.workspaces[0]?.layout).toBe('dual');
    expect(parsed.payload.workspace.logger.workspaces[0]?.panes?.[1]?.channelIds)
      .toEqual([
        'ini:currentIdlePosition',
        'ini:correctedIgnitionAdvance',
        'ini:coolant',
        'ini:lambdaValue',
      ]);
  });

  it('round-trips a dual workspace through reusable application persistence', () => {
    const parsed = parseWebApplicationWorkspace(
      serializeWebApplicationWorkspace(dualWorkspace),
    );

    expect(parsed.payload.workspace.logger.activeWorkspaceId).toBe('graph-idle');
    expect(parsed.payload.workspace.logger.workspaces[0]?.layout).toBe('dual');
    expect(parsed.payload.workspace.logger.workspaces[0]?.panes?.[0]?.channelIds)
      .toEqual(['ini:RPMValue', 'ini:idleTarget', 'ini:MAPValue', 'ini:TPSValue']);
  });
});
