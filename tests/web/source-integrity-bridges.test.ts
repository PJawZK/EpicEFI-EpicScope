import { describe, expect, it } from 'vitest';
import { createOrderedBridgeLookup } from '../../apps/web/src/components/source-integrity-bridges';
function range(times: number[], values: number[], valid: number[]) {
  return { startSampleIndex: 0, timeMs: Float64Array.from(times), values: Float64Array.from(values), validity: Uint8Array.from(valid) };
}
describe('draw-local ordered integrity bridges', () => {
  it('uses strictly earlier/later trusted endpoints across duplicates and nonfinite values', () => {
    const lookup = createOrderedBridgeLookup(range([0, 10, 10, 20, 30], [1, 2, 99, NaN, 4], [1, 1, 0, 1, 1]));
    expect(lookup(0)).toBeUndefined();
    expect(lookup(10)).toEqual({ before: { timeMs: 0, value: 1 }, after: { timeMs: 30, value: 4 } });
    expect(lookup(10)).toEqual({ before: { timeMs: 0, value: 1 }, after: { timeMs: 30, value: 4 } });
    expect(lookup(20)).toEqual({ before: { timeMs: 10, value: 2 }, after: { timeMs: 30, value: 4 } });
    expect(lookup(30)).toBeUndefined();
  });
  it('starts fresh each draw after mutable validity/value changes', () => {
    const source = range([0, 10, 20, 30], [1, 2, 3, 4], [1, 0, 0, 1]);
    expect(createOrderedBridgeLookup(source)(10)?.after.timeMs).toBe(30);
    source.validity[2] = 1;
    expect(createOrderedBridgeLookup(source)(10)?.after).toEqual({ timeMs: 20, value: 3 });
    source.values[2] = NaN;
    expect(createOrderedBridgeLookup(source)(10)?.after.timeMs).toBe(30);
    expect(createOrderedBridgeLookup(range([], [], []))(10)).toBeUndefined();
  });
  it('jumps over distant valid spans rather than scanning between sparse markers', () => {
    const count = 320_005;
    let reads = 0;
    const values = new Proxy(Float64Array.from({ length: count }, (_, i) => i), {
      get(target, key) {
        if (typeof key === 'string' && /^\d+$/.test(key) && ++reads > 20) throw Error('Scanned a valid span');
        return Reflect.get(target, key, target);
      },
    });
    const lookup = createOrderedBridgeLookup({ startSampleIndex: 0, timeMs: Float64Array.from({ length: count }, (_, i) => i), values, validity: new Uint8Array(count).fill(1) });
    expect(lookup(1)?.after.timeMs).toBe(2);
    expect(lookup(count - 2)?.before.timeMs).toBe(count - 3);
    expect(reads).toBeLessThanOrEqual(20);
  });
});
