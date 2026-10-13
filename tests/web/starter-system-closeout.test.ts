import { describe, expect, it } from 'vitest';

import {
  GENERIC_STARTER_WORKSPACE_TEMPLATES,
  STARTER_WORKSPACE_TEMPLATES,
  availableStarterWorkspaceTemplates,
} from '../../apps/web/src/state/built-in-workspace-templates';
import { renderableWorkspaceChannelIds } from '../../apps/web/src/state/workspace-channel-identity';

describe('starter system close-out invariants', () => {
  it('keeps the production catalog at 12 generic + 12 capability-gated EpicEFI starters', () => {
    const generic = STARTER_WORKSPACE_TEMPLATES.filter((template) => template.tier !== 'epicefi');
    const epicefi = STARTER_WORKSPACE_TEMPLATES.filter((template) => template.tier === 'epicefi');

    expect(generic).toHaveLength(12);
    expect(epicefi).toHaveLength(12);
    expect(GENERIC_STARTER_WORKSPACE_TEMPLATES).toHaveLength(12);
    expect(GENERIC_STARTER_WORKSPACE_TEMPLATES.every((template) => template.tier !== 'epicefi')).toBe(true);
    expect(epicefi.every((template) => (template.availability?.allOfRoleIds.length ?? 0) > 0)).toBe(true);
  });

  it('offers only generic starters when no specialized runtime capabilities resolve', () => {
    expect(availableStarterWorkspaceTemplates([]).map((template) => template.name)).toEqual(
      GENERIC_STARTER_WORKSPACE_TEMPLATES.map((template) => template.name),
    );
  });

  it('keeps generic starter ids unique and every production template structurally materializable', () => {
    expect(new Set(STARTER_WORKSPACE_TEMPLATES.map((template) => template.id)).size).toBe(
      STARTER_WORKSPACE_TEMPLATES.length,
    );

    for (const template of STARTER_WORKSPACE_TEMPLATES) {
      expect(template.name.trim().length).toBeGreaterThan(0);
      expect(template.panes.length).toBeGreaterThan(0);
      expect(new Set(template.panes.map((pane) => pane.id)).size).toBe(template.panes.length);
      expect(template.panes.every((pane) => pane.roles.length > 0)).toBe(true);
    }
  });

  it('normalizes stable INI assignments onto live Shim ids without inventing extra channels', () => {
    const selected = ['ini:RPMValue', 'ini:MAPValue', 'ini:TPSValue'];
    const live = renderableWorkspaceChannelIds(selected, {
      knownChannelIds: new Set(['RPMValue', 'MAPValue', 'TPSValue']),
      iniCatalogActive: true,
      limit: 8,
    });

    expect(live).toEqual(['RPMValue', 'MAPValue', 'TPSValue']);
    expect(live).toHaveLength(selected.length);
  });

  it('can normalize raw source identities back to canonical INI ids through source aliases', () => {
    const selected = ['RPMValue', 'MAPValue', 'TPSValue'];
    const recorded = renderableWorkspaceChannelIds(selected, {
      knownChannelIds: new Set(['ini:RPMValue', 'ini:MAPValue', 'ini:TPSValue']),
      aliases: new Map([
        ['RPMValue', 'ini:RPMValue'],
        ['MAPValue', 'ini:MAPValue'],
        ['TPSValue', 'ini:TPSValue'],
      ]),
      iniCatalogActive: true,
      limit: 8,
    });

    expect(recorded).toEqual(['ini:RPMValue', 'ini:MAPValue', 'ini:TPSValue']);
  });
});
