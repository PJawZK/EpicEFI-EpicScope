from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected one anchor, got {text.count(old)}')
    p.write_text(text.replace(old, new, 1))


semantic = 'apps/web/src/state/semantic-channel-roles.ts'
union_anchor = "  | 'als.etbAirAdd'\n  | 'cooling.coolantPressure';"
union_insert = """  | 'als.etbAirAdd'
  | 'launch.preLaunchActive'
  | 'launch.active'
  | 'launch.switchActive'
  | 'launch.clutchActive'
  | 'launch.speedCondition'
  | 'launch.tpsCondition'
  | 'launch.rpmCondition'
  | 'launch.rpmLocked'
  | 'launch.lockedRpm'
  | 'launch.sparkSkip'
  | 'traction.disabled'
  | 'traction.speedRefLeftRight'
  | 'traction.speedRefFrontRear'
  | 'traction.slipLeftRight'
  | 'traction.slipFrontRear'
  | 'traction.timingReduction'
  | 'traction.sparkSkip'
  | 'traction.etbReduction'
  | 'transmission.currentGear'
  | 'transmission.targetGear'
  | 'transmission.nextGear'
  | 'transmission.inputShaftSpeed'
  | 'transmission.inputShaftSpeedTarget'
  | 'transmission.outputShaftSpeed'
  | 'transmission.targetEngineRpm'
  | 'transmission.calculatedTorque'
  | 'transmission.targetTorque'
  | 'transmission.fastTorqueRequest'
  | 'transmission.cutTarget'
  | 'transmission.blipTarget'
  | 'transmission.clutchSlip'
  | 'transmission.torqueReductionRequested'
  | 'transmission.faultStatus'
  | 'cooling.coolantPressure';"""
replace_once(semantic, union_anchor, union_insert)

