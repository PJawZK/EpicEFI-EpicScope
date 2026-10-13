import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  GENERAL_SINGLE_WORKSPACE,
  resolveStarterWorkspaceTemplate,
} from '../../apps/web/src/state/built-in-workspace-templates';

function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition {
  return {
    id,
    sourceName,
    displayName,
    valueType: 'number',
  };
}

describe('Logger pre-populated General starter integration contract', () => {
  it('resolves the General starter against recorded and Shim source catalogs', () => {
    expect(GENERAL_SINGLE_WORKSPACE.name).toBe('General');

    const recorded = resolveStarterWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE, [
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
      channel('ini:TPSValue', 'TPSValue', 'TPS'),
      channel('ini:coolant', 'coolant', 'Coolant temp'),
      channel('ini:intake', 'intake', 'Intake air temp'),
      channel('ini:VBatt', 'VBatt', 'Battery'),
      channel('ini:lambdaValue', 'lambdaValue', 'Lambda'),
      channel('ini:correctedIgnitionAdvance', 'correctedIgnitionAdvance', 'Timing: ignition'),
    ]);
    const live = resolveStarterWorkspaceTemplate(GENERAL_SINGLE_WORKSPACE, [
      channel('RPMValue'),
      channel('MAPValue'),
      channel('TPSValue'),
      channel('coolant'),
      channel('intake'),
      channel('VBatt'),
      channel('lambdaValue'),
      channel('correctedIgnitionAdvance'),
    ]);

    expect(recorded.panes[0]?.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
      'ini:TPSValue',
      'ini:coolant',
      'ini:intake',
      'ini:VBatt',
      'ini:lambdaValue',
      'ini:correctedIgnitionAdvance',
    ]);
    expect(live.panes[0]?.channelIds).toEqual([
      'RPMValue',
      'MAPValue',
      'TPSValue',
      'coolant',
      'intake',
      'VBatt',
      'lambdaValue',
      'correctedIgnitionAdvance',
    ]);
  });
});
