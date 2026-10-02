import { describe, expect, it } from 'vitest';

import { normalizeWorkspaceChannelIds } from '../../apps/web/src/state/workspace-channel-identity';

describe('reusable workspace channel identity normalization', () => {
  it('drops unresolved legacy mlg IDs when an INI catalog is active', () => {
    const result = normalizeWorkspaceChannelIds(
      ['mlg:0', 'mlg:1', 'ini:RPMValue', 'ini:MissingFutureChannel'],
      {
        knownChannelIds: new Set(['ini:RPMValue']),
        iniCatalogActive: true,
        limit: 8,
      },
    );

    expect(result).toEqual(['ini:RPMValue', 'ini:MissingFutureChannel']);
  });

  it('maps legacy mlg IDs through a current binding before deciding whether to drop them', () => {
    const result = normalizeWorkspaceChannelIds(
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
    const result = normalizeWorkspaceChannelIds(
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
    const result = normalizeWorkspaceChannelIds(
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
