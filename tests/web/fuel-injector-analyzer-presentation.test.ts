import { describe, expect, it } from 'vitest';
import { describeFuelInjectorPresentation } from '../../apps/web/src/pages/fuel-injector-analyzer-presentation';

describe('Fuel Pressure / Injector decision presentation', () => {
  it('reports comfortable injector headroom without inventing a pressure verdict', () => {
    const result = describeFuelInjectorPresentation({
      injectorDutyMax: 40.5,
      highDutyThreshold: 90,
      highDutyEvents: 0,
      lowPressureEvents: 0,
      railDifferentialSelected: false,
      railDifferentialLooksLikeMap: false,
    });

    expect(result.capacity).toBe('No high-duty evidence · 40.5% max');
    expect(result.headroom).toBe('59.5%');
    expect(result.pressure).toBe('No rail-differential channel selected');
    expect(result.review).toBe('No threshold review events in this scope');
  });

  it('keeps saturation visible when logged duty exceeds 100 percent', () => {
    const result = describeFuelInjectorPresentation({
      injectorDutyMax: 104.2,
      highDutyThreshold: 90,
      highDutyEvents: 1,
      lowPressureEvents: 0,
      railDifferentialSelected: true,
      railDifferentialLooksLikeMap: false,
    });

    expect(result.capacity).toBe('Saturation observed · 104.2% max');
    expect(result.headroom).toBe('−4.2%');
    expect(result.review).toBe('1 threshold event to inspect');
  });

  it('flags MAP when it is presented as rail differential', () => {
    const result = describeFuelInjectorPresentation({
      injectorDutyMax: 72,
      highDutyThreshold: 90,
      highDutyEvents: 0,
      lowPressureThreshold: 270,
      lowPressureEvents: 0,
      railDifferentialSelected: true,
      railDifferentialLooksLikeMap: true,
    });

    expect(result.pressure).toBe('Mapping needs review · MAP is not rail differential');
  });

  it('summarizes low-pressure and high-duty review evidence without assigning cause', () => {
    const result = describeFuelInjectorPresentation({
      injectorDutyMax: 94,
      highDutyThreshold: 90,
      highDutyEvents: 2,
      lowPressureThreshold: 270,
      lowPressureEvents: 3,
      railDifferentialSelected: true,
      railDifferentialLooksLikeMap: false,
    });

    expect(result.capacity).toBe('Reduced headroom · 94% max');
    expect(result.headroom).toBe('6%');
    expect(result.pressure).toBe('3 events below 270');
    expect(result.review).toBe('5 threshold events to inspect');
  });
});
