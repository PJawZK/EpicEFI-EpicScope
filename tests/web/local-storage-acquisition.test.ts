import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkspaceLocalStorageAdapter } from '../../apps/web/src/adapters/workspace-local-storage';
import { createApplicationWorkspaceLocalStorageAdapter } from '../../apps/web/src/adapters/application-workspace-local-storage';
import { createIniCatalogLocalStorageAdapter } from '../../apps/web/src/adapters/ini-catalog-local-storage';
import { storageWorkspace, storageSource, storageCatalog } from '../fixtures/browser/storage-workspace';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}
const specs = [
  { name: 'log workspace', create: (storage?: Storage) => {
    const adapter = createWorkspaceLocalStorageAdapter(storage);
    return { load: () => adapter.load(storageSource), save: () => adapter.save(storageSource, storageWorkspace), remove: () => adapter.remove(storageSource) };
  } },
  { name: 'application workspace', create: (storage?: Storage) => {
    const adapter = createApplicationWorkspaceLocalStorageAdapter(storage);
    return { load: () => adapter.load(), save: () => adapter.save(storageWorkspace), remove: () => adapter.remove() };
  } },
  { name: 'INI catalog', create: (storage?: Storage) => {
    const adapter = createIniCatalogLocalStorageAdapter(storage);
    return { load: () => adapter.load(), save: () => adapter.save('storage-check.ini', storageCatalog), remove: () => adapter.remove() };
  } },
];
afterEach(() => vi.unstubAllGlobals());
for (const spec of specs) describe(`${spec.name} storage acquisition`, () => {
  it('constructs without touching storage and propagates getter failures from each operation', () => {
    const denied = new DOMException('storage denied', 'SecurityError');
    let reads = 0;
    vi.stubGlobal('window', { get localStorage(): Storage { reads++; throw denied; } });
    const adapter = spec.create();
    expect(reads).toBe(0);
    for (const operation of [adapter.load, adapter.save, adapter.remove]) expect(operation).toThrow(denied);
    expect(reads).toBe(3);
  });

  it('recovers on the same adapter after getter access is restored, preserving durable data', () => {
    const storage = memoryStorage();
    spec.create(storage).save();
    const before = storage.getItem(storage.key(0)!);
    let blocked = true;
    vi.stubGlobal('window', { get localStorage() { if (blocked) throw new DOMException('storage denied', 'SecurityError'); return storage; } });
    const adapter = spec.create();
    expect(adapter.load).toThrow('storage denied');
    expect(storage.getItem(storage.key(0)!)).toBe(before);
    blocked = false;
    const restored = adapter.load();
    expect(restored).toBeDefined();
    adapter.save();
    expect(adapter.load()).toEqual(restored);
    adapter.remove();
    expect(adapter.load()).toBeUndefined();
  });

  it('honors injected storage without consulting the browser getter', () => {
    vi.stubGlobal('window', { get localStorage(): Storage { throw Error('must not access browser storage'); } });
    const adapter = spec.create(memoryStorage());
    expect(adapter.load()).toBeUndefined();
    adapter.save();
    expect(adapter.load()).toBeDefined();
    adapter.remove();
    expect(adapter.load()).toBeUndefined();
  });

  it('keeps method failures and corrupt persisted payloads visible to the owner', () => {
    const storage = memoryStorage();
    const adapter = spec.create(storage);
    const failure = new DOMException('storage method failed', 'QuotaExceededError');
    for (const [method, operation] of [['getItem', adapter.load], ['setItem', adapter.save], ['removeItem', adapter.remove]] as const) {
      const spy = vi.spyOn(storage, method).mockImplementation(() => { throw failure; });
      expect(operation).toThrow(failure);
      spy.mockRestore();
    }
    vi.spyOn(storage, 'getItem').mockReturnValue('{invalid json');
    expect(adapter.load).toThrow();
  });
});
