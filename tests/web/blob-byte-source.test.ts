import { describe, expect, it } from 'vitest';

import { BlobByteSource } from '../../apps/web/src/adapters/blob-byte-source';

describe('BlobByteSource bounded raw cache', () => {
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

  it('uses one contiguous backing buffer for logs within the cache budget', async () => {
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
    expect(firstStats.physicalReadCount).toBe(1);
    expect(secondStats.physicalReadCount).toBe(1);
    expect(secondStats.cacheHitBytes).toBe(2);
    expect(range.buffer).toBe(again.buffer);
  });
});


it('reuses the rolling boundary page on large sequential reads without exceeding the cache budget', async () => {
  const page = 8 * 1024 * 1024;
  const total = 13 * page;
  const source = new BlobByteSource(new Blob([new Uint8Array(total)]));

  // Fill the pinned 88 MiB prefix (pages 0-10).
  for (let index = 0; index < 11; index += 1) {
    await source.read(index * page, page);
  }

  const before = source.stats();
  expect(before.physicalReadCount).toBe(11);

  // First boundary read loads page 11 as the rolling page.
  await source.read(11 * page - 1024, 2048);
  const afterFirstBoundary = source.stats();
  expect(afterFirstBoundary.physicalReadCount).toBe(12);

  // The next boundary read must reuse page 11 and only load page 12.
  await source.read(12 * page - 1024, 2048);
  const afterSecondBoundary = source.stats();
  expect(afterSecondBoundary.physicalReadCount).toBe(13);
  expect(afterSecondBoundary.cacheHitBytes).toBeGreaterThanOrEqual(1024);
  expect(afterSecondBoundary.cacheBytes).toBeLessThanOrEqual(96 * 1024 * 1024);
});
