import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  EPICEFI_VVT_CONTROL_DUAL_WORKSPACE,
  resolveStarterWorkspaceTemplate,
  starterWorkspaceAvailable,
} from '../../apps/web/src/state/built-in-workspace-templates';
import { resolveSemanticChannelRole } from '../../apps/web/src/state/semantic-channel-roles';

const c = (id: string, displayName = id): ChannelDefinition => ({
  id: `ini:${id}`, sourceName: id, displayName, valueType: 'number',
});

const vvt = [
  c('RPMValue', 'RPM'), c('MAPValue', 'MAP'), c('VBatt', 'Battery'),
  c('vvtPositionB1I', 'VVT: bank 1 intake'), c('vvtTargets1', 'vvtTargets 1'),
  c('vvtStatus1_output'), c('vvtStatus1_error'),
  c('vvtStatus1_pTerm'), c('vvtStatus1_iTerm'), c('vvtStatus1_dTerm'),
  // Present in the schema, but deliberately not selected by the primary-controller roles.
  c('vvtPositionB1E', 'VVT: bank 1 exhaust'), c('vvtTargets2', 'vvtTargets 2'), c('vvtStatus2_output'),
];

describe('EpicEFI VVT Control starter', () => {
  it('gates on the primary VVT target/actual/output/error runtime bundle', () => {
    expect(starterWorkspaceAvailable(EPICEFI_VVT_CONTROL_DUAL_WORKSPACE, vvt)).toBe(true);
    expect(starterWorkspaceAvailable(
      EPICEFI_VVT_CONTROL_DUAL_WORKSPACE,
      vvt.filter((x) => x.sourceName !== 'vvtStatus1_output'),
    )).toBe(false);
  });

  it('resolves the primary bank-1 intake VVT controller into two focused panes', () => {
    const r = resolveStarterWorkspaceTemplate(EPICEFI_VVT_CONTROL_DUAL_WORKSPACE, vvt);
    expect(r.panes[0]?.channelIds).toEqual([
      'ini:RPMValue', 'ini:vvtPositionB1I', 'ini:vvtTargets1', 'ini:vvtStatus1_error', 'ini:MAPValue',
    ]);
    expect(r.panes[1]?.channelIds).toEqual([
      'ini:vvtStatus1_output', 'ini:vvtStatus1_pTerm', 'ini:vvtStatus1_iTerm', 'ini:vvtStatus1_dTerm', 'ini:VBatt',
    ]);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
  });

  it('does not treat configuration, input-channel, or other-cam lookalikes as primary VVT capability', () => {
    const lookalikes = [
      c('vvtChannel1', 'bank 1 intake cam input'),
      c('vvtPositionB1E', 'VVT: bank 1 exhaust'),
      c('vvtTargets2', 'vvtTargets 2'),
      c('vvtStatus2_output'),
      c('vvtStatus2_error'),
    ];
    expect(resolveSemanticChannelRole('vvt.primary.actual', lookalikes).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('vvt.primary.target', lookalikes).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('vvt.primary.output', lookalikes).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('vvt.primary.error', lookalikes).channel).toBeUndefined();
  });
});
