import { describe, expect, it } from 'vitest';

import {
  createEmptyPaneStates,
  clampPaneResize,
  freeformArrangement,
  normalizePaneStates,
  paneCountForLayout,
} from '../../apps/web/src/state/logger-pane-layout';

describe('logger pane layout state', () => {
  it('maps workspace layouts to visible pane counts', () => {
    expect(paneCountForLayout('single')).toBe(1);
    expect(paneCountForLayout('dual')).toBe(2);
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

  it('keeps manual resize minima inside narrow or short remaining workspace bounds',()=>{
    expect(clampPaneResize(160,170,190)).toBe(170);
    expect(clampPaneResize(300,170,190)).toBe(170);
    expect(clampPaneResize(1,400,190)).toBe(190);
    expect(clampPaneResize(250,400,190)).toBe(250);
    expect(clampPaneResize(120,80,120)).toBe(80);
  });

  it('fills preset cells while retaining cascade and custom geometry', () => {
    expect(freeformArrangement('mosaic')['pane-1']).toEqual({ x: 0, y: 0, width: .58, height: .56 });
    expect(freeformArrangement('columns')['pane-4']).toEqual({ x: .58, y: 0, width: .42, height: .5 });
    expect(freeformArrangement('rows')['pane-5']).toEqual({ x: 0, y: .8, width: 1, height: .2 });
    expect(freeformArrangement('cascade')['pane-5']).toEqual({ x: .32, y: .32, width: .68, height: .58 });
    expect(freeformArrangement('custom')).toEqual(freeformArrangement('mosaic'));
  });
});