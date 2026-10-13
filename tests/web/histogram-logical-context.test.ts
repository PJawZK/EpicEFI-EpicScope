import { describe, expect, it } from 'vitest';
import type { ChannelDefinition, NumericChannelRange } from '../../core/log-model/log-types';
import {
  createHistogramLogicalContext,
  histogramFormulaChannelId,
} from '../../apps/web/src/pages/histogram-logical-context';
import type { HistogramPageContext, HistogramTraceContext } from '../../apps/web/src/pages/histogram-page';
import type { HistogramCalculatedFieldDefinition } from '../../apps/web/src/state/histogram-table-storage';

function channel(id: string, displayName = id, unit?: string): ChannelDefinition {
  return {
    id,
    sourceName: displayName,
    displayName,
    valueType: 'number',
    ...(unit ? { unit } : {}),
  };
}

function range(startSampleIndex: number, values: readonly number[], times?: readonly number[]): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(times ?? values.map((_, index) => index * 100)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(values.map(() => 1)),
  };
}

function trace(definition: ChannelDefinition, values: readonly number[], complete = true): HistogramTraceContext {
  return {
    channel: definition,
    range: range(0, values),
    complete,
    color: definition.id === 'fuel' ? '#112233' : '#445566',
  };
}

function context(
  channels: readonly ChannelDefinition[],
  traces: readonly HistogramTraceContext[],
  requests: string[][],
): HistogramPageContext {
  const byId = new Map(traces.map((item) => [item.channel.id, item]));
  return {
    traces,
    channels,
    aTimeMs: undefined,
    bTimeMs: undefined,
    loadTraces: async (ids) => {
      requests.push([...ids]);
      return ids.flatMap((id) => {
        const item = byId.get(id);
        return item ? [item] : [];
      });
    },
  };
}

const differential: HistogramCalculatedFieldDefinition = {
  id: 'rail-diff',
  name: 'Rail Differential',
  expression: '[Fuel Pressure] - [MAP]',
  unit: 'kPa',
};

describe('Histogram logical analysis context', () => {
  it('publishes saved Math Channels as virtual analysis channels', () => {
    const fuel = channel('fuel', 'Fuel Pressure', 'kPa');
    const map = channel('map', 'MAP', 'kPa');
    const logical = createHistogramLogicalContext(context([fuel, map], [], []), [differential]);

    expect(logical.channels.map((item) => item.id)).toEqual(['fuel', 'map', 'formula:rail-diff']);
    expect(logical.channels[2]).toMatchObject({
      sourceName: 'Rail Differential',
      displayName: 'ƒ Rail Differential',
      category: 'Calculated',
      unit: 'kPa',
    });
  });

  it('materializes a Math Channel from only its physical dependencies', async () => {
    const fuel = channel('fuel', 'Fuel Pressure', 'kPa');
    const map = channel('map', 'MAP', 'kPa');
    const requests: string[][] = [];
    const logical = createHistogramLogicalContext(context(
      [fuel, map],
      [trace(fuel, [300, 320, 350]), trace(map, [100, 110, 125])],
      requests,
    ), [differential]);

    const loaded = await logical.loadTraces([histogramFormulaChannelId(differential.id)]);

    expect(requests).toEqual([['fuel', 'map']]);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.channel.id).toBe('formula:rail-diff');
    expect([...loaded[0]!.range.values]).toEqual([200, 210, 225]);
    expect([...loaded[0]!.range.validity]).toEqual([1, 1, 1]);
    expect(loaded[0]?.complete).toBe(true);
    expect(loaded[0]?.color).toBe('#112233');
  });

  it('returns physical and calculated traces together without reloading duplicate dependencies', async () => {
    const fuel = channel('fuel', 'Fuel Pressure', 'kPa');
    const map = channel('map', 'MAP', 'kPa');
    const requests: string[][] = [];
    const logical = createHistogramLogicalContext(context(
      [fuel, map],
      [trace(fuel, [300, 320]), trace(map, [100, 110])],
      requests,
    ), [differential]);

    const loaded = await logical.loadTraces(['map', 'formula:rail-diff']);

    expect(requests).toEqual([['map', 'fuel']]);
    expect(loaded.map((item) => item.channel.id)).toEqual(['map', 'formula:rail-diff']);
  });

  it('treats bounded partial dependencies as complete only when they cover the requested scope', async () => {
    const fuel = channel('fuel', 'Fuel Pressure', 'kPa');
    const map = channel('map', 'MAP', 'kPa');
    const fuelTrace: HistogramTraceContext = {
      channel: fuel,
      range: range(0, [300, 320, 350], [100, 200, 300]),
      complete: false,
      color: '#112233',
    };
    const mapTrace: HistogramTraceContext = {
      channel: map,
      range: range(0, [100, 110, 125], [100, 200, 300]),
      complete: false,
      color: '#445566',
    };
    const base = context([fuel, map], [fuelTrace, mapTrace], []);
    const logical = createHistogramLogicalContext(base, [differential]);

    const scoped = await logical.loadTraces(['formula:rail-diff'], 100, 300);
    const wholeLog = await logical.loadTraces(['formula:rail-diff']);

    expect(scoped[0]?.complete).toBe(true);
    expect(wholeLog[0]?.complete).toBe(false);
  });

  it('keeps formula references physical and reports missing or ambiguous references', async () => {
    const fuel = channel('fuel', 'Fuel Pressure');
    const mapA = channel('map-a', 'MAP');
    const mapB = channel('map-b', 'MAP');
    const missing: HistogramCalculatedFieldDefinition = {
      id: 'missing',
      name: 'Missing',
      expression: '[Fuel Pressure] - [No Such Channel]',
    };
    const nested: HistogramCalculatedFieldDefinition = {
      id: 'nested',
      name: 'Nested',
      expression: '[Rail Differential] * 2',
    };

    const missingContext = createHistogramLogicalContext(context([fuel], [trace(fuel, [1])], []), [missing]);
    await expect(missingContext.loadTraces(['formula:missing'])).rejects.toThrow(/not found/i);

    const ambiguousContext = createHistogramLogicalContext(context(
      [fuel, mapA, mapB],
      [trace(fuel, [1]), trace(mapA, [1]), trace(mapB, [1])],
      [],
    ), [differential]);
    await expect(ambiguousContext.loadTraces(['formula:rail-diff'])).rejects.toThrow(/ambiguous/i);

    const nestedContext = createHistogramLogicalContext(context([fuel], [trace(fuel, [1])], []), [differential, nested]);
    await expect(nestedContext.loadTraces(['formula:nested'])).rejects.toThrow(/not found/i);
  });
});
