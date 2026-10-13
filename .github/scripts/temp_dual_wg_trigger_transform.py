from pathlib import Path

p=Path('apps/web/src/state/semantic-channel-roles.ts'); s=p.read_text()
old="  | 'etb.feedForward'\n  | 'etb.jamDetected';"
new="""  | 'etb.feedForward'
  | 'etb.jamDetected'
  | 'boost.lowerWastegateCommand'
  | 'boost.openLoopPart'
  | 'boost.closedLoopPart'
  | 'boost.spooledLevel'
  | 'boost.controlActive'
  | 'trigger.toothAngleError'
  | 'trigger.ignoredToothCount'
  | 'trigger.primaryRiseCount'
  | 'trigger.primaryFallCount'
  | 'trigger.camRiseCount'
  | 'trigger.camFallCount';"""
assert old in s
s=s.replace(old,new,1)
old="  'etb.jamDetected': { id: 'etb.jamDetected', displayName: 'ETB Jam Detected', aliases: ['etb1jamDetected', 'ETB Jam Detected', 'ETB control fault/jam'], include: [/etb.*jam.*(?:detected|fault)/i, /jam.*detected/i], exclude: [/enable/i, /threshold/i, /timeout/i, /config/i] },\n};"
new="""  'etb.jamDetected': { id: 'etb.jamDetected', displayName: 'ETB Jam Detected', aliases: ['etb1jamDetected', 'ETB Jam Detected', 'ETB control fault/jam'], include: [/etb.*jam.*(?:detected|fault)/i, /jam.*detected/i], exclude: [/enable/i, /threshold/i, /timeout/i, /config/i] },
  'boost.lowerWastegateCommand': { id: 'boost.lowerWastegateCommand', displayName: 'Lower WG Command', aliases: ['lwgDutyPct', 'Lower WG port output', 'Lower Wastegate Command'], include: [/(?:lower.*wg|lower.*wastegate).*(?:output|duty|command)/i], exclude: [/pin/i, /mode/i, /table/i, /test/i, /limiter/i, /spooled/i, /config/i] },
  'boost.openLoopPart': { id: 'boost.openLoopPart', displayName: 'Boost Open Loop', aliases: ['openLoopPart', 'Boost: Open loop', 'Boost Open Loop'], include: [/boost.*open.*loop/i, /^open.*loop.*part$/i], exclude: [/table/i, /adder/i, /mult/i, /blend/i, /config/i] },
  'boost.closedLoopPart': { id: 'boost.closedLoopPart', displayName: 'Boost Closed Loop', aliases: ['boostControllerClosedLoopPart', 'Boost: Closed loop', 'Boost Closed Loop'], include: [/boost.*closed.*loop/i], exclude: [/table/i, /target/i, /blend/i, /config/i, /mode/i] },
  'boost.spooledLevel': { id: 'boost.spooledLevel', displayName: 'Spooled Level', aliases: ['spooledLevel', 'Spooled Level'], include: [/spooled.*level/i], exclude: [/curve/i, /table/i, /enable/i, /config/i] },
  'boost.controlActive': { id: 'boost.controlActive', displayName: 'Boost Control Active', aliases: ['isBoostControlled', 'Boost Control Active'], include: [/boost.*control.*active/i, /is.*boost.*controlled/i], exclude: [/enable/i, /config/i, /pin/i] },
  'trigger.toothAngleError': { id: 'trigger.toothAngleError', displayName: 'Trigger Tooth Angle Error', aliases: ['triggerToothAngleError', 'Sync: trigger angle error', 'Trigger Tooth Angle Error'], include: [/trigger.*tooth.*angle.*error/i, /trigger.*angle.*error/i], exclude: [/window/i, /config/i, /threshold/i] },
  'trigger.ignoredToothCount': { id: 'trigger.ignoredToothCount', displayName: 'Ignored Tooth Count', aliases: ['triggerIgnoredToothCount', 'Ignored Tooth Count'], include: [/trigger.*ignored.*tooth.*count/i, /ignored.*tooth.*count/i], exclude: [/config/i, /limit/i] },
  'trigger.primaryRiseCount': { id: 'trigger.primaryRiseCount', displayName: 'Primary Rise Count', aliases: ['triggerPrimaryRise', 'Primary Trigger Rise Count'], include: [/trigger.*primary.*rise/i], exclude: [/pin/i, /mode/i, /config/i] },
  'trigger.primaryFallCount': { id: 'trigger.primaryFallCount', displayName: 'Primary Fall Count', aliases: ['triggerPrimaryFall', 'Primary Trigger Fall Count'], include: [/trigger.*primary.*fall/i], exclude: [/pin/i, /mode/i, /config/i] },
  'trigger.camRiseCount': { id: 'trigger.camRiseCount', displayName: 'Cam Rise Count', aliases: ['vvtEventRiseCounter1', 'triggerVvtRise', 'Cam Rise Count'], include: [/(?:vvt|cam).*rise.*(?:count|counter)/i], exclude: [/config/i] },
  'trigger.camFallCount': { id: 'trigger.camFallCount', displayName: 'Cam Fall Count', aliases: ['vvtEventFallCounter1', 'triggerVvtFall', 'Cam Fall Count'], include: [/(?:vvt|cam).*fall.*(?:count|counter)/i], exclude: [/config/i] },
};"""
assert old in s
p.write_text(s.replace(old,new,1))

