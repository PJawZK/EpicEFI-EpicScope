import type { WebWorkspaceState } from '../../../apps/web/src/state/workspace-state';
import type { LogSourceIdentity } from '../../../core/log-model/log-types';
import type { ChannelCatalog } from '../../../core/channels/channel-catalog';

export const storageWorkspace: WebWorkspaceState = {
  logger: {
    activeWorkspaceId: 'storage-check',
    workspaces: [{ id: 'storage-check', name: 'Storage recovery', channelIds: ['ini:rpm'], viewport: undefined, cursorTimeMs: 0, viewHistory: [], viewHistoryIndex: -1 }],
    timeline: { expanded: true, userMarkers: [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] },
    inspector: { visible: true, favoriteChannelIds: [], recentChannelIds: [], searchQuery: '', selectedGroup: '', visibilityFilter: 'all', sortKey: 'name', sortAscending: true },
  },
  settings: { playbackSpeed: 2, highZoomSamplePointsVisible: true, timelineOverviewTracesVisible: true, performanceDiagnosticsVisible: false },
};

export const storageSource: LogSourceIdentity = { id: 'storage-check.mlg', displayName: 'storage-check.mlg', format: 'mlg-v2', sizeBytes: 100 };
const entry: ChannelCatalog['entries'][number] = {
  logicalKey: 'rpm', sourceName: 'RPM', displayName: 'RPM', valueType: 'number', unit: 'rpm', availability: 'known-no-data', provenance: { kind: 'ini' },
};
export const storageCatalog: ChannelCatalog = { entries: [entry], byLogicalKey: new Map([['rpm', entry]]) };
