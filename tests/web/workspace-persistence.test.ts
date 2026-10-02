import { describe, expect, it } from 'vitest';

import {
  parseWebWorkspace,
  serializeWebWorkspace,
  WEB_WORKSPACE_SCHEMA,
  WEB_WORKSPACE_VERSION,
} from '../../apps/web/src/state/workspace-persistence';
import type { WebWorkspaceState } from '../../apps/web/src/state/workspace-state';
import { PersistenceFormatError } from '../../core/persistence/versioned-artifact';

const workspace: WebWorkspaceState = {
  logger: {
    activeWorkspaceId: 'general',
    workspaces: [{
      id: 'general',
      name: 'General',
      channelIds: ['rpm'],
      viewport: {
        fullStartMs: 0,
        fullEndMs: 10_000,
        visibleStartMs: 1_000,
        visibleEndMs: 5_000,
      },
      cursorTimeMs: 2_500,
      viewHistory: [{
        fullStartMs: 0,
        fullEndMs: 10_000,
        visibleStartMs: 1_000,
        visibleEndMs: 5_000,
      }],
      viewHistoryIndex: 0,
    }],
    timeline: {
      expanded: true,
      userMarkers: [{ timeMs: 2_000, label: 'Tip in' }],
      aTimeMs: 1_500,
      bTimeMs: 3_500,
      savedRanges: [{ label: 'Pull', startMs: 1_500, endMs: 3_500 }],
    },
    inspector: {
      visible: true,
      favoriteChannelIds: ['rpm'],
      recentChannelIds: ['rpm'],
      searchQuery: 'rpm',
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

describe('Web workspace persistence', () => {
  it('round-trips a v1 workspace artifact with source identity', () => {
    const serialized = serializeWebWorkspace({
      id: 'file:test.mlg:123:456',
      displayName: 'test.mlg',
      format: 'mlg-v2',
      sizeBytes: 123,
    }, workspace);

    const parsed = parseWebWorkspace(serialized);

    expect(parsed.schema).toBe(WEB_WORKSPACE_SCHEMA);
    expect(parsed.version).toBe(WEB_WORKSPACE_VERSION);
    expect(parsed.payload.sourceId).toBe('file:test.mlg:123:456');
    expect(parsed.payload.workspace).toEqual(workspace);
  });

  it('rejects unsupported artifact versions explicitly', () => {
    const serialized = JSON.stringify({
      schema: WEB_WORKSPACE_SCHEMA,
      version: WEB_WORKSPACE_VERSION + 1,
      savedAt: new Date().toISOString(),
      payload: {
        sourceId: 'file:test',
        sourceDisplayName: 'test.mlg',
        workspace,
      },
    });

    expect(() => parseWebWorkspace(serialized)).toThrowError(PersistenceFormatError);
    try {
      parseWebWorkspace(serialized);
    } catch (error) {
      expect(error).toBeInstanceOf(PersistenceFormatError);
      expect((error as PersistenceFormatError).code).toBe('unsupported-version');
    }
  });

  it('rejects malformed workspace payloads instead of partially restoring them', () => {
    const serialized = JSON.stringify({
      schema: WEB_WORKSPACE_SCHEMA,
      version: WEB_WORKSPACE_VERSION,
      savedAt: new Date().toISOString(),
      payload: {
        sourceId: 'file:test',
        sourceDisplayName: 'test.mlg',
        workspace: {
          ...workspace,
          logger: {
            ...workspace.logger,
            workspaces: [{
              ...workspace.logger.workspaces[0],
              channelIds: new Array(9).fill('too-many'),
            }],
          },
        },
      },
    });

    expect(() => parseWebWorkspace(serialized)).toThrowError(PersistenceFormatError);
  });
});
