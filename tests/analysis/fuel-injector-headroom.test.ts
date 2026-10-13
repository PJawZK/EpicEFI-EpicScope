import { describe, expect, it } from 'vitest';
import type { NumericChannelRange } from '../../core/log-model/log-types';
import { analyzeFuelPressureInjector } from '../../core/analysis/specialized-analyzers';
import { analyzeFuelInjectorHeadroomContext } from '../../core/analysis/fuel-injector-headroom';

function range(values: readonly number[], validity?: readonly number[], startSampleIndex = 0, stepMs = 100): NumericChannelRange {
  return {
    startSampleIndex,
    timeMs: Float64Array.from(values.map((_, index) => index * stepMs)),
    values: Float64Array.from(values),
    validity: Uint8Array.from(validity ?? values.map(() => 1)),
  };
}

describe('Fuel / Injector headroom and event context', () => {
  it('quantifies injector duty headroom without clamping over-100 duty evidence', () => {
    const reference = range([1000, 1500, 2000, 2500, 3000]);
    const injectorDuty = range([40, 80, 92, 100, 105]);
    const analysis = analyzeFuelPressureInjector({ reference, injectorDuty }, { highDutyThreshold: 90, complete: true });

    const result = analyzeFuelInjectorHeadroomContext(analysis, { reference, injectorDuty }, { highDutyThreshold: 90 });

    expect(result.headroom).toMatchObject({
      validSampleCount: 5,
      highDutySampleCount: 3,
      highDutySamplePercent: 60,
      saturationSampleCount: 2,
      minimumHeadroomPercent: -5,
    });
    expect(result.headroom?.meanHeadroomPercent).toBeCloseTo(16.6);
  });

  it('uses the same selected sample scope for headroom evidence', () => {
    const reference = range([1000, 1500, 2000, 2500, 3000]);
    const injectorDuty = range([40, 80, 92, 100, 105]);
    const analysis = analyzeFuelPressureInjector({ reference, injectorDuty }, { sampleIndices: [1, 2, 4], highDutyThreshold: 90 });

    const result = analyzeFuelInjectorHeadroomContext(analysis, { reference, injectorDuty }, { sampleIndices: [1, 2, 4], highDutyThreshold: 90 });

    expect(result.headroom).toMatchObject({ validSampleCount: 3, highDutySampleCount: 2, saturationSampleCount: 1, minimumHeadroomPercent: -5 });
    expect(result.headroom?.meanHeadroomPercent).toBeCloseTo(7.6666666667);
  });

  it('attaches RPM/load/fuel-system context at the exact event extreme sample', () => {
    const rpm = range([1000, 1500, 2200, 2800, 3200]);
    const load = range([40, 60, 100, 140, 160]);
    const fuelPressure = range([300, 300, 290, 280, 300]);
    const railDifferential = range([300, 295, 250, 240, 300]);
    const injectorPulseWidth = range([3, 4, 8, 10, 4]);
    const injectorDuty = range([30, 50, 92, 96, 45]);
    const injectorDeadtime = range([0.8, 0.8, 0.82, 0.84, 0.8]);
    const analysis = analyzeFuelPressureInjector({
      reference: rpm,
      fuelPressure,
      railDifferential,
      injectorPulseWidth,
      injectorDuty,
      injectorDeadtime,
    }, { lowPressureThreshold: 270, highDutyThreshold: 90 });

    const result = analyzeFuelInjectorHeadroomContext(analysis, {
      reference: rpm,
      rpm,
      load,
      fuelPressure,
      railDifferential,
      injectorPulseWidth,
      injectorDuty,
      injectorDeadtime,
    });

    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({
      type: 'low-pressure',
      rpmAtExtreme: 2800,
      loadAtExtreme: 140,
      fuelPressureAtExtreme: 280,
      railDifferentialAtExtreme: 240,
      injectorPulseWidthAtExtreme: 10,
      injectorDutyAtExtreme: 96,
      injectorDeadtimeAtExtreme: 0.84,
    });
    expect(result.events[1]).toMatchObject({ type: 'high-duty', rpmAtExtreme: 2800, loadAtExtreme: 140, injectorDutyAtExtreme: 96 });
  });

  it('keeps unavailable event context absent instead of fabricating values', () => {
    const reference = range([1000, 1500, 2000]);
    const railDifferential = range([300, 250, 300]);
    const load = range([40], undefined, 0);
    const analysis = analyzeFuelPressureInjector({ reference, railDifferential }, { lowPressureThreshold: 270 });

    const result = analyzeFuelInjectorHeadroomContext(analysis, { reference, rpm: reference, load, railDifferential });

    expect(result.events[0]).toMatchObject({ type: 'low-pressure', rpmAtExtreme: 1500, railDifferentialAtExtreme: 250 });
    expect(result.events[0]).not.toHaveProperty('loadAtExtreme');
    expect(result.headroom).toBeUndefined();
  });
});
