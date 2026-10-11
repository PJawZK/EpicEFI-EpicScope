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
    expect(result.events[0]).toMatchObject({
      commandSampleIndex: 2,
      responseSampleIndex: 4,
      onsetDelayMs: 200,
      commandDelta: 2,
      rpm: 2000,
      load: 70,
    });
    expect(result.events[1]).toMatchObject({
      commandSampleIndex: 6,
      responseSampleIndex: 7,
      onsetDelayMs: 100,
      commandDelta: -2,
      rpm: 2400,
      load: 65,
    });
    expect(result.onsetDelay?.medianMs).toBe(150);
    expect(result.onsetDelay?.p10Ms).toBe(110);
    expect(result.onsetDelay?.p90Ms).toBe(190);
    expect(result.evidenceStrength).toBe('limited');
  });

  it('rejects a candidate when another strong fuel-command transition overlaps before AFR responds', () => {
    const result = analyzeAfrDelay({
      fuelCommand: range([1, 1, 3, 4, 4, 4]),
      actualAfr: range([14.7, 14.7, 14.7, 14.7, 14.6, 14.0]),
    }, {
      commandDeltaThreshold: 1,
      afrResponseThreshold: 0.2,
      searchWindowMs: 500,
    });

    expect(result.candidateEventCount).toBe(1);
    expect(result.usableEventCount).toBe(0);
    expect(result.rejectedOverlapCount).toBe(1);
  });

  it('does not bridge qualification/source-index gaps while searching for AFR response', () => {
    const result = analyzeAfrDelay({
      fuelCommand: range([1, 1, 3, 3, 3, 3]),
      actualAfr: range([14.7, 14.7, 14.7, 14.5, 14.0, 13.8]),
    }, {
      commandDeltaThreshold: 1,
      afrResponseThreshold: 0.2,
      searchWindowMs: 500,
    }, [0, 1, 2, 4, 5]);

    expect(result.candidateEventCount).toBe(1);
    expect(result.usableEventCount).toBe(0);
    expect(result.rejectedGapCount).toBe(1);
  });

  it('supports same-direction response semantics when the selected command channel requires it', () => {
    const result = analyzeAfrDelay({
      fuelCommand: range([10, 10, 12, 12, 12]),
      actualAfr: range([14.0, 14.0, 14.0, 14.4, 14.8]),
    }, {
      commandDeltaThreshold: 1,
      afrResponseThreshold: 0.2,
      responsePolarity: 'same',
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
});
