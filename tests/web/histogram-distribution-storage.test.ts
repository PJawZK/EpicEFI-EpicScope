import { beforeEach, describe, expect, it, vi } from 'vitest';

class LocalStorageMock {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
}

describe('Distribution preset storage', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new LocalStorageMock() });
  });

  it('round-trips complete Distribution setups', async () => {
    const storage = await import('../../apps/web/src/state/histogram-distribution-storage');
    const preset = {
      id: 'dist-1', name: 'RPM compare', channelId: 'rpm', scope: 'ab', qualificationId: 'warm',
      metric: 'percent' as const, binMode: 'manual' as const, binCount: '32', display: 'cumulative' as const,
      compare: true, compareScope: 'full',
    };
    expect(storage.saveHistogramDistributionPresets([preset])).toBe(true);
    expect(storage.loadHistogramDistributionPresets()).toEqual([preset]);
  });

  it('rejects malformed persisted setups', async () => {
    localStorage.setItem('epicscope.histogram.distribution-presets.v1', JSON.stringify([{ id: 'bad', name: 'Bad', metric: 'wat' }]));
    const storage = await import('../../apps/web/src/state/histogram-distribution-storage');
    expect(storage.loadHistogramDistributionPresets()).toEqual([]);
  });
});
