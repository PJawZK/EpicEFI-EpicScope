import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { analyzeAfrDelay } from '../../core/analysis/afr-delay-analyzer';

function range(values: readonly number[], stepMs = 100, startSampleIndex = 0): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * stepMs)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(values.map(() => 1)),
  };
}

// Isolated alternating command steps have known onset/peak timing, deliberately
// out of timing order. Quiet space between events prevents overlap/gap rejection.
function isolatedEvents(delays: readonly number[], sampleCount = delays.length * 30) {
  const command = new Float64Array(sampleCount).fill(2);
  const afr = new Float64Array(sampleCount).fill(16);
  for (let block = 0; block < delays.length; block += 1) {
    const start = block * 30;
    const positive = block % 2 === 0;
    const before = positive ? 2 : 4;
    command.fill(before, start, start + 2);
    command.fill(positive ? 4 : 2, start + 2, start + 30);
    const response = start + 2 + delays[block]!;
    afr.fill(16 + (positive ? -1 : 1), response, response + 1);
    afr.fill(16 + (positive ? -2 : 2), response + 1, start + 30);
  }
  const numericRange = (values: Float64Array): NumericChannelRange => ({ startSampleIndex: 0, values, timeMs: Float64Array.from({ length: sampleCount }, (_, index) => index * 10), validity: new Uint8Array(sampleCount).fill(1) });
  return { fuelCommand: numericRange(command), actualAfr: numericRange(afr) };
}
const timingConfig = { commandDeltaThreshold: 1, afrResponseThreshold: 0.5, searchWindowMs: 100, minimumEventSpacingMs: 0 };

