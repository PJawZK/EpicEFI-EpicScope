import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  EPICEFI_LAUNCH_CONTROL_DUAL_WORKSPACE,
  EPICEFI_TRACTION_CONTROL_DUAL_WORKSPACE,
  EPICEFI_TRANSMISSION_CONTROL_DUAL_WORKSPACE,
  resolveStarterWorkspaceTemplate,
  starterWorkspaceAvailable,
} from '../../apps/web/src/state/built-in-workspace-templates';
import { resolveSemanticChannelRole } from '../../apps/web/src/state/semantic-channel-roles';

const c = (id: string, displayName = id): ChannelDefinition => ({
  id: `ini:${id}`, sourceName: id, displayName, valueType: 'number',
});

const launch = [
  c('RPMValue', 'RPM'), c('TPSValue', 'TPS'), c('vehicleSpeedKph', 'Vehicle Speed'),
  c('isPreLaunchCondition'), c('isLaunchCondition', 'Launch: isLaunchCondition'),
  c('speedCondition', 'Launch: speedCondition'), c('tpsCondition', 'Launch: tpsCondition'),
  c('rpmLaunchCondition'), c('isRpmLaunchLocked'), c('rpmLaunchLockedRpm'),
  c('launchSparkSkipRatio'), c('correctedIgnitionAdvance', 'Timing: ignition'),
  c('actualLastInjection', 'Fuel: Last inj pulse width'),
];

const traction = [
  c('RPMValue', 'RPM'), c('vehicleSpeedKph', 'Vehicle Speed'), c('TPSValue', 'TPS'),
  c('tracSpeedLeftRightREF', 'LeftRightSpeedRef'), c('tracSpeedFrontRearREF', 'FrontRearSpeedRef'),
  c('wheelSlipRatioLeftRightREF'), c('wheelSlipRatioFrontRear', 'Wheel Slip Ratio Front/Rear'),
  c('tracDisabled'), c('tractionAdvanceDrop', 'Traction: timing correction'),
  c('tractionControlSparkSkip'), c('etb1tcEtbDrop', 'etb1ETB traction control'),
  c('correctedIgnitionAdvance', 'Timing: ignition'),
];

const transmission = [
  c('RPMValue', 'RPM'), c('transCurrentGear', 'Trans: current gear'),
  c('transTargetGear', 'Trans: target gear'), c('transNextGear', 'Trans: next gear'),
  c('transInputShaftSpeed', 'Trans: input shaft speed'),
  c('transInputShaftSpeedTarget', 'Trans: input shaft speed target'),
  c('transOutputShaftSpeed', 'Trans: output shaft speed'),
  c('transTargetEngineRpm', 'Trans: target engine RPM'),
  c('transCalculatedTorque', 'Trans: calculated engine torque'),
  c('transTargetTorque', 'Trans: target engine torque'),
  c('transTorqueRequestFast', 'Trans: fast torque request'),
  c('transCutPercent', 'Trans: cut target'), c('transBlipPercent', 'Trans: blip target'),
  c('transClutchSlipPercent', 'Trans: clutch slip'),
  c('transTorqueReductionRequested', 'Trans: torque reduction requested'),
  c('transFaultStatus', 'Trans: fault status'),
];

