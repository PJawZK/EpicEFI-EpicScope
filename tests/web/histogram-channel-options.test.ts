import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  histogramChannelOptionLabel,
} from '../../apps/web/src/pages/histogram-channel-options';

function channel(id: string, sourceName: string, displayName: string, unit?: string): ChannelDefinition {
  return {
    id,
    sourceName,
    displayName,
    valueType: 'number',
    ...(unit !== undefined ? { unit } : {}),
  };
}

describe('Histogram channel option labels', () => {
  it('shows literal source identity with engineering units', () => {
    expect(histogramChannelOptionLabel(channel('ini:MAPValue', 'MAPValue', 'MAP', 'kPa'))).toBe('MAPValue [kPa]');
    expect(histogramChannelOptionLabel(channel('ini:RPMValue', 'RPMValue', 'Engine speed', ' rpm '))).toBe('RPMValue [rpm]');
  });

  it('keeps unitless source names unchanged', () => {
    expect(histogramChannelOptionLabel(channel('ini:syncState', 'syncState', 'Sync state'))).toBe('syncState');
    expect(histogramChannelOptionLabel(channel('ini:state', 'state', 'State', '   '))).toBe('state');
  });

  it('formats physical and calculated channels at their owning selector', () => {
    expect(histogramChannelOptionLabel(channel('ini:MAPValue', 'MAPValue', 'MAP', 'kPa'))).toBe('MAPValue [kPa]');
    expect(histogramChannelOptionLabel(channel('formula:rail-diff', 'Rail Differential', 'ƒ Rail Differential', 'kPa'))).toBe('Rail Differential [kPa]');
  });
});
