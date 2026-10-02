import { describe, expect, it } from 'vitest';

import {
  normalizeWorkspaceChannelIds,
  renderableWorkspaceChannelIds,
} from '../../apps/web/src/state/workspace-channel-identity';

describe('reusable workspace channel identity normalization', () => {
  it('preserves unresolved legacy mlg IDs as dormant migration candidates', () => {
    const result = normalizeWorkspaceChannelIds(
      ['mlg:0', 'mlg:1', 'ini:RPMValue', 'ini:MissingFutureChannel'],
      {
        knownChannelIds: new Set(['ini:RPMValue']),
        iniCatalogActive: true,
        limit: 8,
      },
    );

    expect(result).toEqual([
      'mlg:0',
      'mlg:1',
      'ini:RPMValue',
      'ini:MissingFutureChannel',
    ]);
  });

  it('hides unresolved legacy mlg IDs from graph assignment while INI-only', () => {
    const result = renderableWorkspaceChannelIds(
      ['mlg:0', 'mlg:1', 'ini:RPMValue', 'ini:MissingFutureChannel'],
      {
        knownChannelIds: new Set(['ini:RPMValue']),
        iniCatalogActive: true,
        limit: 8,
      },
    );

    expect(result).toEqual(['ini:RPMValue', 'ini:MissingFutureChannel']);
  });

  it('maps legacy mlg IDs through a current binding into stable INI IDs', () => {
    const result = renderableWorkspaceChannelIds(
      ['mlg:0', 'mlg:1', 'ini:MAPValue'],
      {
        knownChannelIds: new Set(['ini:RPMValue', 'ini:MAPValue']),
        aliases: new Map([
          ['mlg:0', 'ini:RPMValue'],
        ]),
        iniCatalogActive: true,
        limit: 8,
      },
    );

    expect(result).toEqual(['ini:RPMValue', 'ini:MAPValue']);
  });

  it('keeps raw mlg IDs when no INI catalog is active', () => {
    const result = renderableWorkspaceChannelIds(
      ['mlg:0', 'mlg:1'],
      {
        knownChannelIds: new Set(['mlg:0', 'mlg:1']),
        iniCatalogActive: false,
        limit: 8,
      },
    );

    expect(result).toEqual(['mlg:0', 'mlg:1']);
  });

  it('deduplicates and enforces the pane trace limit after normalization', () => {
    const result = renderableWorkspaceChannelIds(
      ['mlg:0', 'ini:RPMValue', 'ini:MAPValue', 'ini:TPSValue'],
      {
        knownChannelIds: new Set([
          'ini:RPMValue',
          'ini:MAPValue',
          'ini:TPSValue',
        ]),
        aliases: new Map([['mlg:0', 'ini:RPMValue']]),
        iniCatalogActive: true,
        limit: 2,
      },
    );

    expect(result).toEqual(['ini:RPMValue', 'ini:MAPValue']);
  });
});
