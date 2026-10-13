import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  EPICEFI_ANTI_LAG_DUAL_WORKSPACE,
  resolveStarterWorkspaceTemplate,
  starterWorkspaceAvailable,
} from '../../apps/web/src/state/built-in-workspace-templates';
import { resolveSemanticChannelRole } from '../../apps/web/src/state/semantic-channel-roles';

const c = (id: string, displayName = id): ChannelDefinition => ({
  id: `ini:${id}`, sourceName: id, displayName, valueType: 'number',
});

const als = [
  c('RPMValue', 'RPM'), c('MAPValue', 'MAP'), c('TPSValue', 'TPS'),
  c('antilagTriggered', 'Antilag triggered'), c('isAntilagCondition'),
  c('ALSLatchActive'), c('ALSTimedOut'), c('ALSTimeRemaining'),
  c('fuelALSCorrection'), c('timingALSCorrection'), c('ALSHardSparkSkip'),
  c('alsEtbAddValue'), c('correctedIgnitionAdvance', 'Timing: ignition'),
];

describe('EpicEFI Anti-Lag starter', () => {
  it('gates on the live latch/time/fuel/timing capability bundle', () => {
    expect(starterWorkspaceAvailable(EPICEFI_ANTI_LAG_DUAL_WORKSPACE, als)).toBe(true);
    for (const required of ['isAntilagCondition', 'ALSLatchActive', 'ALSTimeRemaining', 'fuelALSCorrection', 'timingALSCorrection']) {
      expect(starterWorkspaceAvailable(
        EPICEFI_ANTI_LAG_DUAL_WORKSPACE,
        als.filter((channel) => channel.sourceName !== required),
      )).toBe(false);
    }
  });

  it('resolves condition/latch context separately from ALS actuator corrections', () => {
    const result = resolveStarterWorkspaceTemplate(EPICEFI_ANTI_LAG_DUAL_WORKSPACE, als);
    expect(result.panes[0]?.channelIds).toEqual([
      'ini:RPMValue', 'ini:MAPValue', 'ini:TPSValue', 'ini:antilagTriggered',
      'ini:isAntilagCondition', 'ini:ALSLatchActive', 'ini:ALSTimedOut', 'ini:ALSTimeRemaining',
    ]);
    expect(result.panes[1]?.channelIds).toEqual([
      'ini:fuelALSCorrection', 'ini:timingALSCorrection', 'ini:ALSHardSparkSkip',
      'ini:alsEtbAddValue', 'ini:correctedIgnitionAdvance',
    ]);
    expect(result.unresolvedRequiredRoleIds).toEqual([]);
  });

  it('rejects ALS tune/configuration lookalikes as runtime capability evidence', () => {
    expect(resolveSemanticChannelRole('als.conditionActive', [
      c('antiLagEnabled', 'Anti-lag enabled'), c('ALSMinRPM', 'Min RPM'), c('ALSMaxDuration', 'ALS timeout'),
    ]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('als.timeRemaining', [
      c('ALSMaxDuration', 'ALS timeout'), c('alsMinTimeBetween', 'ALS minimum time between'),
    ]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('als.fuelCorrection', [
      c('ALSFuelAdjustment', 'ALS fuel adjustment table'), c('alsFuelAdjustmentLoadBins'),
    ]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('als.timingCorrection', [
      c('ALSTimingRetardTable', 'ALS timing retard table'), c('alsIgnRetardrpmBins'),
    ]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('als.sparkSkip', [
      c('ALSIgnSkipTable', 'ALS spark skip table'), c('ALSSkipRatio', 'ALS skip ratio'),
    ]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('als.etbAirAdd', [
      c('ALSEtbAdd', 'ETB Air Add'), c('alsEtbPosition'), c('ALSEtbAirAddTable', 'ETB Air Add table'),
    ]).channel).toBeUndefined();
  });
});