describe('final EpicEFI specialized starter batch', () => {
  it('gates Launch Control on live launch-state and intervention telemetry', () => {
    expect(starterWorkspaceAvailable(EPICEFI_LAUNCH_CONTROL_DUAL_WORKSPACE, launch)).toBe(true);
    for (const required of ['isPreLaunchCondition', 'isLaunchCondition', 'rpmLaunchLockedRpm', 'launchSparkSkipRatio']) {
      expect(starterWorkspaceAvailable(EPICEFI_LAUNCH_CONTROL_DUAL_WORKSPACE, launch.filter((ch) => ch.sourceName !== required))).toBe(false);
    }
    const result = resolveStarterWorkspaceTemplate(EPICEFI_LAUNCH_CONTROL_DUAL_WORKSPACE, launch);
    expect(result.panes[0]?.channelIds).toEqual([
      'ini:RPMValue', 'ini:TPSValue', 'ini:vehicleSpeedKph', 'ini:isPreLaunchCondition',
      'ini:isLaunchCondition', 'ini:speedCondition', 'ini:tpsCondition', 'ini:rpmLaunchCondition',
    ]);
    expect(result.panes[1]?.channelIds).toEqual([
      'ini:isRpmLaunchLocked', 'ini:rpmLaunchLockedRpm', 'ini:launchSparkSkipRatio',
      'ini:correctedIgnitionAdvance', 'ini:actualLastInjection',
    ]);
  });

  it('gates Traction Control on live slip/reference and intervention telemetry', () => {
    expect(starterWorkspaceAvailable(EPICEFI_TRACTION_CONTROL_DUAL_WORKSPACE, traction)).toBe(true);
    for (const required of ['tracSpeedLeftRightREF', 'wheelSlipRatioLeftRightREF', 'tractionAdvanceDrop', 'tractionControlSparkSkip']) {
      expect(starterWorkspaceAvailable(EPICEFI_TRACTION_CONTROL_DUAL_WORKSPACE, traction.filter((ch) => ch.sourceName !== required))).toBe(false);
    }
    const result = resolveStarterWorkspaceTemplate(EPICEFI_TRACTION_CONTROL_DUAL_WORKSPACE, traction);
    expect(result.panes[0]?.channelIds).toEqual([
      'ini:RPMValue', 'ini:vehicleSpeedKph', 'ini:tracSpeedLeftRightREF', 'ini:tracSpeedFrontRearREF',
      'ini:wheelSlipRatioLeftRightREF', 'ini:wheelSlipRatioFrontRear', 'ini:tracDisabled',
    ]);
    expect(result.panes[1]?.channelIds).toEqual([
      'ini:tractionAdvanceDrop', 'ini:tractionControlSparkSkip', 'ini:etb1tcEtbDrop',
      'ini:correctedIgnitionAdvance', 'ini:TPSValue',
    ]);
  });

  it('gates Transmission Control on actual shift/shaft/cut/blip runtime data', () => {
    expect(starterWorkspaceAvailable(EPICEFI_TRANSMISSION_CONTROL_DUAL_WORKSPACE, transmission)).toBe(true);
    for (const required of ['transCurrentGear', 'transTargetGear', 'transInputShaftSpeed', 'transOutputShaftSpeed', 'transCutPercent', 'transBlipPercent']) {
      expect(starterWorkspaceAvailable(EPICEFI_TRANSMISSION_CONTROL_DUAL_WORKSPACE, transmission.filter((ch) => ch.sourceName !== required))).toBe(false);
    }
    const result = resolveStarterWorkspaceTemplate(EPICEFI_TRANSMISSION_CONTROL_DUAL_WORKSPACE, transmission);
    expect(result.panes[0]?.channelIds).toEqual([
      'ini:RPMValue', 'ini:transCurrentGear', 'ini:transTargetGear', 'ini:transNextGear',
      'ini:transInputShaftSpeed', 'ini:transInputShaftSpeedTarget', 'ini:transOutputShaftSpeed', 'ini:transTargetEngineRpm',
    ]);
    expect(result.panes[1]?.channelIds).toEqual([
      'ini:transCalculatedTorque', 'ini:transTargetTorque', 'ini:transTorqueRequestFast', 'ini:transCutPercent',
      'ini:transBlipPercent', 'ini:transClutchSlipPercent', 'ini:transTorqueReductionRequested', 'ini:transFaultStatus',
    ]);
  });

  it('rejects configuration tables/settings as capability evidence', () => {
    expect(resolveSemanticChannelRole('launch.sparkSkip', [
      c('launchControlEnabled'), c('launchSparkSkipTable'), c('launchTimingFinal'),
    ]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('traction.timingReduction', [
      c('tractionControlTimingDropLeftRight'), c('tractionControlTimingDropFrontRear'), c('tractionControlEnabled'),
    ]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('traction.sparkSkip', [
      c('tractionControlIgnitionSkipLeftRight'), c('tractionControlIgnitionSkipFrontRear'),
    ]).channel).toBeUndefined();
    expect(resolveSemanticChannelRole('transmission.currentGear', [
      c('transGearRatio'), c('transGearboxVariant'), c('transCanProtocol'),
    ]).channel).toBeUndefined();
  });
});
