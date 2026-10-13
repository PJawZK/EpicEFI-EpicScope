import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  legacyBuiltInWorkspaceRuntimeId,
  materializeStarterWorkspace,
} from '../../apps/web/src/state/prepopulated-workspace-runtime';
import { GENERAL_SINGLE_WORKSPACE } from '../../apps/web/src/state/built-in-workspace-templates';

function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition {
  return {
    id,
    sourceName,
    displayName,
    valueType: 'number',
  };
}

const recordedChannels = (): ChannelDefinition[] => [
  channel('ini:RPMValue', 'RPMValue', 'RPM'),
  channel('ini:MAPValue', 'MAPValue', 'MAP'),
  channel('ini:TPSValue', 'TPSValue', 'TPS'),
  channel('ini:coolant', 'coolant', 'Coolant temp'),
  channel('ini:intake', 'intake', 'Intake air temp'),
  channel('ini:VBatt', 'VBatt', 'Battery'),
  channel('ini:lambdaValue', 'lambdaValue', 'Lambda'),
  channel('ini:correctedIgnitionAdvance', 'correctedIgnitionAdvance', 'Timing: ignition'),
];

const liveChannels = (): ChannelDefinition[] => [
  channel('RPMValue'),
  channel('MAPValue'),
  channel('TPSValue'),
  channel('coolant'),
  channel('intake'),
  channel('VBatt'),
  channel('lambdaValue'),
  channel('correctedIgnitionAdvance'),
];

describe('pre-populated starter workspace runtime', () => {
  it('materializes General as an ordinary caller-owned workspace', () => {
    const result = materializeStarterWorkspace(
      GENERAL_SINGLE_WORKSPACE,
      recordedChannels(),
      'graph-7',
    );

    expect(result.workspace.id).toBe('graph-7');
    expect(result.workspace.name).toBe('General');
    expect(result.workspace.layout).toBe('single');
    expect(result.workspace.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
      'ini:TPSValue',
      'ini:coolant',
      'ini:intake',
      'ini:VBatt',
      'ini:lambdaValue',
      'ini:correctedIgnitionAdvance',
    ]);
    expect(result.workspace.panes?.[0]?.channelIds).toEqual(result.workspace.channelIds);
  });

  it('resolves separate new starter instances against the current source catalog', () => {
    const recorded = materializeStarterWorkspace(
      GENERAL_SINGLE_WORKSPACE,
      recordedChannels(),
      'graph-recorded',
    );
    const live = materializeStarterWorkspace(
      GENERAL_SINGLE_WORKSPACE,
      liveChannels(),
      'graph-live',
    );

    expect(recorded.workspace.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
      'ini:TPSValue',
      'ini:coolant',
      'ini:intake',
      'ini:VBatt',
      'ini:lambdaValue',
      'ini:correctedIgnitionAdvance',
    ]);
    expect(live.workspace.channelIds).toEqual([
      'RPMValue',
      'MAPValue',
      'TPSValue',
      'coolant',
      'intake',
      'VBatt',
      'lambdaValue',
      'correctedIgnitionAdvance',
    ]);
    expect(recorded.workspace.id).not.toBe(live.workspace.id);
  });

  it('preserves caller-owned view state without assigning a reserved identity', () => {
    const result = materializeStarterWorkspace(
      GENERAL_SINGLE_WORKSPACE,
      recordedChannels(),
      'graph-42',
      {},
      {
        name: 'My General',
        cursorTimeMs: 1234,
        viewport: {
          fullStartMs: 0,
          fullEndMs: 10_000,
          visibleStartMs: 1000,
          visibleEndMs: 4000,
        },
        viewHistory: [{
          fullStartMs: 0,
          fullEndMs: 10_000,
          visibleStartMs: 1000,
          visibleEndMs: 4000,
        }],
        viewHistoryIndex: 0,
      },
    );

    expect(result.workspace.id).toBe('graph-42');
    expect(result.workspace.name).toBe('My General');
    expect(result.workspace.cursorTimeMs).toBe(1234);
    expect(result.workspace.viewport?.visibleStartMs).toBe(1000);
    expect(result.workspace.viewHistoryIndex).toBe(0);
  });

  it('honors explicit semantic overrides during one-time materialization', () => {
    const result = materializeStarterWorkspace(
      GENERAL_SINGLE_WORKSPACE,
      [channel('RPMValue'), channel('MAPValue'), channel('TPSValue'), channel('customThrottle')],
      'graph-8',
      { overrides: new Map([['engine.throttle.position', 'customThrottle']]) },
    );

    expect(result.workspace.channelIds).toEqual(['RPMValue', 'MAPValue', 'customThrottle']);
    expect(result.resolution.unresolvedRequiredRoleIds).toEqual([]);
    expect(result.resolution.unresolvedPreferredRoleIds).toEqual(['temperature.coolant']);
  });

  it('retains the historical built-in id only as compatibility data', () => {
    expect(legacyBuiltInWorkspaceRuntimeId(GENERAL_SINGLE_WORKSPACE))
      .toBe('built-in:single-resolver-test');
  });
});
