import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import { isRawFuelPressureChannel, suggestFuelPressureChannel } from '../../apps/web/src/pages/fuel-pressure-channel-selection';

function channel(sourceName: string, displayName = sourceName, unit?: string): ChannelDefinition {
  return {
    id: `ini:${sourceName}`,
    sourceName,
    displayName,
    valueType: 'number',
    ...(unit ? { unit } : {}),
  };
}

describe('Fuel pressure calibrated channel selection', () => {
  it('prefers the canonical calibrated low/high EpicEFI channels over raw electrical inputs', () => {
    const channels = [
      channel('rawLowFuelPressure', 'rawLowFuelPressure', 'V'),
      channel('rawHighFuelPressure', 'rawHighFuelPressure', 'V'),
      channel('fuelPressure_low', 'Fuel pressure low', 'kPa'),
      channel('fuelPressure_high', 'Fuel pressure high', 'kPa'),
      channel('cel_fuel_pressure', 'CEL fuel pressure'),
    ];

    expect(suggestFuelPressureChannel('low-side', channels)?.sourceName).toBe('fuelPressure_low');
    expect(suggestFuelPressureChannel('high-side', channels)?.sourceName).toBe('fuelPressure_high');
  });

  it('never falls back to raw electrical or CEL channels when calibrated pressure is unavailable', () => {
    const channels = [
      channel('rawLowFuelPressure', 'rawLowFuelPressure', 'V'),
      channel('rawHighFuelPressure', 'rawHighFuelPressure', 'V'),
      channel('cel_fuel_pressure', 'CEL fuel pressure'),
    ];

    expect(suggestFuelPressureChannel('low-side', channels)).toBeUndefined();
    expect(suggestFuelPressureChannel('high-side', channels)).toBeUndefined();
    expect(isRawFuelPressureChannel(channels[0]!)).toBe(true);
    expect(isRawFuelPressureChannel(channels[1]!)).toBe(true);
  });

  it('prefers kPa for fuzzy calibrated low-side candidates without requiring unit metadata', () => {
    const channels = [
      channel('fuelRailPressure', 'Fuel rail pressure'),
      channel('lowFuelRailPressure', 'Low fuel rail pressure', 'kPa'),
    ];

    expect(suggestFuelPressureChannel('low-side', channels)?.sourceName).toBe('lowFuelRailPressure');
  });

  it('keeps high-side/GDI and low-side domains separate', () => {
    const channels = [
      channel('lowFuelPressure', 'Low fuel pressure', 'kPa'),
      channel('gdiRailPressure', 'GDI rail pressure', 'kPa'),
    ];

    expect(suggestFuelPressureChannel('low-side', channels)?.sourceName).toBe('lowFuelPressure');
    expect(suggestFuelPressureChannel('high-side', channels)?.sourceName).toBe('gdiRailPressure');
  });
});
