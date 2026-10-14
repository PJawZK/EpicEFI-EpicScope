import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  decorateHistogramChannelOptions,
  histogramChannelOptionLabel,
} from '../../apps/web/src/pages/histogram-channel-options';

function channel(id: string, displayName: string, unit?: string): ChannelDefinition {
  return {
    id,
    sourceName: id,
    displayName,
    valueType: 'number',
    ...(unit !== undefined ? { unit } : {}),
  };
}

describe('Histogram channel option labels', () => {
  it('shows the engineering unit when channel metadata provides one', () => {
    expect(histogramChannelOptionLabel(channel('map', 'MAP', 'kPa'))).toBe('MAP [kPa]');
    expect(histogramChannelOptionLabel(channel('rpm', 'Engine speed', ' rpm '))).toBe('Engine speed [rpm]');
  });

  it('keeps unitless channel names unchanged', () => {
    expect(histogramChannelOptionLabel(channel('sync', 'Sync state'))).toBe('Sync state');
    expect(histogramChannelOptionLabel(channel('state', 'State', '   '))).toBe('State');
  });

  it('decorates physical and calculated channel options but leaves non-channel options alone', () => {
    const channels = [
      channel('ini:MAPValue', 'MAP', 'kPa'),
      channel('formula:rail-diff', 'ƒ Rail Differential', 'kPa'),
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

    expect(options[0]!.textContent).toBe('MAP [kPa]');
    expect(options[1]!.textContent).toBe('ƒ Rail Differential [kPa]');
    expect(options[2]!.textContent).toBe('Full Log');
  });
});
