import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  decorateHistogramChannelOptions,
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

  it('decorates source-backed and calculated channel options but leaves non-channel options alone', () => {
    const channels = [
      channel('ini:MAPValue', 'MAPValue', 'MAP', 'kPa'),
      channel('formula:rail-diff', 'Rail Differential', 'ƒ Rail Differential', 'kPa'),
    ];
    const options = [
      { value: 'ini:MAPValue', textContent: 'MAP' },
      { value: 'formula:rail-diff', textContent: 'ƒ Rail Differential' },
      { value: 'full', textContent: 'Full Log' },
    ];
    const root = {
      querySelectorAll: () => options,
    } as unknown as ParentNode;

    decorateHistogramChannelOptions(root, channels);

    expect(options[0]!.textContent).toBe('MAPValue [kPa]');
    expect(options[1]!.textContent).toBe('Rail Differential [kPa]');
    expect(options[2]!.textContent).toBe('Full Log');
  });
});