roles_anchor = "  'cooling.coolantPressure': {"
roles_insert = r"""  'launch.preLaunchActive': { id: 'launch.preLaunchActive', displayName: 'Pre-Launch Active', aliases: ['isPreLaunchCondition', 'Pre-Launch Active'], include: [/^is.*pre.*launch.*condition$/i, /^pre.*launch.*active$/i], exclude: [/enable/i, /window/i, /table/i, /config/i] },
  'launch.active': { id: 'launch.active', displayName: 'Launch Active', aliases: ['isLaunchCondition', 'Launch: isLaunchCondition', 'Launch Active'], include: [/^is.*launch.*condition$/i, /^launch.*active$/i], exclude: [/pre/i, /enable/i, /table/i, /config/i] },
  'launch.switchActive': { id: 'launch.switchActive', displayName: 'Launch Switch Active', aliases: ['isSwitchActivated', 'Launch: isSwitchActivated', 'Launch Switch Active'], include: [/^is.*switch.*activated$/i, /launch.*switch.*active/i], exclude: [/pin/i, /mode/i, /config/i] },
  'launch.clutchActive': { id: 'launch.clutchActive', displayName: 'Launch Clutch Active', aliases: ['isClutchActivated', 'Launch: isClutchActivated', 'Launch Clutch Active'], include: [/^is.*clutch.*activated$/i, /launch.*clutch.*active/i], exclude: [/up/i, /pin/i, /mode/i, /config/i] },
  'launch.speedCondition': { id: 'launch.speedCondition', displayName: 'Launch Speed Condition', aliases: ['speedCondition', 'Launch: speedCondition', 'Launch Speed Condition'], include: [/^launch.*speed.*condition$/i, /^speed.*condition$/i], exclude: [/threshold/i, /limit/i, /table/i, /config/i] },
  'launch.tpsCondition': { id: 'launch.tpsCondition', displayName: 'Launch TPS Condition', aliases: ['tpsCondition', 'Launch: tpsCondition', 'Launch TPS Condition'], include: [/^launch.*tps.*condition$/i, /^tps.*condition$/i], exclude: [/threshold/i, /limit/i, /table/i, /config/i] },
  'launch.rpmCondition': { id: 'launch.rpmCondition', displayName: 'Launch RPM Condition', aliases: ['rpmLaunchCondition', 'Launch RPM Condition'], include: [/^rpm.*launch.*condition$/i, /^launch.*rpm.*condition$/i], exclude: [/pre/i, /threshold/i, /limit/i, /table/i, /config/i] },
  'launch.rpmLocked': { id: 'launch.rpmLocked', displayName: 'Launch RPM Locked', aliases: ['isRpmLaunchLocked', 'Launch RPM Locked'], include: [/^is.*rpm.*launch.*locked$/i, /^launch.*rpm.*locked$/i], exclude: [/adder/i, /table/i, /config/i] },
  'launch.lockedRpm': { id: 'launch.lockedRpm', displayName: 'Locked Launch RPM', aliases: ['rpmLaunchLockedRpm', 'Locked Launch RPM'], include: [/^rpm.*launch.*locked.*rpm$/i, /^locked.*launch.*rpm$/i], exclude: [/adder/i, /table/i, /config/i] },
  'launch.sparkSkip': { id: 'launch.sparkSkip', displayName: 'Launch Spark Skip', aliases: ['launchSparkSkipRatio', 'Launch Spark Skip'], include: [/^launch.*spark.*skip.*ratio$/i, /^launch.*spark.*skip$/i], exclude: [/table/i, /initial/i, /final/i, /enable/i, /config/i] },
  'traction.disabled': { id: 'traction.disabled', displayName: 'Traction Disabled', aliases: ['tracDisabled', 'Traction Disabled'], include: [/^trac.*disabled$/i, /^traction.*disabled$/i], exclude: [/button/i, /enable/i, /config/i] },
  'traction.speedRefLeftRight': { id: 'traction.speedRefLeftRight', displayName: 'Traction L/R Speed Ref', aliases: ['tracSpeedLeftRightREF', 'LeftRightSpeedRef', 'Traction Left/Right Speed Reference'], include: [/^trac.*speed.*left.*right.*ref$/i, /^left.*right.*speed.*ref$/i], exclude: [/bin/i, /table/i, /config/i] },
  'traction.speedRefFrontRear': { id: 'traction.speedRefFrontRear', displayName: 'Traction F/R Speed Ref', aliases: ['tracSpeedFrontRearREF', 'FrontRearSpeedRef', 'Traction Front/Rear Speed Reference'], include: [/^trac.*speed.*front.*rear.*ref$/i, /^front.*rear.*speed.*ref$/i], exclude: [/bin/i, /table/i, /config/i] },
  'traction.slipLeftRight': { id: 'traction.slipLeftRight', displayName: 'Traction L/R Slip', aliases: ['wheelSlipRatioLeftRightREF', 'Traction Left/Right Slip'], include: [/^wheel.*slip.*ratio.*left.*right.*ref$/i, /^traction.*left.*right.*slip$/i], exclude: [/bin/i, /table/i, /front$/i, /rear$/i, /config/i] },
  'traction.slipFrontRear': { id: 'traction.slipFrontRear', displayName: 'Traction F/R Slip', aliases: ['wheelSlipRatioFrontRear', 'Wheel Slip Ratio Front/Rear', 'Traction Front/Rear Slip'], include: [/^wheel.*slip.*ratio.*front.*rear$/i, /^traction.*front.*rear.*slip$/i], exclude: [/bin/i, /table/i, /config/i] },
  'traction.timingReduction': { id: 'traction.timingReduction', displayName: 'Traction Timing Reduction', aliases: ['tractionAdvanceDrop', 'Traction: timing correction', 'Traction Timing Reduction'], include: [/^traction.*advance.*drop$/i, /^traction.*timing.*correction$/i], exclude: [/table/i, /left/i, /right/i, /front/i, /rear/i, /config/i] },
  'traction.sparkSkip': { id: 'traction.sparkSkip', displayName: 'Traction Spark Skip', aliases: ['tractionControlSparkSkip', 'Traction Spark Skip'], include: [/^traction.*control.*spark.*skip$/i, /^traction.*spark.*skip$/i], exclude: [/table/i, /left/i, /right/i, /front/i, /rear/i, /config/i] },
  'traction.etbReduction': { id: 'traction.etbReduction', displayName: 'Traction ETB Reduction', aliases: ['etb1tcEtbDrop', 'etb1ETB traction control', 'Traction ETB Reduction'], include: [/^etb.*traction.*control$/i, /^etb.*tc.*etb.*drop$/i, /^traction.*etb.*reduction$/i], exclude: [/table/i, /config/i, /enable/i] },
  'transmission.currentGear': { id: 'transmission.currentGear', displayName: 'Trans Current Gear', aliases: ['transCurrentGear', 'Trans: current gear', 'Transmission Current Gear'], include: [/^trans.*current.*gear$/i], exclude: [/table/i, /ratio/i, /config/i] },
  'transmission.targetGear': { id: 'transmission.targetGear', displayName: 'Trans Target Gear', aliases: ['transTargetGear', 'Trans: target gear', 'Transmission Target Gear'], include: [/^trans.*target.*gear$/i], exclude: [/table/i, /config/i] },
  'transmission.nextGear': { id: 'transmission.nextGear', displayName: 'Trans Next Gear', aliases: ['transNextGear', 'Trans: next gear', 'Transmission Next Gear'], include: [/^trans.*next.*gear$/i], exclude: [/rpm/i, /table/i, /config/i] },
  'transmission.inputShaftSpeed': { id: 'transmission.inputShaftSpeed', displayName: 'Trans Input Shaft Speed', aliases: ['transInputShaftSpeed', 'Trans: input shaft speed'], include: [/^trans.*input.*shaft.*speed$/i], exclude: [/target/i, /table/i, /config/i] },
  'transmission.inputShaftSpeedTarget': { id: 'transmission.inputShaftSpeedTarget', displayName: 'Trans Input Shaft Target', aliases: ['transInputShaftSpeedTarget', 'Trans: input shaft speed target'], include: [/^trans.*input.*shaft.*speed.*target$/i], exclude: [/table/i, /config/i] },
  'transmission.outputShaftSpeed': { id: 'transmission.outputShaftSpeed', displayName: 'Trans Output Shaft Speed', aliases: ['transOutputShaftSpeed', 'Trans: output shaft speed'], include: [/^trans.*output.*shaft.*speed$/i], exclude: [/table/i, /config/i] },
  'transmission.targetEngineRpm': { id: 'transmission.targetEngineRpm', displayName: 'Trans Target Engine RPM', aliases: ['transTargetEngineRpm', 'Trans: target engine RPM'], include: [/^trans.*target.*engine.*rpm$/i], exclude: [/table/i, /config/i] },
  'transmission.calculatedTorque': { id: 'transmission.calculatedTorque', displayName: 'Trans Calculated Torque', aliases: ['transCalculatedTorque', 'Trans: calculated engine torque'], include: [/^trans.*calculated.*(?:engine.*)?torque$/i], exclude: [/table/i, /config/i] },
  'transmission.targetTorque': { id: 'transmission.targetTorque', displayName: 'Trans Target Torque', aliases: ['transTargetTorque', 'Trans: target engine torque'], include: [/^trans.*target.*(?:engine.*)?torque$/i], exclude: [/table/i, /config/i, /limit/i] },
  'transmission.fastTorqueRequest': { id: 'transmission.fastTorqueRequest', displayName: 'Trans Fast Torque Request', aliases: ['transTorqueRequestFast', 'Trans: fast torque request'], include: [/^trans.*fast.*torque.*request$/i, /^trans.*torque.*request.*fast$/i], exclude: [/table/i, /config/i] },
  'transmission.cutTarget': { id: 'transmission.cutTarget', displayName: 'Trans Cut Target', aliases: ['transCutPercent', 'Trans: cut target'], include: [/^trans.*cut.*(?:target|percent)$/i], exclude: [/table/i, /config/i, /current/i] },
  'transmission.blipTarget': { id: 'transmission.blipTarget', displayName: 'Trans Blip Target', aliases: ['transBlipPercent', 'Trans: blip target'], include: [/^trans.*blip.*(?:target|percent)$/i], exclude: [/rpm/i, /throttle/i, /ignition/i, /table/i, /config/i] },
  'transmission.clutchSlip': { id: 'transmission.clutchSlip', displayName: 'Trans Clutch Slip', aliases: ['transClutchSlipPercent', 'Trans: clutch slip'], include: [/^trans.*clutch.*slip$/i, /^trans.*clutch.*slip.*percent$/i], exclude: [/table/i, /config/i] },
  'transmission.torqueReductionRequested': { id: 'transmission.torqueReductionRequested', displayName: 'Trans Torque Reduction Requested', aliases: ['transTorqueReductionRequested', 'Trans: torque reduction requested'], include: [/^trans.*torque.*reduction.*requested$/i], exclude: [/enable/i, /table/i, /config/i] },
  'transmission.faultStatus': { id: 'transmission.faultStatus', displayName: 'Trans Fault Status', aliases: ['transFaultStatus', 'Trans: fault status'], include: [/^trans.*fault.*status$/i], exclude: [/enable/i, /table/i, /config/i] },

  'cooling.coolantPressure': {"""
