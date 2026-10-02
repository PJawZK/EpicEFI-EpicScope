import { describe, expect, it } from 'vitest';
import type { NumericChannelDataSource } from '../../core/log-model/log-types';
import {
  findSteppedSearchResultIndex,
  searchChannelValues,
} from '../../core/analysis/channel-value-search';

function source(values: Record<string, readonly number[]>, invalid: readonly number[] = []): NumericChannelDataSource {
  const sampleCount = Object.values(values)[0]?.length ?? 0;
  return {
    sampleCount,
    async readChannelRange(channelId, startSampleIndex, count) {
      const sourceValues = values[channelId];
      if (!sourceValues) throw new Error(`Unknown channel ${channelId}`);
      const end = Math.min(sampleCount, startSampleIndex + count);
      const length = Math.max(0, end - startSampleIndex);
      const timeMs = new Float64Array(length);
      const rangeValues = new Float64Array(length);
      const validity = new Uint8Array(length);
      for (let index = 0; index < length; index += 1) {
        const sampleIndex = startSampleIndex + index;
        timeMs[index] = sampleIndex * 10;
        rangeValues[index] = sourceValues[sampleIndex] ?? Number.NaN;
        validity[index] = invalid.includes(sampleIndex) ? 0 : 1;
      }
      return { startSampleIndex, timeMs, values: rangeValues, validity };
    },
  };
}

describe('searchChannelValues', () => {
  it('ranks maximum values across bounded chunks and ignores invalid samples', async () => {
    const results = await searchChannelValues(
      source({ rpm: [100, 500, 300, 900, 700, 1200, 1100] }, [5]),
      { channelId: 'rpm', mode: 'max', resultLimit: 3, chunkSize: 2 },
    );

    expect(results.map((result) => result.value)).toEqual([1100, 900, 700]);
    expect(results.map((result) => result.sampleIndex)).toEqual([6, 3, 4]);
  });

  it('finds closest values and keeps earlier time first on equal distance', async () => {
    const results = await searchChannelValues(
      source({ map: [80, 95, 105, 120] }),
      { channelId: 'map', mode: 'closest', targetValue: 100, resultLimit: 2, chunkSize: 2 },
    );

    expect(results.map((result) => result.value)).toEqual([95, 105]);
  });

  it('applies a secondary channel constraint before ranking', async () => {
    const results = await searchChannelValues(
      source({
        rpm: [1000, 2000, 3000, 4000, 5000],
        tps: [20, 40, 85, 95, 60],
      }),
      {
        channelId: 'rpm',
        mode: 'max',
        constraint: { channelId: 'tps', operator: 'gte', value: 80 },
        resultLimit: 5,
        chunkSize: 2,
      },
    );

    expect(results.map((result) => result.value)).toEqual([4000, 3000]);
    expect(results.map((result) => result.constraintValue)).toEqual([95, 85]);
  });
  it('jumps to the next ranked result that differs by the configured value step', () => {
    const results = [
      { rank: 1, sampleIndex: 0, timeMs: 0, value: 5000 },
      { rank: 2, sampleIndex: 1, timeMs: 10, value: 4998 },
      { rank: 3, sampleIndex: 2, timeMs: 20, value: 4975 },
      { rank: 4, sampleIndex: 3, timeMs: 30, value: 4890 },
    ];

    expect(findSteppedSearchResultIndex(results, 0, 1, 100)).toBe(3);
    expect(findSteppedSearchResultIndex(results, 3, -1, 100)).toBe(1);
    expect(findSteppedSearchResultIndex(results, 0, 1, 0)).toBe(1);
  });

  it('returns undefined when no later result meets the configured value step', () => {
    const results = [
      { rank: 1, sampleIndex: 0, timeMs: 0, value: 100 },
      { rank: 2, sampleIndex: 1, timeMs: 10, value: 99.5 },
    ];

    expect(findSteppedSearchResultIndex(results, 0, 1, 10)).toBeUndefined();
  });
});
