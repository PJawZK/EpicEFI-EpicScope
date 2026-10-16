import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseIniTableEditorDefinitions } from '../../core/parsers/ini/ini-table-editor-parser';

const source = (axis: string) => `[OutputChannels]\nrpm = scalar, F32, 0, "rpm", 1, 0\n[TableEditor]\ntable = test, testMap, "Test", 1\nxBins = ${axis}RpmBins, rpm\nyBins = ${axis}LoadBins, map\nzBins = veTable\n`;
const a = parseIniTableEditorDefinitions(source('ve'));
const b = parseIniTableEditorDefinitions(source('afr'));
function storage(raw = JSON.stringify(a)) {
  let persisted = raw;
  const getItem = vi.fn(() => persisted);
  const setItem = vi.fn((_key: string, value: string) => { persisted = value; });
  vi.stubGlobal('localStorage', { getItem, setItem });
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { dispatchEvent });
  return { getItem, setItem, dispatchEvent, raw: () => persisted };
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
describe('accepted INI table-definition cache', () => {
  it('hydrates once and retains a stable snapshot instead of reparsing storage on every read', async () => {
    const store = storage();
    const module = await import('../../apps/web/src/state/ini-table-editor-storage');
    const first = module.loadIniTableEditorDefinitions();
    store.setItem('ignored', JSON.stringify(b));
    expect(module.loadIniTableEditorDefinitions()).toBe(first);
    expect(first).toEqual(a);
    expect(store.getItem).toHaveBeenCalledTimes(1);
  });

  it('publishes accepted definitions before persistence/notification even when the write fails', async () => {
    const store = storage();
    const module = await import('../../apps/web/src/state/ini-table-editor-storage');
    store.setItem.mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError'); });
    store.dispatchEvent.mockImplementation(() => { expect(module.loadIniTableEditorDefinitions()).toBe(b); return true; });
    module.saveIniTableEditorDefinitions(b);
    expect(module.loadIniTableEditorDefinitions()).toBe(b);
    expect(store.getItem).not.toHaveBeenCalled();
    expect(store.raw()).toBe(JSON.stringify(a));
    expect(store.dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it('keeps explicit empty acceptance/unload authoritative when stale disk data cannot be overwritten', async () => {
    const store = storage();
    const module = await import('../../apps/web/src/state/ini-table-editor-storage');
    expect(module.loadIniTableEditorDefinitions()).toEqual(a);
    store.setItem.mockImplementation(() => { throw Error('denied'); });
    module.saveIniTableEditorDefinitions([]);
    expect(module.loadIniTableEditorDefinitions()).toEqual([]);
    expect(store.getItem).toHaveBeenCalledTimes(1);
    expect(store.raw()).toBe(JSON.stringify(a));
  });

  it('does not repeatedly acquire denied storage and allows later acceptance/persistence to recover', async () => {
    let reads = 0;
    vi.stubGlobal('localStorage', undefined);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { reads++; throw new DOMException('denied', 'SecurityError'); } });
    const module = await import('../../apps/web/src/state/ini-table-editor-storage');
    expect(module.loadIniTableEditorDefinitions()).toEqual([]);
    module.loadIniTableEditorDefinitions();
    expect(reads).toBe(1);
    module.saveIniTableEditorDefinitions(b);
    expect(module.loadIniTableEditorDefinitions()).toBe(b);
    const store = storage();
    module.saveIniTableEditorDefinitions(b);
    expect(store.raw()).toBe(JSON.stringify(b));
    expect(store.getItem).not.toHaveBeenCalled();
  });

  it.each(['{bad', '{}', 'null'])('caches empty hydration for malformed/unsupported payload %s', async raw => {
    const store = storage(raw);
    const module = await import('../../apps/web/src/state/ini-table-editor-storage');
    expect(module.loadIniTableEditorDefinitions()).toEqual([]);
    expect(module.loadIniTableEditorDefinitions()).toEqual([]);
    expect(store.getItem).toHaveBeenCalledTimes(1);
    expect(store.setItem).not.toHaveBeenCalled();
  });

  it('preparing or rejecting an import cannot publish table definitions or write storage', async () => {
    const store = storage();
    const module = await import('../../apps/web/src/state/ini-table-editor-storage');
    const accepted = module.loadIniTableEditorDefinitions();
    const { importIniFile } = await import('../../apps/web/src/adapters/ini-file-import');
    const imported = await importIniFile({ name: 'candidate.ini', size: 100, text: async () => source('afr') } as File);
    expect(imported.tableDefinitions).toEqual(b);
    expect(module.loadIniTableEditorDefinitions()).toBe(accepted);
    await expect(importIniFile({ name: 'unreadable.ini', text: async () => { throw Error('read failed'); } } as unknown as File)).rejects.toThrow('read failed');
    expect(module.loadIniTableEditorDefinitions()).toBe(accepted);
    expect(store.setItem).not.toHaveBeenCalled();
    expect(store.dispatchEvent).not.toHaveBeenCalled();
  });
});
