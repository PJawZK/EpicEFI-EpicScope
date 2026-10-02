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
  storage: Storage = window.localStorage,
): IniCatalogLocalStorageAdapter {
  return {
    load: () => {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) return undefined;
      const payload = parseIniCatalog(raw).payload;
      return {
        sourceName: payload.sourceName,
        catalog: restoreIniCatalog(payload),
      };
    },
    save: (sourceName, catalog) => {
      storage.setItem(STORAGE_KEY, serializeIniCatalog(sourceName, catalog));
    },
    remove: () => {
      storage.removeItem(STORAGE_KEY);
    },
  };
}
