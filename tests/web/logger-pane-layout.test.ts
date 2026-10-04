import { describe, expect, it } from 'vitest';

import {
  createEmptyPaneStates,
  freeformArrangement,
  normalizePaneStates,
  paneCountForLayout,
} from '../../apps/web/src/state/logger-pane-layout';

describe('logger pane layout state', () => {
  it('maps workspace layouts to visible pane counts', () => {
    expect(paneCountForLayout('single')).toBe(1);
    expect(paneCountForLayout('grid4')).toBe(4);
    expect(paneCountForLayout('grid5')).toBe(5);
    expect(paneCountForLayout('freeform')).toBe(5);
    expect(paneCountForLayout('grid6')).toBe(6);
  });

  it('creates all six pane states in stable order', () => {
    expect(createEmptyPaneStates()).toEqual([
      { id: 'pane-1', channelIds: [] },
      { id: 'pane-2', channelIds: [] },
      { id: 'pane-3', channelIds: [] },
      { id: 'pane-4', channelIds: [] },
      { id: 'pane-5', channelIds: [] },
      { id: 'pane-6', channelIds: [] },
    ]);
  });

  it('normalizes pane snapshots without sharing channel arrays', () => {
    const source = [{ id: 'pane-2', channelIds: ['ini:RPMValue', 'ini:MAPValue'] }];
    const normalized = normalizePaneStates(source, []);
    expect(normalized[1]).toEqual({ id: 'pane-2', channelIds: ['ini:RPMValue', 'ini:MAPValue'] });
    expect(normalized[0]).toEqual({ id: 'pane-1', channelIds: [] });
    expect(normalized[1]!.channelIds).not.toBe(source[0]!.channelIds);
  });

  it('restores legacy workspace channels into pane 1 when pane snapshots are absent', () => {
    const normalized = normalizePaneStates(undefined, ['ini:RPMValue', 'ini:MAPValue']);
    expect(normalized[0]).toEqual({ id: 'pane-1', channelIds: ['ini:RPMValue', 'ini:MAPValue'] });
    expect(normalized.slice(1).every((pane) => pane.channelIds.length === 0)).toBe(true);
  });

  it('preserves the established freeform layout presets', () => {
    expect(freeformArrangement('mosaic')['pane-1']).toEqual({ x: 0, y: 0, width: .58, height: .56 });
    expect(freeformArrangement('columns')['pane-4']).toEqual({ x: .59, y: 0, width: .41, height: .49 });
    expect(freeformArrangement('rows')['pane-5']).toEqual({ x: 0, y: .81, width: 1, height: .19 });
    expect(freeformArrangement('cascade')['pane-5']).toEqual({ x: .32, y: .32, width: .68, height: .58 });
    expect(freeformArrangement('custom')).toEqual(freeformArrangement('mosaic'));
  });
});
