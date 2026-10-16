import type { ObservabilityRecorder } from '../observability/recorder';
import { createOwnerEvidence, ownerFailureReason } from '../observability/producers/owner';
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
  storage?: Storage,
  recorder?: ObservabilityRecorder,
): WorkspaceLocalStorageAdapter {
  const ownerEvidence = createOwnerEvidence(recorder, 'workspace-local-storage');
  // Resolve browser storage at operation time so caller error handling also
  // covers a throwing localStorage getter and a later retry can recover.
  return {
    load: (source) => {
      const operation = ownerEvidence.begin('storage.load', {}, 'programmatic');
      try {
        const raw = (storage ?? window.localStorage).getItem(storageKey(source));
        if (!raw) return undefined;
        const envelope = parseWebWorkspace(raw);
        if (envelope.payload.sourceId !== source.id) return undefined;
        return envelope.payload;
      } catch (error) {
        operation?.finish('failure', ownerFailureReason(error));
        throw error;
      } finally {
        if (operation?.outcome === undefined) operation?.finish('success');
      }
    },
    save: (source, workspace) => {
      const operation = ownerEvidence.begin('storage.save', {}, 'programmatic');
      try {
        (storage ?? window.localStorage).setItem(storageKey(source), serializeWebWorkspace(source, workspace));
      } catch (error) {
        operation?.finish('failure', ownerFailureReason(error));
        throw error;
      } finally {
        if (operation?.outcome === undefined) operation?.finish('success');
      }
    },
    remove: (source) => {
      const operation = ownerEvidence.begin('storage.remove', {}, 'programmatic');
      try {
        (storage ?? window.localStorage).removeItem(storageKey(source));
      } catch (error) {
        operation?.finish('failure', ownerFailureReason(error));
        throw error;
      } finally {
        if (operation?.outcome === undefined) operation?.finish('success');
      }
    },
  };
}