replace_once(semantic, roles_anchor, roles_insert)

workspace = 'apps/web/src/state/built-in-workspace-templates.ts'
workspace_anchor = 'export const STARTER_WORKSPACE_TEMPLATES: readonly StarterWorkspaceTemplate[] = Object.freeze(['
workspace_insert = """export const EPICEFI_LAUNCH_CONTROL_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-launch-control-dual',
  name: 'EpicEFI · Launch Control',
  description: 'EpicEFI launch arming, state, RPM-lock and spark-skip diagnostics.',
  tier: 'epicefi',
  availability: { allOfRoleIds: ['launch.preLaunchActive', 'launch.active', 'launch.lockedRpm', 'launch.sparkSkip'] },
  layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' },
      { roleId: 'engine.throttle.position', requirement: 'preferred' },
      { roleId: 'vehicle.speed', requirement: 'preferred' },
      { roleId: 'launch.preLaunchActive', requirement: 'required' },
      { roleId: 'launch.active', requirement: 'required' },
      { roleId: 'launch.speedCondition', requirement: 'preferred' },
      { roleId: 'launch.tpsCondition', requirement: 'preferred' },
      { roleId: 'launch.rpmCondition', requirement: 'preferred' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'launch.rpmLocked', requirement: 'preferred' },
      { roleId: 'launch.lockedRpm', requirement: 'required' },
      { roleId: 'launch.sparkSkip', requirement: 'required' },
      { roleId: 'ignition.advance', requirement: 'preferred' },
      { roleId: 'fuel.injectorPulseWidth', requirement: 'optional' },
    ] },
  ],
};

export const EPICEFI_TRACTION_CONTROL_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-traction-control-dual',
  name: 'EpicEFI · Traction Control',
  description: 'EpicEFI wheel-slip reference and torque-reduction intervention diagnostics.',
  tier: 'epicefi',
  availability: { allOfRoleIds: ['traction.speedRefLeftRight', 'traction.slipLeftRight', 'traction.timingReduction', 'traction.sparkSkip'] },
  layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'preferred' },
      { roleId: 'vehicle.speed', requirement: 'preferred' },
      { roleId: 'traction.speedRefLeftRight', requirement: 'required' },
      { roleId: 'traction.speedRefFrontRear', requirement: 'preferred' },
      { roleId: 'traction.slipLeftRight', requirement: 'required' },
      { roleId: 'traction.slipFrontRear', requirement: 'preferred' },
      { roleId: 'traction.disabled', requirement: 'preferred' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'traction.timingReduction', requirement: 'required' },
      { roleId: 'traction.sparkSkip', requirement: 'required' },
      { roleId: 'traction.etbReduction', requirement: 'optional' },
      { roleId: 'ignition.advance', requirement: 'preferred' },
      { roleId: 'engine.throttle.position', requirement: 'optional' },
    ] },
  ],
};

export const EPICEFI_TRANSMISSION_CONTROL_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-transmission-control-dual',
  name: 'EpicEFI · Transmission Control',
  description: 'EpicEFI transmission shift, shaft-speed and torque-intervention diagnostics.',
  tier: 'epicefi',
  availability: { allOfRoleIds: ['transmission.currentGear', 'transmission.targetGear', 'transmission.inputShaftSpeed', 'transmission.outputShaftSpeed', 'transmission.cutTarget', 'transmission.blipTarget'] },
  layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'preferred' },
      { roleId: 'transmission.currentGear', requirement: 'required' },
      { roleId: 'transmission.targetGear', requirement: 'required' },
      { roleId: 'transmission.nextGear', requirement: 'preferred' },
      { roleId: 'transmission.inputShaftSpeed', requirement: 'required' },
      { roleId: 'transmission.inputShaftSpeedTarget', requirement: 'preferred' },
      { roleId: 'transmission.outputShaftSpeed', requirement: 'required' },
      { roleId: 'transmission.targetEngineRpm', requirement: 'preferred' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'transmission.calculatedTorque', requirement: 'preferred' },
      { roleId: 'transmission.targetTorque', requirement: 'preferred' },
      { roleId: 'transmission.fastTorqueRequest', requirement: 'optional' },
      { roleId: 'transmission.cutTarget', requirement: 'required' },
      { roleId: 'transmission.blipTarget', requirement: 'required' },
      { roleId: 'transmission.clutchSlip', requirement: 'preferred' },
      { roleId: 'transmission.torqueReductionRequested', requirement: 'preferred' },
      { roleId: 'transmission.faultStatus', requirement: 'preferred' },
    ] },
  ],
};

export const STARTER_WORKSPACE_TEMPLATES: readonly StarterWorkspaceTemplate[] = Object.freeze(["""
replace_once(workspace, workspace_anchor, workspace_insert)
replace_once(workspace, "  EPICEFI_ANTI_LAG_DUAL_WORKSPACE,\n]);", "  EPICEFI_ANTI_LAG_DUAL_WORKSPACE,\n  EPICEFI_LAUNCH_CONTROL_DUAL_WORKSPACE,\n  EPICEFI_TRACTION_CONTROL_DUAL_WORKSPACE,\n  EPICEFI_TRANSMISSION_CONTROL_DUAL_WORKSPACE,\n]);")

