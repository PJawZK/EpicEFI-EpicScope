import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  resolveBuiltInWorkspaceTemplate,
  SINGLE_RESOLVER_TEST_WORKSPACE,
} from '../../apps/web/src/state/built-in-workspace-templates';

function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition {
  return {
    id,
    sourceName,
    displayName,
    valueType: 'number',
  };
}

describe('built-in workspace templates', () => {
  it('defines the first resolver fixture as a one-pane Single layout', () => {
    expect(SINGLE_RESOLVER_TEST_WORKSPACE.layout).toBe('single');
    expect(SINGLE_RESOLVER_TEST_WORKSPACE.panes).toHaveLength(1);
    expect(SINGLE_RESOLVER_TEST_WORKSPACE.panes[0]?.id).toBe('pane-1');
    expect(SINGLE_RESOLVER_TEST_WORKSPACE.panes[0]?.roles).toEqual([
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'engine.map', requirement: 'preferred' },
      { roleId: 'engine.throttle.position', requirement: 'preferred' },
      { roleId: 'temperature.coolant', requirement: 'optional' },
    ]);
  });

  it('resolves the same semantic workspace onto live Shim channel IDs', () => {
    const result = resolveBuiltInWorkspaceTemplate(SINGLE_RESOLVER_TEST_WORKSPACE, [
      channel('RPMValue'),
      channel('MAPValue'),
      channel('TPSValue'),
      channel('coolant'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual([
      'RPMValue',
      'MAPValue',
      'TPSValue',
      'coolant',
    ]);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
    expect(result.unresolvedPreferredRoleIds).toEqual([]);
    expect(result.unresolvedOptionalRoleIds).toEqual([]);
  });

  it('resolves the same semantic workspace onto canonical INI identities', () => {
    const result = resolveBuiltInWorkspaceTemplate(SINGLE_RESOLVER_TEST_WORKSPACE, [
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
      channel('ini:TPSValue', 'TPSValue', 'TPS'),
      channel('ini:coolant', 'coolant', 'Coolant'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
      'ini:TPSValue',
      'ini:coolant',
    ]);
  });

  it('loads gracefully when preferred and optional roles are missing', () => {
    const result = resolveBuiltInWorkspaceTemplate(SINGLE_RESOLVER_TEST_WORKSPACE, [
      channel('RPMValue'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual(['RPMValue']);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
    expect(result.unresolvedPreferredRoleIds).toEqual([
      'engine.map',
      'engine.throttle.position',
    ]);
    expect(result.unresolvedOptionalRoleIds).toEqual(['temperature.coolant']);
  });

  it('reports a missing required role without rejecting the workspace', () => {
    const result = resolveBuiltInWorkspaceTemplate(SINGLE_RESOLVER_TEST_WORKSPACE, [
      channel('MAPValue'),
      channel('TPSValue'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual(['MAPValue', 'TPSValue']);
    expect(result.unresolvedRequiredRoleIds).toEqual(['engine.rpm']);
  });
});
