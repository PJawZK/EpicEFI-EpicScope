import { describe, expect, it } from 'vitest';

import {
  ByteSourceRangeError,
  MemoryByteSource,
  validateReadRange,
} from './byte-source';

describe('validateReadRange', () => {
  it('accepts bounded and zero-length reads', () => {
    expect(() => validateReadRange(8, 0, 8)).not.toThrow();
    expect(() => validateReadRange(8, 8, 0)).not.toThrow();
  });

  it('rejects negative, fractional, and out-of-range reads', () => {
    expect(() => validateReadRange(8, -1, 1)).toThrow(ByteSourceRangeError);
    expect(() => validateReadRange(8, 1.5, 1)).toThrow(ByteSourceRangeError);
    expect(() => validateReadRange(8, 7, 2)).toThrow(ByteSourceRangeError);
  });
});

describe('MemoryByteSource', () => {
  it('returns only the requested range', async () => {
    const source = new MemoryByteSource(Uint8Array.from([10, 20, 30, 40]));

    await expect(source.read(1, 2)).resolves.toEqual(Uint8Array.from([20, 30]));
  });

  it('owns its input and returned ranges', async () => {
    const input = Uint8Array.from([1, 2, 3]);
    const source = new MemoryByteSource(input);

    input[1] = 99;
    const first = await source.read(0, 3);
    first[0] = 88;

    await expect(source.read(0, 3)).resolves.toEqual(Uint8Array.from([1, 2, 3]));
  });
});
