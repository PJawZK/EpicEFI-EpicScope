import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  GENERAL_SINGLE_WORKSPACE,
  resolveBuiltInWorkspaceTemplate,
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
  it('defines General Single as one pane with the agreed overview roles', () => {
    expect(GENERAL_SINGLE_WORKSPACE.name).toBe('General · Single');
    expect(GENERAL_SINGLE_WORKSPACE.layout).toBe('single');
    expect(GENERAL_SINGLE_WORKSPACE.panes).toHaveLength(1);
    expect(GENERAL_SINGLE_WORKSPACE.panes[0]?.roles).toEqual([
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'engine.map', requirement: 'required' },
      { roleId: 'engine.throttle.position', requirement: 'preferred' },
      { roleId: 'temperature.coolant', requirement: 'preferred' },
      { roleId: 'temperature.intakeAir', requirement: 'optional' },
      { roleId: 'electrical.batteryVoltage', requirement: 'optional' },
      { roleId: 'fuel.lambda', requirement: 'optional' },
      { roleId: 'ignition.advance', requirement: 'optional' },
    ]);
  });

  it('resolves General Single onto EpicEFI live Shim channel IDs', () => {
    const result = resolveBuiltInWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE, [
      channel('RPMValue'),
      channel('MAPValue'),
      channel('TPSValue'),
      channel('coolant'),
      channel('intake'),
      channel('VBatt'),
      channel('lambdaValue'),
      channel('correctedIgnitionAdvance'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual([
      'RPMValue',
      'MAPValue',
      'TPSValue',
      'coolant',
      'intake',
      'VBatt',
      'lambdaValue',
      'correctedIgnitionAdvance',
    ]);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
    expect(result.unresolvedPreferredRoleIds).toEqual([]);
    expect(result.unresolvedOptionalRoleIds).toEqual([]);
  });

  it('resolves General Single onto canonical INI identities', () => {
    const result = resolveBuiltInWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE, [
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
      channel('ini:TPSValue', 'TPSValue', 'TPS'),
      channel('ini:coolant', 'coolant', 'Coolant temp'),
      channel('ini:intake', 'intake', 'Intake air temp'),
      channel('ini:VBatt', 'VBatt', 'Battery'),
      channel('ini:lambdaValue', 'lambdaValue', 'Lambda'),
      channel('ini:correctedIgnitionAdvance', 'correctedIgnitionAdvance', 'Timing: ignition'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
      'ini:TPSValue',
      'ini:coolant',
      'ini:intake',
      'ini:VBatt',
      'ini:lambdaValue',
      'ini:correctedIgnitionAdvance',
    ]);
  });

  it('loads gracefully when preferred and optional roles are missing', () => {
    const result = resolveBuiltInWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE, [
      channel('RPMValue'),
      channel('MAPValue'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual(['RPMValue', 'MAPValue']);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
    expect(result.unresolvedPreferredRoleIds).toEqual([
      'engine.throttle.position',
      'temperature.coolant',
    ]);
    expect(result.unresolvedOptionalRoleIds).toEqual([
      'temperature.intakeAir',
      'electrical.batteryVoltage',
      'fuel.lambda',
      'ignition.advance',
    ]);
  });

  it('reports missing required roles without rejecting the workspace', () => {
    const result = resolveBuiltInWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE, [
      channel('TPSValue'),
      channel('coolant'),
    ]);

    expect(result.panes[0]?.channelIds).toEqual(['TPSValue', 'coolant']);
    expect(result.unresolvedRequiredRoleIds).toEqual(['engine.rpm', 'engine.map']);
  });
});
