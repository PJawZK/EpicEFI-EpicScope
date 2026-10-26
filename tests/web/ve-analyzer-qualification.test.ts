import { describe, expect, it } from 'vitest';
import type { ChannelDefinition, NumericChannelRange } from '../../core/log-model/log-types';
import {
  applyVeQualificationValidity,
  applyVeQualificationValidityBatch,
  preferredVeQualificationChannel,
  VE_CELL_CHANGE_PRIOR_WEIGHT,
  veCellChangeAuthorityForPrior,
  veQualificationChannelCompatible,
  veQualificationSamplePasses,
} from '../../apps/web/src/pages/ve-analyzer-qualification';

function channel(id: string, sourceName: string, unit?: string, displayName = sourceName): ChannelDefinition {
  return { id, sourceName, displayName, valueType: 'number', ...(unit ? { unit } : {}) };
}

function range(values: readonly number[], startSampleIndex = 0): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * 10)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(values.map(() => 1)),
  };
}

describe('VE Analyzer quick qualification', () => {
  it('keeps Normal mapped to the existing prior-weight authority', () => {
    expect(VE_CELL_CHANGE_PRIOR_WEIGHT.normal).toBe(20);
    expect(VE_CELL_CHANGE_PRIOR_WEIGHT.responsive).toBeLessThan(VE_CELL_CHANGE_PRIOR_WEIGHT.normal);
    expect(VE_CELL_CHANGE_PRIOR_WEIGHT.conservative).toBeGreaterThan(VE_CELL_CHANGE_PRIOR_WEIGHT.normal);
    expect(veCellChangeAuthorityForPrior(20)).toBe('normal');
    expect(veCellChangeAuthorityForPrior(17)).toBe('custom');
  });

  it('prefers literal Coolant [deg C] for CLT while preserving other valid choices', () => {
    const channels = [
      channel('clt-threshold', 'cltFanOn', 'C'),
      channel('coolant-pressure', 'coolantPressure', 'kPa', 'Coolant pressure'),
      channel('cel-clt', 'cel_clt', 'C', 'CLT check engine diagnostic'),
      channel('clt', 'CLT', 'C', 'Coolant temperature'),
      channel('coolant-deg', 'Coolant', 'deg', 'Coolant'),
      channel('coolant', 'Coolant', 'deg C', 'Coolant'),
      channel('tps-rate', 'tpsRate', '%/s'),
      channel('tps', 'TPS', '%', 'Throttle position'),
    ];
    expect(preferredVeQualificationChannel(channels, 'clt')?.sourceName).toBe('Coolant');
    expect(preferredVeQualificationChannel(channels, 'clt')?.unit).toBe('deg C');
    expect(preferredVeQualificationChannel(channels, 'tps')?.sourceName).toBe('TPS');
    expect(veQualificationChannelCompatible(channel('clt', 'CLT', 'C'), 'clt')).toBe(true);
  });

  it('never exposes coolant pressure or CEL diagnostics as CLT temperature candidates', () => {
    expect(veQualificationChannelCompatible(channel('pressure', 'coolantPressure', 'kPa'), 'clt')).toBe(false);
    expect(veQualificationChannelCompatible(channel('pressure2', 'Coolant Pressure', 'bar'), 'clt')).toBe(false);
    expect(veQualificationChannelCompatible(channel('cel-clt', 'cel_clt', 'C'), 'clt')).toBe(false);
    expect(veQualificationChannelCompatible(channel('check-engine-clt', 'checkEngineClt', 'C', 'Check Engine CLT'), 'clt')).toBe(false);
    expect(veQualificationChannelCompatible(channel('coolant', 'coolant', 'deg C'), 'clt')).toBe(true);
    expect(veQualificationChannelCompatible(channel('coolant-deg', 'Coolant', 'deg'), 'clt')).toBe(true);
    expect(veQualificationChannelCompatible(channel('clt', 'CLT', 'C'), 'clt')).toBe(true);
  });

  it('rejects samples below minimum CLT or outside TPS limits', () => {
    const clt = range([60, 75, 85]);
    const tps = range([5, 15, 95]);
    const settings = { minimumClt: 70, minimumTps: 10, maximumTps: 90 };
    expect(veQualificationSamplePasses(0, settings, clt, tps)).toBe(false);
    expect(veQualificationSamplePasses(1, settings, clt, tps)).toBe(true);
    expect(veQualificationSamplePasses(2, settings, clt, tps)).toBe(false);
  });

  it('treats absent optional bounds as full-range qualification', () => {
    const source = range([1, 2, 3]);
    expect(veQualificationSamplePasses(0, {})).toBe(true);
    expect(veQualificationSamplePasses(1, {})).toBe(true);
    const qualified = applyVeQualificationValidity(source, {});
    expect([...qualified.validity]).toEqual([1, 1, 1]);
  });

  it('projects qualification into validity without changing values or indexing', () => {
    const source = range([1000, 1100, 1200], 20);
    const clt = range([50, 80, 90], 20);
    const qualified = applyVeQualificationValidity(source, { minimumClt: 70 }, clt);
    expect([...qualified.validity]).toEqual([0, 1, 1]);
    expect([...qualified.values]).toEqual([1000, 1100, 1200]);
    expect(qualified.startSampleIndex).toBe(20);
  });

  it('fails closed when an enabled qualification has no usable source sample', () => {
    const source = range([1, 2]);
    const qualified = applyVeQualificationValidity(source, { minimumClt: 70 });
    expect([...qualified.validity]).toEqual([0, 0]);
  });
  it('shares aligned decisions without losing each trace validity or scoped geometry', () => {
    const clt = range([50, 80, 90, 60, 100], 20), tps = range([10, 20, 95, 30, 40], 20);
    const first = range([1, 2, 3, 4], 20); first.validity.set([0, 1, 1, 1]);
    const second = range([5, 6, 7, 8], 20); second.validity.set([1, 0, 2, 1]);
    const shifted = range([1, 2, 3, 4], 21), short = range([1, 2], 20), outside = range([1, 2], 30);
    const inputs = [first, second, shifted, short, outside];
    const originals = inputs.map(input => input.validity.slice());
    const settings = { minimumClt: 70, maximumTps: 90 };
    const output = applyVeQualificationValidityBatch(inputs, settings, clt, tps);
    for (const [index, input] of inputs.entries()) {
      expect(output[index]?.validity).toEqual(applyVeQualificationValidity(input, settings, clt, tps).validity);
      expect(input.validity).toEqual(originals[index]);
      expect(output[index]?.values).toBe(input.values);
      expect(output[index]?.timeMs).toBe(input.timeMs);
    }
    expect([...output[1]!.validity]).toEqual([0, 0, 2, 0]);
    expect(applyVeQualificationValidityBatch(inputs, {})).toBe(inputs);
    const changed = applyVeQualificationValidityBatch(inputs, { minimumClt: 0 }, clt);
    expect([...changed[0]!.validity]).toEqual([0, 1, 1, 1]);
    expect([...applyVeQualificationValidityBatch(inputs, settings)[0]!.validity]).toEqual([0, 0, 0, 0]);
  });

  it('preserves twelve independently valid traces above 320k samples', () => {
    const count = 320_459;
    const source: NumericChannelRange = { startSampleIndex: 100, values: new Float64Array(count).fill(80),
      timeMs: Float64Array.from({ length: count }, (_, index) => index * 10), validity: new Uint8Array(count).fill(1) };
    const inputs = Array.from({ length: 12 }, (_, index) => {
      const validity = new Uint8Array(source.validity); validity[index] = 0;
      return { ...source, validity };
    });
    const output = applyVeQualificationValidityBatch(inputs, { minimumClt: 70 }, source);
    for (let index = 0; index < inputs.length; index += 1) {
      expect(output[index]!.validity.every((value, sample) => value === inputs[index]!.validity[sample])).toBe(true);
      expect(output[index]!.validity === inputs[index]!.validity).toBe(false);
    }
  });

});
