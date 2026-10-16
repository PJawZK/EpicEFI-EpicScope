import type { ObservabilityRecorder } from '../observability/recorder';
import { createOwnerEvidence, ownerFailureReason } from '../observability/producers/owner';
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
  storage?: Storage,
  recorder?: ObservabilityRecorder,
): ApplicationWorkspaceLocalStorageAdapter {
  const ownerEvidence = createOwnerEvidence(recorder, 'application-workspace-local-storage');
  // Resolve browser storage at operation time so caller error handling also
  // covers a throwing localStorage getter and a later retry can recover.
  return {
    load: () => {
      const operation = ownerEvidence.begin('storage.load', {}, 'programmatic');
      try {
        const raw = (storage ?? window.localStorage).getItem(STORAGE_KEY);
        if (!raw) return undefined;
        return parseWebApplicationWorkspace(raw).payload;
      } catch (error) {
        operation?.finish('failure', ownerFailureReason(error));
        throw error;
      } finally {
        if (operation?.outcome === undefined) operation?.finish('success');
      }
    },
    save: (workspace) => {
      const operation = ownerEvidence.begin('storage.save', {}, 'programmatic');
      try {
        (storage ?? window.localStorage).setItem(STORAGE_KEY, serializeWebApplicationWorkspace(workspace));
      } catch (error) {
        operation?.finish('failure', ownerFailureReason(error));
        throw error;
      } finally {
        if (operation?.outcome === undefined) operation?.finish('success');
      }
    },
    remove: () => {
      const operation = ownerEvidence.begin('storage.remove', {}, 'programmatic');
      try {
        (storage ?? window.localStorage).removeItem(STORAGE_KEY);
      } catch (error) {
        operation?.finish('failure', ownerFailureReason(error));
        throw error;
      } finally {
        if (operation?.outcome === undefined) operation?.finish('success');
      }
    },
  };
}
