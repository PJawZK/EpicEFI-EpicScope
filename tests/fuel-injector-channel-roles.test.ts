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
    channel('fuelPressure', 'Fuel pressure'),
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

  it('keeps the RPM sample grid and fuel-system roles distinct', () => {
    expect(suggestAnalyzerChannel('fuel-injector', 'reference', channels)?.sourceName).toBe('RPMValue');
    expect(suggestAnalyzerChannel('fuel-injector', 'fuelPressure', channels)?.sourceName).toBe('fuelPressure');
    expect(suggestAnalyzerChannel('fuel-injector', 'pw', channels)?.sourceName).toBe('actualLastInjection');
    expect(suggestAnalyzerChannel('fuel-injector', 'duty', channels)?.sourceName).toBe('injectorDutyCycle');
    expect(suggestAnalyzerChannel('fuel-injector', 'deadtime', channels)?.sourceName).toBe('injectorDeadtime');
  });
});