describe('AFR response-delay analyzer', () => {
  it('estimates onset delay from isolated fuel-command transitions', () => {
    const result = analyzeAfrDelay({
      fuelCommand: range([1, 1, 3, 3, 3, 3, 1, 1, 1]),
      actualAfr: range([14.7, 14.7, 14.7, 14.7, 14.3, 13.7, 13.7, 14.0, 14.6]),
      rpm: range([1800, 1900, 2000, 2100, 2200, 2300, 2400, 2500, 2600]),
      load: range([40, 45, 70, 75, 80, 85, 65, 50, 40]),
    }, {
      commandDeltaThreshold: 1,
      afrResponseThreshold: 0.2,
      searchWindowMs: 500,
      minimumEventSpacingMs: 250,
      responsePolarity: 'inverse',
    });

    expect(result.candidateEventCount).toBe(2);
    expect(result.usableEventCount).toBe(2);
    expect(result.events[0]).toMatchObject({ commandSampleIndex: 2, responseSampleIndex: 4, onsetDelayMs: 200, commandDelta: 2, rpm: 2000, load: 70 });
    expect(result.events[1]).toMatchObject({ commandSampleIndex: 6, responseSampleIndex: 7, onsetDelayMs: 100, commandDelta: -2, rpm: 2400, load: 65 });
    expect(result.onsetDelay?.medianMs).toBe(150);
    expect(result.onsetDelay?.p10Ms).toBe(110);
    expect(result.onsetDelay?.p90Ms).toBe(190);
    expect(result.evidenceStrength).toBe('limited');
  });

  it('uses the same response timing logic with Lambda-scale mixture values', () => {
    const result = analyzeAfrDelay({
      fuelCommand: range([1, 1, 3, 3, 3, 3]),
      actualAfr: range([1.00, 1.00, 1.00, 1.00, 0.97, 0.92]),
    }, {
      commandDeltaThreshold: 1,
      afrResponseThreshold: 0.015,
      searchWindowMs: 500,
      responsePolarity: 'inverse',
    });
    expect(result.usableEventCount).toBe(1);
    expect(result.events[0]?.onsetDelayMs).toBe(200);
    expect(result.events[0]?.responseAfr).toBeCloseTo(0.97, 8);
  });

  it('rejects a candidate when another strong fuel-command transition overlaps before AFR responds', () => {
    const result = analyzeAfrDelay({ fuelCommand: range([1, 1, 3, 4, 4, 4]), actualAfr: range([14.7, 14.7, 14.7, 14.7, 14.6, 14.0]) }, {
      commandDeltaThreshold: 1, afrResponseThreshold: 0.2, searchWindowMs: 500,
    });
    expect(result.candidateEventCount).toBe(1);
    expect(result.usableEventCount).toBe(0);
    expect(result.rejectedOverlapCount).toBe(1);
  });

  it('does not bridge qualification/source-index gaps while searching for AFR response', () => {
    const result = analyzeAfrDelay({ fuelCommand: range([1, 1, 3, 3, 3, 3]), actualAfr: range([14.7, 14.7, 14.7, 14.5, 14.0, 13.8]) }, {
      commandDeltaThreshold: 1, afrResponseThreshold: 0.2, searchWindowMs: 500,
    }, [0, 1, 2, 4, 5]);
    expect(result.candidateEventCount).toBe(1);
    expect(result.usableEventCount).toBe(0);
    expect(result.rejectedGapCount).toBe(1);
  });

  it('supports same-direction response semantics when the selected command channel requires it', () => {
    const result = analyzeAfrDelay({ fuelCommand: range([10, 10, 12, 12, 12]), actualAfr: range([14.0, 14.0, 14.0, 14.4, 14.8]) }, {
      commandDeltaThreshold: 1, afrResponseThreshold: 0.2, responsePolarity: 'same',
    });
    expect(result.usableEventCount).toBe(1);
    expect(result.events[0]?.onsetDelayMs).toBe(100);
  });

  it('validates thresholds and timing configuration', () => {
    expect(() => analyzeAfrDelay({ fuelCommand: range([1]), actualAfr: range([14.7]) }, { commandDeltaThreshold: 0, afrResponseThreshold: 0.2 })).toThrow(RangeError);
    expect(() => analyzeAfrDelay({ fuelCommand: range([1]), actualAfr: range([14.7]) }, { commandDeltaThreshold: 1, afrResponseThreshold: 0 })).toThrow(RangeError);
    expect(() => analyzeAfrDelay({ fuelCommand: range([1]), actualAfr: range([14.7]) }, { commandDeltaThreshold: 1, afrResponseThreshold: 0.2, searchWindowMs: 0 })).toThrow(RangeError);
    expect(() => analyzeAfrDelay({ fuelCommand: range([1]), actualAfr: range([14.7]) }, { commandDeltaThreshold: 1, afrResponseThreshold: 0.2, minimumEventSpacingMs: -1 })).toThrow(RangeError);
  });
  it('interpolates an unsorted duplicate/even distribution without reordering events or changing inputs', () => {
    const inputs = isolatedEvents([1, 4, 2, 3, 1, 5]);
    const originalCommand = inputs.fuelCommand.values.slice();
    const originalAfr = inputs.actualAfr.values.slice();
    const result = analyzeAfrDelay(inputs, timingConfig);
    expect(result.usableEventCount).toBe(6);
    expect(result.events.map(event => event.onsetDelayMs)).toEqual([10, 40, 20, 30, 10, 50]);
    expect(result.onsetDelay).toEqual({ minimumMs: 10, p10Ms: 10, medianMs: 25, p90Ms: 45, maximumMs: 50 });
    expect(result.medianT50Ms).toBe(25);
    expect(result.medianT90Ms).toBe(35);
    expect(inputs.fuelCommand.values).toEqual(originalCommand);
    expect(inputs.actualAfr.values).toEqual(originalAfr);
  });

  it('preserves empty and single-event distribution boundaries', () => {
    const empty = analyzeAfrDelay({ fuelCommand: range([2, 2]), actualAfr: range([16, 16]) }, timingConfig);
    expect(empty.onsetDelay).toBeUndefined();
    expect(empty.medianT50Ms).toBeUndefined();
    expect(empty.medianT90Ms).toBeUndefined();
    const single = analyzeAfrDelay(isolatedEvents([3]), timingConfig);
    expect(single.onsetDelay).toEqual({ minimumMs: 30, p10Ms: 30, medianMs: 30, p90Ms: 30, maximumMs: 30 });
    expect(single.medianT50Ms).toBe(30);
    expect(single.medianT90Ms).toBe(40);
  });

  it('handles more than 320k valid samples with many isolated events and stable percentile results', () => {
    const delays = Array.from({ length: 10684 }, (_, index) => [1, 4, 2, 3][index % 4]!);
    const inputs = isolatedEvents(delays); // 320520 continuous valid samples
    const result = analyzeAfrDelay(inputs, timingConfig);
    expect(result.usableEventCount).toBe(delays.length);
    expect(result.rejectedGapCount + result.rejectedOverlapCount + result.rejectedNoResponseCount).toBe(0);
    expect(result.onsetDelay).toEqual({ minimumMs: 10, p10Ms: 10, medianMs: 25, p90Ms: 40, maximumMs: 40 });
    expect(result.medianT50Ms).toBe(25);
    expect(result.medianT90Ms).toBe(35);
    expect(result.events.at(-1)?.commandSampleIndex).toBe((delays.length - 1) * 30 + 2);
  });

});
