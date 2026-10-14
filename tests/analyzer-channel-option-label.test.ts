import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../core/log-model/log-types';
import { analyzerChannelOptionLabel } from '../apps/web/src/pages/analyzer-channel-roles';

function channel(displayName: string, unit?: string): ChannelDefinition {
  return {
    id: `ini:${displayName}`,
    sourceName: displayName,
    displayName,
    valueType: 'number',
    ...(unit !== undefined ? { unit } : {}),
  };
}

describe('Analyzer channel option labels', () => {
  it('shows engineering units beside the channel name', () => {
    expect(analyzerChannelOptionLabel(channel('Fuel pressure low', 'kPa'))).toBe('Fuel pressure low [kPa]');
    expect(analyzerChannelOptionLabel(channel('RPM - engine speed', 'rpm'))).toBe('RPM - engine speed [rpm]');
  });

  it('keeps channels without unit metadata unchanged', () => {
    expect(analyzerChannelOptionLabel(channel('Sync state'))).toBe('Sync state');
  });

  it('ignores blank unit metadata', () => {
    expect(analyzerChannelOptionLabel(channel('Fuel cut reason', '   '))).toBe('Fuel cut reason');
  });
});
