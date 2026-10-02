import { describe, expect, it } from 'vitest';

import { BlobByteSource } from '../../apps/web/src/adapters/blob-byte-source';

describe('BlobByteSource raw page cache', () => {
  it('reuses cached bytes without another physical Blob read', async () => {
    const bytes = new Uint8Array(9 * 1024 * 1024);
    bytes[123] = 42;
    const source = new BlobByteSource(new Blob([bytes]));

    const first = await source.read(0, 4 * 1024 * 1024);
    const afterFirst = source.stats();
    const second = await source.read(0, 4 * 1024 * 1024);
    const afterSecond = source.stats();

    expect(first[123]).toBe(42);
    expect(second[123]).toBe(42);
    expect(afterFirst.physicalReadCount).toBe(1);
    expect(afterSecond.physicalReadCount).toBe(1);
    expect(afterSecond.readCount).toBe(2);
    expect(afterSecond.cacheHitBytes).toBe(4 * 1024 * 1024);
  });

  it('combines cached pages for reads spanning a page boundary', async () => {
    const page = 8 * 1024 * 1024;
    const bytes = new Uint8Array(page + 16);
    bytes[page - 1] = 11;
    bytes[page] = 22;
    const source = new BlobByteSource(new Blob([bytes]));

    const range = await source.read(page - 1, 2);
    const firstStats = source.stats();
    const again = await source.read(page - 1, 2);
    const secondStats = source.stats();

    expect([...range]).toEqual([11, 22]);
    expect([...again]).toEqual([11, 22]);
    expect(firstStats.physicalReadCount).toBe(2);
    expect(secondStats.physicalReadCount).toBe(2);
    expect(secondStats.cacheHitBytes).toBe(2);
  });
});
