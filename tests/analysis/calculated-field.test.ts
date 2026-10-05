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

  it('rejects malformed references', () => {
    expect(() => compileCalculatedField('[AFR')).toThrow(/closing/);
    expect(() => compileCalculatedField('[] + 1')).toThrow(/must not be empty/);
  });
});
