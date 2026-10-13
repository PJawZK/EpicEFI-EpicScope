import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import { STARTUP_WARMUP_DUAL_WORKSPACE, TRIGGER_SYNC_DUAL_WORKSPACE, STARTER_WORKSPACE_TEMPLATES, resolveStarterWorkspaceTemplate } from '../../apps/web/src/state/built-in-workspace-templates';
import { resolveSemanticChannelRole } from '../../apps/web/src/state/semantic-channel-roles';
function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition { return { id, sourceName, displayName, valueType: 'number' }; }
describe('Trigger / Sync and Startup / Warmup starters', () => {
  it('appends both starters to the production catalog', () => expect(STARTER_WORKSPACE_TEMPLATES.slice(-2).map((t) => t.name)).toEqual(['Trigger / Sync', 'Startup / Warmup']));
  it('resolves Trigger / Sync onto canonical EpicEFI INI identities', () => {
    const r = resolveStarterWorkspaceTemplate(TRIGGER_SYNC_DUAL_WORKSPACE, [
      channel('ini:RPMValue','RPMValue','RPM'), channel('ini:triggerSyncState','triggerSyncState','Trigger sync state'),
      channel('ini:m_hasSynchronizedPhase','m_hasSynchronizedPhase','Fully synchronized'), channel('ini:isTriggerError','isTriggerError','Error: Trigger'),
      channel('ini:totalTriggerErrorCounter','totalTriggerErrorCounter','Trigger error count'), channel('ini:camResyncCounter','camResyncCounter','Resync counter'),
      channel('ini:currentEngineDecodedPhase','currentEngineDecodedPhase','Engine Phase'), channel('ini:VBatt','VBatt','Battery'),
    ]);
    expect(r.panes[0]?.channelIds).toEqual(['ini:RPMValue','ini:triggerSyncState','ini:m_hasSynchronizedPhase','ini:isTriggerError']);
    expect(r.panes[1]?.channelIds).toEqual(['ini:totalTriggerErrorCounter','ini:camResyncCounter','ini:currentEngineDecodedPhase','ini:VBatt']);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
  });
  it('keeps trigger state distinct from counters/settings', () => {
    const c=[channel('isTriggerError','isTriggerError','Error: Trigger'),channel('totalTriggerErrorCounter','totalTriggerErrorCounter','Trigger error count'),channel('triggerSyncConfirmCycles','triggerSyncConfirmCycles','Sync confirmation cycles')];
    expect(resolveSemanticChannelRole('trigger.errorActive',c).channel?.id).toBe('isTriggerError');
    expect(resolveSemanticChannelRole('trigger.errorCount',c).channel?.id).toBe('totalTriggerErrorCounter');
  });
  it('resolves Startup / Warmup onto canonical EpicEFI INI identities', () => {
    const r = resolveStarterWorkspaceTemplate(STARTUP_WARMUP_DUAL_WORKSPACE, [
      channel('ini:RPMValue','RPMValue','RPM'),channel('ini:coolant','coolant','Coolant temp'),channel('ini:intake','intake','Intake air temp'),channel('ini:VBatt','VBatt','Battery'),
      channel('ini:revolutionCounterSinceStart','revolutionCounterSinceStart','Engine Cycle Count'),channel('ini:crankingFuel_fuel','crankingFuel_fuel','Fuel: Cranking cycle mass'),
      channel('ini:running_postCrankingFuelCorrection','running_postCrankingFuelCorrection','Fuel: Post cranking mult'),channel('ini:running_coolantTemperatureCoefficient','running_coolantTemperatureCoefficient','Fuel: CLT correction'),
      channel('ini:lambdaValue','lambdaValue','Lambda'),channel('ini:idleTarget','idleTarget','Idle target'),
    ]);
    expect(r.panes[0]?.channelIds).toEqual(['ini:RPMValue','ini:coolant','ini:intake','ini:VBatt','ini:revolutionCounterSinceStart']);
    expect(r.panes[1]?.channelIds).toEqual(['ini:crankingFuel_fuel','ini:running_postCrankingFuelCorrection','ini:running_coolantTemperatureCoefficient','ini:lambdaValue','ini:idleTarget']);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
  });
  it('does not use cranking configuration channels as runtime cranking fuel', () => expect(resolveSemanticChannelRole('startup.crankingFuel',[channel('crankingFuel_baseFuel'),channel('crankingFuel_coolantTemperatureCoefficient')]).channel).toBeUndefined());
});
