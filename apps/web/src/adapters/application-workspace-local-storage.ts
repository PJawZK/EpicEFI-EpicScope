import {
  parseWebApplicationWorkspace,
  serializeWebApplicationWorkspace,
  type PersistedWebApplicationWorkspacePayload,
} from '../state/application-workspace-persistence';
import type { WebWorkspaceState } from '../state/workspace-state';

const STORAGE_KEY = 'epicscope.web-application-workspace.v1';

export interface ApplicationWorkspaceLocalStorageAdapter {
  load(): PersistedWebApplicationWorkspacePayload | undefined;
  save(workspace: WebWorkspaceState): void;
  remove(): void;
}

export function createApplicationWorkspaceLocalStorageAdapter(
  storage: Storage = window.localStorage,
): ApplicationWorkspaceLocalStorageAdapter {
  return {
    load: () => {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return undefined;
      return parseWebApplicationWorkspace(raw).payload;
    },
    save: (workspace) => {
      storage.setItem(STORAGE_KEY, serializeWebApplicationWorkspace(workspace));
    },
    remove: () => {
      storage.removeItem(STORAGE_KEY);
    },
  };
}