catalog_test = 'tests/web/built-in-workspace-templates.test.ts'
replace_once(catalog_test, "      'EpicEFI · Anti-Lag',\n", "      'EpicEFI · Anti-Lag', 'EpicEFI · Launch Control', 'EpicEFI · Traction Control',\n      'EpicEFI · Transmission Control',\n")

final_test = Path('tests/web/epicefi-final-specialized-starters.test.ts')
final_test.write_text("""import { describe, expect, it } from 'vitest';
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
""")

prepop = 'docs/PREPOPULATED_WORKSPACES.md'
replace_once(prepop,
"- **EpicEFI · Anti-Lag** — ALS latch/timeout state with fuel, ignition, spark-skip and ETB-air intervention diagnostics.\n\nThe current specialized coverage audit is maintained in [`SPECIALIZED_WORKSPACE_COVERAGE.md`](SPECIALIZED_WORKSPACE_COVERAGE.md). Its current highest-value next candidates are **Launch Control**, **Traction Control** and **Transmission Control**. Per-cylinder/EGT work is deliberately deferred until the semantic layer can represent indexed channel families cleanly.",
"- **EpicEFI · Anti-Lag** — ALS latch/timeout state with fuel, ignition, spark-skip and ETB-air intervention diagnostics;\n- **EpicEFI · Launch Control** — launch gating, pre-launch/launch state, RPM lock and spark-skip diagnostics;\n- **EpicEFI · Traction Control** — slip/reference-speed calculations and timing/spark/ETB intervention diagnostics;\n- **EpicEFI · Transmission Control** — focused shift, shaft-speed, torque, cut/blip and fault diagnostics.\n\nThe generic catalog and the evidence-ranked specialized Tier A catalog are now complete. Template expansion stops here for the validation phase. Staged Injection and Closed-loop Fuel / STFT / LTFT remain secondary future candidates, while per-cylinder/EGT work remains deferred until the semantic layer can represent indexed channel families cleanly.")

