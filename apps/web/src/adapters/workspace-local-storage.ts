import type { LogSourceIdentity } from '../../../../core/log-model/log-types';
import {
  parseWebWorkspace,
  serializeWebWorkspace,
  type PersistedWebWorkspacePayload,
} from '../state/workspace-persistence';
import type { WebWorkspaceState } from '../state/workspace-state';

const STORAGE_PREFIX = 'epicscope.web-workspace.v1:';

function storageKey(source: LogSourceIdentity): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(source.id)}`;
}

export interface WorkspaceLocalStorageAdapter {
  load(source: LogSourceIdentity): PersistedWebWorkspacePayload | undefined;
  save(source: LogSourceIdentity, workspace: WebWorkspaceState): void;
  remove(source: LogSourceIdentity): void;
}

export function createWorkspaceLocalStorageAdapter(
  storage: Storage = window.localStorage,
): WorkspaceLocalStorageAdapter {
  return {
    load: (source) => {
      const raw = storage.getItem(storageKey(source));
      if (!raw) return undefined;
      const envelope = parseWebWorkspace(raw);
      if (envelope.payload.sourceId !== source.id) return undefined;
      return envelope.payload;
    },
    save: (source, workspace) => {
      storage.setItem(storageKey(source), serializeWebWorkspace(source, workspace));
    },
    remove: (source) => {
      storage.removeItem(storageKey(source));
    },
  };
}
