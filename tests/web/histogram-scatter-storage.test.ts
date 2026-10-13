import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
}

describe('Histogram Scatter preset storage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  it('round-trips valid Scatter setups', async () => {
    const storage = await import('../../apps/web/src/state/histogram-scatter-storage');
    const preset = {
      id: 'scatter-preset-1', name: 'Boost response', scope: 'full', qualificationId: 'q-1',
      layout: 'dual' as const, traceMode: 'lines' as const,
      paneAXChannelId: 'rpm', paneAYChannelId: 'map', paneBXChannelId: 'tps', paneBYChannelId: 'lambda',
    };
    expect(storage.saveHistogramScatterPresets([preset])).toBe(true);
    expect(storage.loadHistogramScatterPresets()).toEqual([preset]);
  });

  it('rejects malformed stored setups', async () => {
    localStorage.setItem('epicscope.histogram.scatter-presets.v1', JSON.stringify([{ id: 'bad', name: 'Bad', layout: 'grid', traceMode: 'dots' }]));
    const storage = await import('../../apps/web/src/state/histogram-scatter-storage');
    expect(storage.loadHistogramScatterPresets()).toEqual([]);
  });
});
