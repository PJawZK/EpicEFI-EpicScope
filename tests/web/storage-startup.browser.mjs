import { createWorkspaceLocalStorageAdapter } from '../../apps/web/src/adapters/workspace-local-storage';
import { createApplicationWorkspaceLocalStorageAdapter } from '../../apps/web/src/adapters/application-workspace-local-storage';
import { createIniCatalogLocalStorageAdapter } from '../../apps/web/src/adapters/ini-catalog-local-storage';
import { storageWorkspace, storageSource, storageCatalog } from '../fixtures/browser/storage-workspace';

const keys = ['epicscope.web-application-workspace.v1', 'epicscope.web-ini-channel-catalog.v1', 'epicscope.web-workspace.v1:' + encodeURIComponent(storageSource.id)];
const snapshot = () => keys.map(key => localStorage.getItem(key));
export function seedStorageStartupChecks() {
  createWorkspaceLocalStorageAdapter().save(storageSource, storageWorkspace);
  createApplicationWorkspaceLocalStorageAdapter().save(storageWorkspace);
  createIniCatalogLocalStorageAdapter().save('storage-check.ini', storageCatalog);
  return snapshot();
}
export function verifyStorageStartupRecovery(expected) {
  if (JSON.stringify(snapshot()) !== JSON.stringify(expected)) throw Error('Denied startup/import changed durable workspace/catalog data');
  const log = createWorkspaceLocalStorageAdapter();
  const application = createApplicationWorkspaceLocalStorageAdapter();
  const ini = createIniCatalogLocalStorageAdapter();
  if (log.load(storageSource)?.sourceId !== storageSource.id || application.load()?.workspace.settings.playbackSpeed !== 2 || ini.load()?.sourceName !== 'storage-check.ini') throw Error('Recovered adapters did not restore saved payloads');
  // All three operation types must still use the healthy native storage.
  log.save(storageSource, storageWorkspace); application.save(storageWorkspace); ini.save('storage-check.ini', storageCatalog);
  const stableEnvelope = raw => { const { savedAt, ...envelope } = JSON.parse(raw); if (!Number.isFinite(Date.parse(savedAt))) throw Error('Healthy save omitted timestamp'); return envelope; };
  if (JSON.stringify(snapshot().map(stableEnvelope)) !== JSON.stringify(expected.map(stableEnvelope))) throw Error('Healthy save changed payload format');
  log.remove(storageSource); application.remove(); ini.remove();
  if (snapshot().some(value => value !== null)) throw Error('Healthy remove failed');
}
