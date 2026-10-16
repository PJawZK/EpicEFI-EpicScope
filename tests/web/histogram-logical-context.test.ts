import { describe, expect, it } from 'vitest';
import type { ChannelDefinition, NumericChannelRange } from '../../core/log-model/log-types';
import {
  createHistogramLogicalContext,
  histogramFormulaChannelId,
  prepareHistogramFormula,
  evaluateHistogramFormula,
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

  it('resolves MLV-style historical references against the physical channel without duplicate loads', async () => {
    const rpm = channel('rpm', 'RPM', 'rpm');
    const requests: string[][] = [];
    const change: HistogramCalculatedFieldDefinition = { id: 'rpm-change', name: 'RPM Change', expression: '[RPM] - [RPM-1]', unit: 'rpm/sample' };
    const logical = createHistogramLogicalContext(context([rpm], [trace(rpm, [1000, 1100, 1300])], requests), [change]);
    const loaded = await logical.loadTraces(['formula:rpm-change']);
    expect(requests).toEqual([['rpm']]);
    expect([...loaded[0]!.range.validity]).toEqual([0, 1, 1]);
    expect([...loaded[0]!.range.values].slice(1)).toEqual([100, 200]);
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


describe('shared Histogram formula preparation and evaluation', () => {
  it('matches physical IDs/source/display names and gives literal offset-like names precedence', () => {
    const rpm = { ...channel('rpm', 'Engine speed'), sourceName: 'RPM' };
    const literal = channel('literal', 'RPM-1');
    const plan = prepareHistogramFormula('[rpm] + [ engine SPEED ] + [RPM-1]', [rpm, literal]);
    expect(plan.physicalIds).toEqual(['rpm', 'literal']);
    expect([...plan.references.values()].map((item) => [item.channel.id, item.sampleOffset]))
      .toEqual([['rpm', 0], ['rpm', 0], ['literal', 0]]);
    const historical = prepareHistogramFormula('[RPM-1]', [rpm]);
    expect(historical.references.get('RPM-1')).toEqual({ channel: rpm, sampleOffset: 1 });
  });

  it('keeps ambiguous, missing, nested and syntax errors explicit with caller-owned labels', () => {
    const rpm = channel('rpm', 'RPM');
    const virtual = channel('formula:double', 'Double RPM');
    expect(() => prepareHistogramFormula('[RPM]', [rpm, channel('other', 'RPM')])).toThrow('Formula channel reference is ambiguous');
    expect(() => prepareHistogramFormula('[RPM-1]', [rpm, channel('other', 'RPM')])).toThrow('ambiguous');
    expect(() => prepareHistogramFormula('[missing]', [rpm], 'Channel')).toThrow('Channel not found: [missing]');
    expect(() => prepareHistogramFormula('[Double RPM]', [rpm, virtual])).toThrow('not found');
    expect(() => prepareHistogramFormula('[formula:double]', [rpm, virtual])).toThrow('not found');
    expect(() => prepareHistogramFormula('[RPM] +', [rpm])).toThrow();
  });

  it('preserves nonzero sample indices, temporal offsets, timestamps and validity without mutating input', () => {
    const rpm = channel('rpm', 'RPM');
    const source: HistogramTraceContext = { ...trace(rpm, [1000, 1100, 1300, 1600]), range: {
      ...range(25, [1000, 1100, 1300, 1600], [100, 200, 300, 400]), validity: Uint8Array.from([1, 1, 0, 1]),
    } };
    const result = evaluateHistogramFormula(prepareHistogramFormula('[RPM] - [RPM-1]', [rpm]), new Map([['rpm', source]]));
    expect(result?.range.startSampleIndex).toBe(25);
    expect([...result!.range.validity]).toEqual([0, 1, 0, 0]);
    expect(result!.range.values[1]).toBe(100);
    expect([...result!.range.timeMs]).toEqual([100, 200, 300, 400]);
    expect([...source.range.values]).toEqual([1000, 1100, 1300, 1600]);
    expect(result!.range.timeMs).not.toBe(source.range.timeMs);
  });

  it('reports missing loaded dependencies as unavailable and preserves scope coverage/color semantics', () => {
    const fuel = channel('fuel', 'Fuel Pressure');
    const map = channel('map', 'MAP');
    const plan = prepareHistogramFormula(differential.expression, [fuel, map]);
    const first = { ...trace(fuel, [300, 350], false), range: range(4, [300, 350], [100, 300]) };
    const second = { ...trace(map, [100, 120], false), range: range(4, [100, 120], [100, 300]) };
    expect(evaluateHistogramFormula(plan, new Map([['fuel', first]]))).toBeUndefined();
    const loaded = new Map([['fuel', first], ['map', second]]);
    expect(evaluateHistogramFormula(plan, loaded, 300, 100)).toMatchObject({ complete: true, color: '#112233' });
    expect(evaluateHistogramFormula(plan, loaded)?.complete).toBe(false);
    expect(evaluateHistogramFormula(plan, loaded, 0, 300)?.complete).toBe(false);
  });

  it('loads a dependency once across direct fields, offsets and multiple formulas, preserving request order', async () => {
    const rpm = channel('rpm', 'RPM');
    const requests: string[][] = [];
    const fields = [
      { id: 'change', name: 'Change', expression: '[RPM] - [RPM-1]', unit: 'rpm/sample' },
      { id: 'double', name: 'Double', expression: '[rpm] * 2' },
    ];
    const logical = createHistogramLogicalContext(context([rpm], [trace(rpm, [1000, 1100, 1300])], requests), fields);
    const result = await logical.loadTraces(['formula:change', 'rpm', 'formula:double', 'formula:change', '']);
    expect(requests).toEqual([['rpm']]);
    expect(result.map((item) => item.channel.id)).toEqual(['formula:change', 'rpm', 'formula:double']);
    expect(result[0]?.channel).toMatchObject({ displayName: 'ƒ Change', unit: 'rpm/sample', category: 'Calculated' });
    expect([...result[2]!.range.values]).toEqual([2000, 2200, 2600]);
  });

  it('does not publish partially bound formulas or swallow dependency load failures', async () => {
    const fuel = channel('fuel', 'Fuel Pressure');
    const map = channel('map', 'MAP');
    const base = context([fuel, map], [trace(fuel, [300])], []);
    expect(await createHistogramLogicalContext(base, [differential]).loadTraces(['formula:rail-diff'])).toEqual([]);
    const failure = new Error('decode failed');
    const broken = { ...base, loadTraces: async () => { throw failure; } };
    await expect(createHistogramLogicalContext(broken, [differential]).loadTraces(['formula:rail-diff'])).rejects.toBe(failure);
  });
});