p=Path('apps/web/src/state/built-in-workspace-templates.ts'); s=p.read_text()
marker='export const STARTER_WORKSPACE_TEMPLATES: readonly StarterWorkspaceTemplate[] = Object.freeze(['
assert marker in s
defs="""export const EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-dual-chamber-boost-dual', name: 'EpicEFI · Dual Chamber Boost', description: 'EpicEFI upper/lower wastegate solenoid and boost-control diagnostics.', tier: 'epicefi',
  availability: { allOfRoleIds: ['boost.wastegateCommand', 'boost.lowerWastegateCommand', 'boost.openLoopPart', 'boost.closedLoopPart'] }, layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' }, { roleId: 'engine.map', requirement: 'required' }, { roleId: 'boost.target', requirement: 'preferred' }, { roleId: 'boost.wastegateCommand', requirement: 'required' }, { roleId: 'boost.lowerWastegateCommand', requirement: 'required' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'boost.openLoopPart', requirement: 'required' }, { roleId: 'boost.closedLoopPart', requirement: 'required' }, { roleId: 'boost.spooledLevel', requirement: 'optional' }, { roleId: 'boost.controlActive', requirement: 'optional' }, { roleId: 'boost.error', requirement: 'optional' },
    ] },
  ],
};

export const EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE: StarterWorkspaceTemplate = {
  id: 'epicefi-trigger-sync-detailed-dual', name: 'EpicEFI · Trigger + Sync Detailed', description: 'EpicEFI trigger edge, tooth-angle and cam-sync diagnostics.', tier: 'epicefi',
  availability: { allOfRoleIds: ['trigger.toothAngleError', 'trigger.primaryRiseCount', 'trigger.primaryFallCount', 'trigger.camRiseCount', 'trigger.camFallCount'] }, layout: 'dual',
  panes: [
    { id: 'pane-1', roles: [
      { roleId: 'engine.rpm', requirement: 'required' }, { roleId: 'trigger.syncState', requirement: 'required' }, { roleId: 'trigger.errorActive', requirement: 'preferred' }, { roleId: 'trigger.errorCount', requirement: 'preferred' }, { roleId: 'trigger.resyncCount', requirement: 'preferred' }, { roleId: 'trigger.phaseSynchronized', requirement: 'preferred' },
    ] },
    { id: 'pane-2', roles: [
      { roleId: 'trigger.enginePhase', requirement: 'preferred' }, { roleId: 'trigger.toothAngleError', requirement: 'required' }, { roleId: 'trigger.ignoredToothCount', requirement: 'optional' }, { roleId: 'trigger.primaryRiseCount', requirement: 'required' }, { roleId: 'trigger.primaryFallCount', requirement: 'required' }, { roleId: 'trigger.camRiseCount', requirement: 'required' }, { roleId: 'trigger.camFallCount', requirement: 'required' },
    ] },
  ],
};

"""
s=s.replace(marker,defs+marker,1)
old='  EPICEFI_ETB_CONTROL_DUAL_WORKSPACE,\n]);'
new='  EPICEFI_ETB_CONTROL_DUAL_WORKSPACE,\n  EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE,\n  EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE,\n]);'
assert old in s
p.write_text(s.replace(old,new,1))

