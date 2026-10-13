import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import { EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE, availableStarterWorkspaceTemplates, resolveStarterWorkspaceTemplate, starterWorkspaceAvailable } from '../../apps/web/src/state/built-in-workspace-templates';
import { resolveSemanticChannelRole } from '../../apps/web/src/state/semantic-channel-roles';
function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition { return { id, sourceName, displayName, valueType: 'number' }; }
const capabilityChannels = [
  channel('ini:RPMValue','RPMValue','RPM'), channel('ini:TPSValue','TPSValue','TPS'), channel('ini:deltaTps','deltaTps','AE: TPS change'), channel('ini:MAPValue','MAPValue','MAP'),
  channel('ini:fallbackMap','fallbackMap','fallbackMap'), channel('ini:effectiveMap','effectiveMap','Effective MAP'), channel('ini:isMapPredictionActive','isMapPredictionActive','isMapPredictionActive'),
  channel('ini:lambdaValue','lambdaValue','Lambda'), channel('ini:actualLastInjection','actualLastInjection','Fuel: Last inj pulse width'), channel('ini:tpsAccelFuel','tpsAccelFuel','Fuel: TPS AE add fuel ms'),
  channel('ini:wallFuelAmount','wallFuelAmount','Fuel: wall amount'), channel('ini:wallFuelCorrection','wallFuelCorrection','fuel wallwetting injection time'),
];
describe('capability-gated EpicEFI starters', () => {
  it('keeps generic starters available while hiding EpicEFI-specific starters without capabilities', () => {
    const names=availableStarterWorkspaceTemplates([]).map((t)=>t.name); expect(names).toContain('General'); expect(names).toContain('Vehicle / Driveline'); expect(names).not.toContain('EpicEFI · MAP Predict + Wall Wetting');
  });
  it('offers MAP Predict + Wall Wetting only when its full runtime capability bundle resolves', () => {
    expect(starterWorkspaceAvailable(EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE, capabilityChannels)).toBe(true);
    expect(availableStarterWorkspaceTemplates(capabilityChannels).map((t)=>t.name)).toContain('EpicEFI · MAP Predict + Wall Wetting');
    expect(starterWorkspaceAvailable(EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE, capabilityChannels.filter((c)=>c.sourceName!=='isMapPredictionActive'))).toBe(false);
  });
  it('resolves the specialized starter onto the current EpicEFI runtime identities', () => {
    const r=resolveStarterWorkspaceTemplate(EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE, capabilityChannels);
    expect(r.panes[0]?.channelIds).toEqual(['ini:RPMValue','ini:TPSValue','ini:deltaTps','ini:MAPValue','ini:fallbackMap','ini:effectiveMap','ini:isMapPredictionActive']);
    expect(r.panes[1]?.channelIds).toEqual(['ini:lambdaValue','ini:actualLastInjection','ini:tpsAccelFuel','ini:wallFuelAmount','ini:wallFuelCorrection']);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
  });
  it('does not mistake MAP prediction configuration for runtime capability', () => {
    const configOnly=[channel('mapPredictionBlendDuration','mapPredictionBlendDuration','Predictive MAP Blend Duration'),channel('useMapEstimateDuringTransient','useMapEstimateDuringTransient','Use MAP estimate during transient'),channel('wwaeTau','wwaeTau','Wall wetting tau'),channel('wwaeBeta','wwaeBeta','Wall wetting beta')];
    expect(resolveSemanticChannelRole('transient.predictedMap',configOnly).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('transient.mapPredictionActive',configOnly).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('transient.wallFuelAmount',configOnly).channel).toBeUndefined();
    expect(starterWorkspaceAvailable(EPICEFI_MAP_PREDICT_WALL_WETTING_DUAL_WORKSPACE,configOnly)).toBe(false);
  });
});
