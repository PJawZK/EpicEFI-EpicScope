import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../core/log-model/log-types';
import { suggestAnalyzerChannel } from '../apps/web/src/pages/analyzer-channel-roles';

function channel(sourceName: string, displayName = sourceName): ChannelDefinition {
  return {
    id: `ini:${sourceName}`,
    sourceName,
    displayName,
    valueType: 'number',
  };
}

describe('Fuel Pressure / Injector analyzer channel roles', () => {
  const channels = [
    channel('RPMValue', 'RPM'),
    channel('MAPValue', 'MAP'),
    channel('fuelPressure_low', 'Fuel pressure low'),
    channel('fuelPressure_high', 'Fuel pressure high'),
    channel('cel_fuel_pressure', 'CEL fuel pressure'),
    channel('fuelPressureDelta', 'Fuel: Injector pressure delta'),
    channel('actualLastInjection', 'Fuel: Last inj pulse width'),
    channel('injectorDutyCycle', 'Fuel: injector duty cycle'),
    channel('injectorDeadtime', 'injector deadtime'),
  ];

  it('keeps manifold pressure separate from rail differential pressure', () => {
    expect(suggestAnalyzerChannel('fuel-injector', 'map', channels)?.sourceName).toBe('MAPValue');
    expect(suggestAnalyzerChannel('fuel-injector', 'railDiff', channels)?.sourceName).toBe('fuelPressureDelta');
  });

  it('does not accept MAP as a rail-differential fallback', () => {
    expect(suggestAnalyzerChannel('fuel-injector', 'railDiff', [channel('MAPValue', 'MAP')])).toBeUndefined();
  });

  it('uses low-side fuel pressure for conventional fuel-system analysis', () => {
    expect(suggestAnalyzerChannel('fuel-injector', 'fuelPressure', channels)?.sourceName).toBe('fuelPressure_low');
  });

  it('keeps high-side GDI fuel pressure separate from low-side pressure', () => {
    expect(suggestAnalyzerChannel('fuel-injector', 'fuelPressureHigh', channels)?.sourceName).toBe('fuelPressure_high');
    expect(suggestAnalyzerChannel('fuel-injector', 'fuelPressure', [channel('fuelPressure_high', 'Fuel pressure high')])).toBeUndefined();
  });

  it('never treats CEL/check-engine fuel-pressure status as measured pressure', () => {
    expect(suggestAnalyzerChannel('fuel-injector', 'fuelPressure', [channel('cel_fuel_pressure', 'CEL fuel pressure')])).toBeUndefined();
    expect(suggestAnalyzerChannel('fuel-injector', 'fuelPressureHigh', [channel('cel_fuel_pressure', 'Check Engine fuel pressure')])).toBeUndefined();
    expect(suggestAnalyzerChannel('fuel-injector', 'railDiff', [channel('cel_fuel_pressure_delta', 'CEL fuel pressure delta')])).toBeUndefined();
  });

  it('keeps the RPM sample grid and injector roles distinct', () => {
    expect(suggestAnalyzerChannel('fuel-injector', 'reference', channels)?.sourceName).toBe('RPMValue');
    expect(suggestAnalyzerChannel('fuel-injector', 'pw', channels)?.sourceName).toBe('actualLastInjection');
    expect(suggestAnalyzerChannel('fuel-injector', 'duty', channels)?.sourceName).toBe('injectorDutyCycle');
    expect(suggestAnalyzerChannel('fuel-injector', 'deadtime', channels)?.sourceName).toBe('injectorDeadtime');
  });
});