p=Path('tests/web/built-in-workspace-templates.test.ts'); s=p.read_text()
old="      'EpicEFI · MAP Predict + Wall Wetting', 'EpicEFI · Fuel Rail Diagnostics', 'EpicEFI · ETB Control',\n"
new="      'EpicEFI · MAP Predict + Wall Wetting', 'EpicEFI · Fuel Rail Diagnostics', 'EpicEFI · ETB Control',\n      'EpicEFI · Dual Chamber Boost', 'EpicEFI · Trigger + Sync Detailed',\n"
assert old in s
p.write_text(s.replace(old,new,1))

Path('tests/web/epicefi-dual-wg-trigger-detail-starters.test.ts').write_text("""import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../../core/log-model/log-types';
import { EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE, EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE, resolveStarterWorkspaceTemplate, starterWorkspaceAvailable } from '../../apps/web/src/state/built-in-workspace-templates';
import { resolveSemanticChannelRole } from '../../apps/web/src/state/semantic-channel-roles';
const c=(id:string,displayName=id):ChannelDefinition=>({id:`ini:${id}`,sourceName:id,displayName,valueType:'number'});
const boost=[c('RPMValue','RPM'),c('MAPValue','MAP'),c('boostControlTarget','Boost: Target'),c('boostOutput','Boost: Output'),c('lwgDutyPct','Lower WG port output'),c('openLoopPart','Boost: Open loop'),c('boostControllerClosedLoopPart','Boost: Closed loop'),c('spooledLevel'),c('isBoostControlled'),c('boostStatus_error','Boost PID error')];
const trigger=[c('RPMValue','RPM'),c('triggerSyncState','Trigger sync state'),c('isTriggerError','Error: Trigger'),c('totalTriggerErrorCounter','Trigger Error Counter'),c('camResyncCounter','Resync counter'),c('m_hasSynchronizedPhase','Fully synchronized'),c('currentEngineDecodedPhase','Sync: Engine Phase'),c('triggerToothAngleError','Sync: trigger angle error'),c('triggerIgnoredToothCount'),c('triggerPrimaryRise'),c('triggerPrimaryFall'),c('vvtEventRiseCounter1','vvtEventRiseCounter 1'),c('vvtEventFallCounter1','vvtEventFallCounter 1')];
describe('EpicEFI dual chamber boost and detailed trigger starters',()=>{
  it('gates and resolves dual chamber boost from live upper/lower WG control telemetry',()=>{ expect(starterWorkspaceAvailable(EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE,boost)).toBe(true); expect(starterWorkspaceAvailable(EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE,boost.filter(x=>x.sourceName!=='lwgDutyPct'))).toBe(false); const r=resolveStarterWorkspaceTemplate(EPICEFI_DUAL_CHAMBER_BOOST_DUAL_WORKSPACE,boost); expect(r.panes[0]?.channelIds).toEqual(['ini:RPMValue','ini:MAPValue','ini:boostControlTarget','ini:boostOutput','ini:lwgDutyPct']); expect(r.panes[1]?.channelIds).toEqual(['ini:openLoopPart','ini:boostControllerClosedLoopPart','ini:spooledLevel','ini:isBoostControlled','ini:boostStatus_error']); });
  it('gates and resolves detailed trigger diagnostics from live edge/cam counters',()=>{ expect(starterWorkspaceAvailable(EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE,trigger)).toBe(true); expect(starterWorkspaceAvailable(EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE,trigger.filter(x=>x.sourceName!=='vvtEventFallCounter1'))).toBe(false); const r=resolveStarterWorkspaceTemplate(EPICEFI_TRIGGER_SYNC_DETAILED_DUAL_WORKSPACE,trigger); expect(r.unresolvedRequiredRoleIds).toEqual([]); expect(r.panes[1]?.channelIds).toEqual(['ini:currentEngineDecodedPhase','ini:triggerToothAngleError','ini:triggerIgnoredToothCount','ini:triggerPrimaryRise','ini:triggerPrimaryFall','ini:vvtEventRiseCounter1','ini:vvtEventFallCounter1']); });
  it('rejects configuration-only lookalikes',()=>{ expect(resolveSemanticChannelRole('boost.lowerWastegateCommand',[c('lowerWastegatePin','Lower WG Output (Advanced)'),c('lowerWgTableOpenLoop','Lower wastegate duty (open loop)')]).channel).toBeUndefined(); expect(resolveSemanticChannelRole('trigger.toothAngleError',[c('triggerToothAngleWindow','Tooth angle rejection window')]).channel).toBeUndefined(); });
});
""")
