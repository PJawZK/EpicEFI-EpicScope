import { describe, expect, it } from 'vitest';
import { compileCalculatedField, evaluateCalculatedFieldRange } from '../../core/analysis/calculated-field';
import type { NumericChannelRange } from '../../core/log-model/log-types';

function range(startSampleIndex: number, values: readonly number[], validity?: readonly number[]): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => (startSampleIndex + index) * 10)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('calculated fields', () => {
  it('evaluates arithmetic, precedence, channel references, and safe functions', () => {
    const program = compileCalculatedField('([AFR] - [Target AFR]) * 100 / max([Target AFR], 0.1)');
    expect(program.references).toEqual(['AFR', 'Target AFR']);
    expect(program.evaluate((reference) => reference === 'AFR' ? 14.7 : 14)).toBeCloseTo(5);
  });

  it('supports unary operators, powers, and clamp', () => {
    const program = compileCalculatedField('clamp(-[x] + 2^3, 0, 10)');
    expect(program.evaluate(() => 3)).toBe(5);
  });

  it('aligns referenced ranges by source sample index and marks missing/invalid inputs invalid', () => {
    const program = compileCalculatedField('[A] - [B]');
    const result = evaluateCalculatedFieldRange(program, new Map([
      ['A', range(10, [10, 20, 30, 40])],
      ['B', range(11, [1, 2], [1, 0])],
    ]));
    expect(result.startSampleIndex).toBe(10);
    expect([...result.validity]).toEqual([0, 1, 0, 0]);
    expect(result.values[1]).toBe(19);
    expect(Number.isNaN(result.values[0]!)).toBe(true);
  });

  it('rejects unsafe identifiers and expressions without channel references', () => {
    expect(() => compileCalculatedField('window.alert(1)')).toThrow();
    expect(() => compileCalculatedField('2 + 3')).toThrow(/reference at least one channel/);
  });

  it('supports comparisons, word/symbol logic and lazy conditional branches', () => {
    const logical = compileCalculatedField('[TPS] > 50 AND [RPM] >= 3000 OR NOT [Enabled]');
    expect(logical.evaluate((reference) => ({ TPS: 60, RPM: 3200, Enabled: 1 }[reference] ?? 0))).toBe(1);
    expect(logical.evaluate((reference) => ({ TPS: 10, RPM: 3200, Enabled: 1 }[reference] ?? 0))).toBe(0);
    const conditional = compileCalculatedField('if([A] > 0, sqrt([A]), 0)');
    expect(conditional.evaluate(() => -4)).toBe(0);
  });

  it('supports historical bindings and temporal lag/delta/average/rate helpers', () => {
    const source = range(0, [10, 20, 40, 70]);
    const historical = evaluateCalculatedFieldRange(compileCalculatedField('[A] - [A-1]'), new Map<string, NumericChannelRange | { range: NumericChannelRange; sampleOffset: number }>([
      ['A', source],
      ['A-1', { range: source, sampleOffset: 1 }],
    ]));
    expect([...historical.validity]).toEqual([0, 1, 1, 1]);
    expect([...historical.values].slice(1)).toEqual([10, 20, 30]);

    const temporal = evaluateCalculatedFieldRange(compileCalculatedField('lag([A], 1) + delta([A], 1) + avg([A], 2) + rate([A], 1)'), new Map([['A', source]]));
    expect([...temporal.validity]).toEqual([0, 1, 1, 1]);
    expect(temporal.values[1]).toBeCloseTo(10 + 10 + 15 + 1000);
    expect(temporal.values[2]).toBeCloseTo(20 + 20 + 30 + 2000);
  });

  it('rejects malformed references', () => {
    expect(() => compileCalculatedField('[AFR')).toThrow(/closing/);
    expect(() => compileCalculatedField('[] + 1')).toThrow(/must not be empty/);
  });
});
