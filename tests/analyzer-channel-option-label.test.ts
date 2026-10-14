import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../core/log-model/log-types';
import { analyzerChannelOptionLabel } from '../apps/web/src/pages/analyzer-channel-roles';

function channel(sourceName: string, displayName: string, unit?: string): ChannelDefinition {
  return {
    id: `ini:${sourceName}`,
    sourceName,
    displayName,
    valueType: 'number',
    ...(unit !== undefined ? { unit } : {}),
  };
}

describe('Analyzer channel option labels', () => {
  it('shows literal source identity plus engineering units', () => {
    expect(analyzerChannelOptionLabel(channel('fuelPressure_low', 'Fuel pressure low', 'kPa'))).toBe('fuelPressure_low [kPa]');
    expect(analyzerChannelOptionLabel(channel('RPMValue', 'RPM - engine speed', 'rpm'))).toBe('RPMValue [rpm]');
  });

  it('does not replace source identity with a friendly/display label', () => {
    expect(analyzerChannelOptionLabel(channel('lambdaValue', 'Lambda', 'lambda'))).toBe('lambdaValue [lambda]');
  });

  it('keeps source names without unit metadata unchanged', () => {
    expect(analyzerChannelOptionLabel(channel('syncState', 'Sync state'))).toBe('syncState');
  });

  it('ignores blank unit metadata', () => {
    expect(analyzerChannelOptionLabel(channel('fuelCutReason', 'Fuel cut reason', '   '))).toBe('fuelCutReason');
  });
});
