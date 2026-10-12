import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  resolveBuiltInWorkspaceTemplate,
  SINGLE_RESOLVER_TEST_WORKSPACE,
} from '../../apps/web/src/state/built-in-workspace-templates';
import { builtInWorkspaceRuntimeId } from '../../apps/web/src/state/prepopulated-workspace-runtime';

function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition {
  return {
    id,
    sourceName,
    displayName,
    valueType: 'number',
  };
}

describe('Logger pre-populated Single integration contract', () => {
  it('uses one stable reserved workspace identity across recorded and Shim sources', () => {
    expect(builtInWorkspaceRuntimeId(SINGLE_RESOLVER_TEST_WORKSPACE))
      .toBe('built-in:single-resolver-test');

    const recorded = resolveBuiltInWorkspaceTemplate(SINGLE_RESOLVER_TEST_WORKSPACE, [
      channel('ini:RPMValue', 'RPMValue', 'RPM'),
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
      channel('ini:TPSValue', 'TPSValue', 'TPS'),
      channel('ini:coolant', 'coolant', 'Coolant'),
    ]);
    const live = resolveBuiltInWorkspaceTemplate(SINGLE_RESOLVER_TEST_WORKSPACE, [
      channel('RPMValue'),
      channel('MAPValue'),
      channel('TPSValue'),
      channel('coolant'),
    ]);

    expect(recorded.panes[0]?.channelIds).toEqual([
      'ini:RPMValue',
      'ini:MAPValue',
      'ini:TPSValue',
      'ini:coolant',
    ]);
    expect(live.panes[0]?.channelIds).toEqual([
      'RPMValue',
      'MAPValue',
      'TPSValue',
      'coolant',
    ]);
  });
});
