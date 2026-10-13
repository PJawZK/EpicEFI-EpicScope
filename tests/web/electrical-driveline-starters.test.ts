import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import { ELECTRICAL_DUAL_WORKSPACE, VEHICLE_DRIVELINE_DUAL_WORKSPACE, STARTER_WORKSPACE_TEMPLATES, resolveStarterWorkspaceTemplate } from '../../apps/web/src/state/built-in-workspace-templates';
import { resolveSemanticChannelRole } from '../../apps/web/src/state/semantic-channel-roles';
function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition { return { id, sourceName, displayName, valueType: 'number' }; }
describe('Electrical and Vehicle / Driveline starters', () => {
  it('completes the generic starter catalog', () => expect(STARTER_WORKSPACE_TEMPLATES.slice(-2).map((t) => t.name)).toEqual(['Electrical', 'Vehicle / Driveline']));
  it('resolves Electrical onto canonical EpicEFI INI identities', () => {
    const r = resolveStarterWorkspaceTemplate(ELECTRICAL_DUAL_WORKSPACE, [
      channel('ini:VBatt','VBatt','Battery'), channel('ini:RPMValue','RPMValue','RPM'), channel('ini:actualLastInjection','actualLastInjection','Fuel: Last inj pulse width'), channel('ini:sparkDwell','sparkDwell','Ignition: coil charge time'), channel('ini:injectorDutyCycle','injectorDutyCycle','Fuel: injector duty cycle'), channel('ini:isFuelPumpOn','isFuelPumpOn','Fuel pump on'), channel('ini:alternatorDutyCycle','alternatorDutyCycle','Alternator duty'), channel('ini:rawSst1Volts','rawSst1Volts','Sensor supply 1'), channel('ini:sst1Fault','sst1Fault','SST1: Fault'),
    ]);
    expect(r.panes[0]?.channelIds).toEqual(['ini:VBatt','ini:RPMValue','ini:actualLastInjection','ini:sparkDwell']);
    expect(r.panes[1]?.channelIds).toEqual(['ini:injectorDutyCycle','ini:isFuelPumpOn','ini:alternatorDutyCycle','ini:rawSst1Volts','ini:sst1Fault']);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
  });
  it('keeps sensor-supply runtime values distinct from tracker configuration', () => {
    const c=[channel('sst1AdcChannel','sst1AdcChannel','SST 1 input'),channel('sstValidMin','sstValidMin','SST valid min'),channel('rawSst1Volts','rawSst1Volts','Sensor supply 1')];
    expect(resolveSemanticChannelRole('electrical.sensorSupplyVoltage',c).channel?.id).toBe('rawSst1Volts');
  });
  it('resolves Vehicle / Driveline onto canonical EpicEFI INI identities', () => {
    const r = resolveStarterWorkspaceTemplate(VEHICLE_DRIVELINE_DUAL_WORKSPACE, [
      channel('ini:RPMValue','RPMValue','RPM'), channel('ini:vehicleSpeedKph','vehicleSpeedKph','Vehicle Speed'), channel('ini:TPSValue','TPSValue','TPS'), channel('ini:MAPValue','MAPValue','MAP'), channel('ini:detectedGear','detectedGear','Detected Gear'), channel('ini:clutchDownState','clutchDownState','Clutch: down'), channel('ini:brakePedalState','brakePedalState','Brake switch'), channel('ini:vehicleSpeedKph1','vehicleSpeedKph1','Wheel speed 1 FL'), channel('ini:vehicleSpeedKph2','vehicleSpeedKph2','Wheel speed 2 FR'), channel('ini:vehicleSpeedKph3','vehicleSpeedKph3','Wheel speed 3 RL'), channel('ini:vehicleSpeedKph4','vehicleSpeedKph4','Wheel speed 4 RR'), channel('ini:accelerationLon','accelerationLon','Accel: Longitudinal'),
    ]);
    expect(r.panes[0]?.channelIds).toEqual(['ini:RPMValue','ini:vehicleSpeedKph','ini:TPSValue','ini:MAPValue','ini:detectedGear']);
    expect(r.panes[1]?.channelIds).toEqual(['ini:clutchDownState','ini:brakePedalState','ini:vehicleSpeedKph1','ini:vehicleSpeedKph2','ini:vehicleSpeedKph3','ini:vehicleSpeedKph4','ini:accelerationLon']);
    expect(r.unresolvedRequiredRoleIds).toEqual([]);
  });
  it('does not mistake gear targets or transmission brake pressure for generic states', () => {
    expect(resolveSemanticChannelRole('vehicle.gear',[channel('transTargetGear','transTargetGear','Trans: target gear')]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('vehicle.brakeState',[channel('transBrakePressure','transBrakePressure','Trans: brake pressure')]).channel).toBeUndefined();
  });
});
