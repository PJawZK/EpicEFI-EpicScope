import { describe, expect, it } from 'vitest';
import type { NumericChannelDataSource } from '../../core/log-model/log-types';
import { searchChannelValues } from '../../core/analysis/channel-value-search';

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
});
