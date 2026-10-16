import type { ObservabilityRecorder } from '../observability/recorder';
import { createOwnerEvidence, ownerFailureReason } from '../observability/producers/owner';
import type { ChannelCatalog } from '../../../../core/channels/channel-catalog';
import {
  parseIniCatalog,
  restoreIniCatalog,
  serializeIniCatalog,
} from '../state/ini-catalog-persistence';

const STORAGE_KEY = 'epicscope.web-ini-channel-catalog.v1';

export interface IniCatalogLocalStorageAdapter {
  load(): { readonly sourceName: string; readonly catalog: ChannelCatalog } | undefined;
  save(sourceName: string, catalog: ChannelCatalog): void;
  remove(): void;
}

export function createIniCatalogLocalStorageAdapter(
  storage?: Storage,
  recorder?: ObservabilityRecorder,
): IniCatalogLocalStorageAdapter {
  const ownerEvidence = createOwnerEvidence(recorder, 'ini-catalog-local-storage');
  // Resolve browser storage at operation time so caller error handling also
  // covers a throwing localStorage getter and a later retry can recover.
  return {
    load: () => {
      const operation = ownerEvidence.begin('storage.load', {}, 'programmatic');
      try {
        const raw = (storage ?? window.localStorage).getItem(STORAGE_KEY);
        if (!raw) return undefined;
        const payload = parseIniCatalog(raw).payload;
        return {
          sourceName: payload.sourceName,
          catalog: restoreIniCatalog(payload),
        };
      } catch (error) {
        operation?.finish('failure', ownerFailureReason(error));
        throw error;
      } finally {
        if (operation?.outcome === undefined) operation?.finish('success');
      }
    },
    save: (sourceName, catalog) => {
      const operation = ownerEvidence.begin('storage.save', {}, 'programmatic');
      try {
        (storage ?? window.localStorage).setItem(STORAGE_KEY, serializeIniCatalog(sourceName, catalog));
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