coverage = 'docs/SPECIALIZED_WORKSPACE_COVERAGE.md'
p = Path(coverage)
text = p.read_text()
text = text.replace("Status: 2026-10-13, after PR #363 (`116ee68750806b5c2686a1888eedb0ae86b843fd`).", "Status: 2026-10-13, catalog expansion complete through Launch, Traction and Transmission Control.", 1)
text = text.replace('Nine EpicEFI-specific starters are already implemented:', 'Twelve EpicEFI-specific starters are implemented:', 1)
text = text.replace('- **EpicEFI · Anti-Lag**\n', '- **EpicEFI · Anti-Lag**\n- **EpicEFI · Launch Control**\n- **EpicEFI · Traction Control**\n- **EpicEFI · Transmission Control**\n', 1)
start = text.index('## Tier A — strong next specialized candidates')
end = text.index('## Tier B — valid candidates after Tier A')
replacement = """## Tier A — implementation complete; validation cutoff reached

The evidence-ranked Tier A candidates are now implemented. No further ordinary specialized starters should be added before product validation.

The next phase is deliberately:

```text
INI-only catalog/discovery smoke test
→ materialize every generic and supported EpicEFI starter
→ refresh/persistence test
→ MLG + INI resolution test
→ source transition test
→ ts_shim/live schema test when available
→ fix resolver or lifecycle defects exposed by evidence
```

Only after that validation pass should Tier B be reconsidered.

"""
text = text[:start] + replacement + text[end:]
p.write_text(text)
