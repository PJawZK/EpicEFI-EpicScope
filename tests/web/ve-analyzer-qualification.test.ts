import { describe, expect, it } from 'vitest';
import type { ChannelDefinition, NumericChannelRange } from '../../core/log-model/log-types';
import {
  applyVeQualificationValidity,
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

  it('prefers canonical CLT and TPS source identities without changing their names', () => {
    const channels = [
      channel('clt-threshold', 'cltFanOn', 'C'),
      channel('coolant-pressure', 'coolantPressure', 'kPa', 'Coolant pressure'),
      channel('coolant', 'CLT', 'C', 'Coolant temperature'),
      channel('tps-rate', 'tpsRate', '%/s'),
      channel('tps', 'TPS', '%', 'Throttle position'),
    ];
    expect(preferredVeQualificationChannel(channels, 'clt')?.sourceName).toBe('CLT');
    expect(preferredVeQualificationChannel(channels, 'tps')?.sourceName).toBe('TPS');
  });

  it('never exposes coolant pressure as a CLT temperature candidate', () => {
    expect(veQualificationChannelCompatible(channel('pressure', 'coolantPressure', 'kPa'), 'clt')).toBe(false);
    expect(veQualificationChannelCompatible(channel('pressure2', 'Coolant Pressure', 'bar'), 'clt')).toBe(false);
    expect(veQualificationChannelCompatible(channel('coolant', 'coolant', 'deg C'), 'clt')).toBe(true);
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
});