import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../core/log-model/log-types';
import { suggestAnalyzerChannel, idleRoleUnit, idlePidRoleUnit, idlePositionPidRoleUnit, idleIgnitionRoleUnit, preferredIdleIgnitionLambda } from '../apps/web/src/pages/analyzer-channel-roles';

function channel(sourceName: string, displayName = sourceName): ChannelDefinition {
  return {
    id: `ini:${sourceName}`,
    sourceName,
    displayName,
    valueType: 'number',
  };
}

describe('Idle analyzer canonical channel roles', () => {
  it('declares missing units only for canonical roles and refuses contradictory or fuzzy units', () => {
    expect(idleRoleUnit(channel('idleTarget'), 'target')).toEqual({ unit: 'RPM', authority: 'canonical-role' });
    expect(idleRoleUnit(channel('Idle: Target RPM'), 'target')?.authority).toBe('canonical-role');
    expect(idleRoleUnit(channel('baseIdlePosition'), 'basePosition')?.unit).toBe('%');
    expect(idleRoleUnit(channel('Closed loop'), 'closedLoop')?.unit).toBe('%');
    expect(idleRoleUnit(channel('Idle: Position'), 'finalPosition')?.unit).toBe('%');
    expect(idleRoleUnit(channel('strange idle target guess'), 'target')).toBeUndefined();
    expect(idleRoleUnit({ ...channel('idleTarget'), unit: 'kPa' }, 'target')).toBeUndefined();
    expect(idleRoleUnit({ ...channel('RPM'), unit: 'RPM' }, 'rpm')?.authority).toBe('source');
  });
  it('requires DC position/motor units and never auto-maps an idle request as measured feedback', () => {
    expect(idleRoleUnit(channel('dcIdleTarget'),'dcTarget')?.unit).toBe('%');
    expect(idleRoleUnit(channel('IdlePosition'),'dcPosition')?.authority).toBe('canonical-role');
    expect(idleRoleUnit(channel('dcIdlePositionStatus_output'),'dcOutput')).toBeUndefined();
    expect(idleRoleUnit(channel('dcIdleDutyCycle'),'dcOutput')?.unit).toBe('%');
    expect(idleRoleUnit({...channel('dcIdlePositionStatus_output'),unit:'%'},'dcOutput')?.authority).toBe('source');
    expect(idleRoleUnit({...channel('IdlePosition'),unit:'V'},'dcPosition')).toBeUndefined();
    expect(idleRoleUnit(channel('a fuzzy valve position'),'dcPosition')).toBeUndefined();
    const requests=['currentIdlePosition','baseIdlePosition','idleStepperTargetPosition','rawIdlePositionSensor'].map(name=>({...channel(name),unit:'%'}));
    expect(suggestAnalyzerChannel('idle','dcPosition',requests)).toBeUndefined();
    expect(suggestAnalyzerChannel('idle','dcPosition',[...requests,{...channel('idlePositionSensor'),unit:'%'}])?.sourceName).toBe('idlePositionSensor');
  });
  it('keeps unitless canonical outer PID fields raw and separates DC/applied output roles',()=>{
    expect(idlePidRoleUnit(channel('idleStatus_pTerm'),'p')).toEqual({unit:'raw',authority:'unspecified'});
    expect(idlePidRoleUnit({...channel('idleStatus_iTerm'),unit:'pp'},'i')).toEqual({unit:'pp',authority:'source'});
    expect(idlePidRoleUnit({...channel('idleStatus_dTerm'),unit:'V'},'d')).toBeUndefined();
    expect(idlePidRoleUnit(channel('fuzzy idle proportional'),'p')).toBeUndefined();
    expect(idlePidRoleUnit(channel('dcIdlePositionStatus_pTerm'),'p')).toBeUndefined();
    const candidates=[channel('dcIdlePositionStatus_output'),channel('idleClosedLoop'),channel('idleStatus_output')];
    expect(suggestAnalyzerChannel('idle','pidOutput',candidates)?.sourceName).toBe('idleStatus_output');
    expect(suggestAnalyzerChannel('idle','pidOutput',candidates.slice(0,2))).toBeUndefined();
    expect(suggestAnalyzerChannel('idle','pidOutput',[{...channel('idleDcPositionPidOutput'),unit:'%'}])).toBeUndefined();
  });
  it('keeps inner position effort units and shared feed-forward assignment explicit',()=>{
    expect(idlePositionPidRoleUnit(channel('dcIdlePositionStatus_iTerm'),'dcI')).toEqual({unit:'raw',authority:'unspecified'});
    expect(idlePositionPidRoleUnit({...channel('dcIdlePositionStatus_pTerm'),unit:'%'},'dcP')).toEqual({unit:'%',authority:'source'});
    expect(idlePositionPidRoleUnit({...channel('dcIdlePositionStatus_dTerm'),unit:'pp'},'dcD')?.unit).toBe('pp');
    expect(idlePositionPidRoleUnit(channel('idleStatus_iTerm'),'dcI')).toBeUndefined();
    expect(idlePositionPidRoleUnit({...channel('dcIdlePositionStatus_iTerm'),unit:'V'},'dcI')).toBeUndefined();
    expect(idlePositionPidRoleUnit(channel('etb1etbFeedForward'),'dcBiasOutput')).toEqual({unit:'raw',authority:'unspecified'});
    expect(idlePositionPidRoleUnit(channel('etb2etbFeedForward'),'dcBiasOutput')).toBeUndefined();
    expect(suggestAnalyzerChannel('idle','dcOutput',[channel('dcIdlePositionStatus_output'),channel('dcIdleDutyCycle')])?.sourceName).toBe('dcIdleDutyCycle');
    expect(suggestAnalyzerChannel('idle','dcBiasOutput',[channel('etbFeedForwardTuneProgress'),channel('dcIdleBiasValues')])).toBeUndefined();
  });
  it('identifies final advance and idle correction independently, with strict degree and actual-lambda authority',()=>{
    const channels=['baseIgnitionAdvance','ignitionAdvanceCorrections','ignitionAdvanceCyl1','correctedIgnitionAdvance','timingPidCorrection'].map(name=>({...channel(name),unit:'deg'}));
    expect(suggestAnalyzerChannel('idle','ignitionAdvance',channels)?.sourceName).toBe('correctedIgnitionAdvance');
    expect(suggestAnalyzerChannel('idle','ignitionAdvance',channels.slice(0,3))).toBeUndefined();
    expect(suggestAnalyzerChannel('idle','ignitionCorrection',channels)?.sourceName).toBe('timingPidCorrection');
    expect(suggestAnalyzerChannel('idle','ignitionCorrection',[channel('ignitionAdvanceCorrections'),channel('idleTimingPid_pFactor')])).toBeUndefined();
    expect(idleIgnitionRoleUnit(channel('correctedIgnitionAdvance'),'ignitionAdvance')).toEqual({unit:'°',authority:'canonical-role'});
    expect(idleIgnitionRoleUnit({...channel('timingPidCorrection'),unit:'ms'},'ignitionCorrection')).toBeUndefined();
    expect(idleIgnitionRoleUnit(channel('fuzzy spark advance'),'ignitionAdvance')).toBeUndefined();
    expect(idleIgnitionRoleUnit({...channel('targetLambda'),unit:'lambda'},'ignitionLambda')).toBeUndefined();
    expect(idleIgnitionRoleUnit({...channel('lambdaValue'),unit:'AFR'},'ignitionLambda')).toBeUndefined();
    const lambda={...channel('lambdaValue'),id:'mlg:1'},afr={...channel('afrGasolineScale'),unit:'AFR'},greek={...channel('Measured mixture'),unit:'λ'};
    expect(idleIgnitionRoleUnit(lambda,'ignitionLambda')).toEqual({unit:'λ',authority:'canonical-role'});
    expect(idleIgnitionRoleUnit(greek,'ignitionLambda')?.authority).toBe('source');
    expect(preferredIdleIgnitionLambda([afr,greek,lambda])).toBe(lambda);
    expect(preferredIdleIgnitionLambda([greek])).toBe(greek);
  });
  it('prefers recorded RPM/target labels over diagnostic drop, base and error channels', () => {
    const rpm = { ...channel('RPM'), id: 'mlg:33' };
    const target = { ...channel('Idle: Target RPM'), id: 'mlg:2273' };
    const candidates = [channel('IdleDiag Catch Drop RPM'), channel('Idle: Target RPM base'), channel('Idle: Target ERROR'), rpm, target];
    expect(suggestAnalyzerChannel('idle', 'rpm', candidates)).toBe(rpm);
    expect(suggestAnalyzerChannel('idle', 'target', candidates)).toBe(target);
    expect(suggestAnalyzerChannel('idle', 'rpm', candidates.slice(0, 3))).toBeUndefined();
  });
  const channels = [
    channel('idleStatus_pTerm', 'Idle: P Term'),
    channel('idleStatus_iTerm', 'Idle: I Term'),
    channel('idleStatus_dTerm', 'Idle: D Term'),
    channel('baseIdlePosition', 'idle: base value'),
    channel('idleClosedLoop', 'Closed loop'),
    channel('currentIdlePosition', 'Idle valve position'),
    channel('dcIdleTarget', 'DC idle target'),
    channel('IdlePosition', 'Idle position'),
    channel('etbFeedForward', 'ETB Feed Forward'),
    channel('dcIdlePositionStatus_pTerm', 'DC Idle Position: P Term'),
    channel('dcIdlePositionStatus_iTerm', 'DC Idle Position: I Term'),
    channel('dcIdlePositionStatus_dTerm', 'DC Idle Position: D Term'),
    channel('dcIdlePositionStatus_output', 'DC Idle Position: output'),
  ];

  it('never aliases the main idle P, I and D roles to one another', () => {
    expect(suggestAnalyzerChannel('idle', 'p', channels)?.sourceName).toBe('idleStatus_pTerm');
    expect(suggestAnalyzerChannel('idle', 'i', channels)?.sourceName).toBe('idleStatus_iTerm');
    expect(suggestAnalyzerChannel('idle', 'd', channels)?.sourceName).toBe('idleStatus_dTerm');
  });

  it('maps the outer idle controller positions to their canonical runtime channels', () => {
    expect(suggestAnalyzerChannel('idle', 'basePosition', channels)?.sourceName).toBe('baseIdlePosition');
    expect(suggestAnalyzerChannel('idle', 'closedLoop', channels)?.sourceName).toBe('idleClosedLoop');
    expect(suggestAnalyzerChannel('idle', 'finalPosition', channels)?.sourceName).toBe('currentIdlePosition');
  });

  it('maps DC idle bias to etbFeedForward and keeps the valve-position PID separate', () => {
    expect(suggestAnalyzerChannel('idle', 'dcTarget', channels)?.sourceName).toBe('dcIdleTarget');
    expect(suggestAnalyzerChannel('idle', 'dcPosition', channels)?.sourceName).toBe('IdlePosition');
    expect(suggestAnalyzerChannel('idle', 'dcBiasOutput', channels)?.sourceName).toBe('etbFeedForward');
    expect(suggestAnalyzerChannel('idle', 'dcP', channels)?.sourceName).toBe('dcIdlePositionStatus_pTerm');
    expect(suggestAnalyzerChannel('idle', 'dcI', channels)?.sourceName).toBe('dcIdlePositionStatus_iTerm');
    expect(suggestAnalyzerChannel('idle', 'dcD', channels)?.sourceName).toBe('dcIdlePositionStatus_dTerm');
    expect(suggestAnalyzerChannel('idle', 'dcOutput', channels)?.sourceName).toBe('dcIdlePositionStatus_output');
  });
});

describe('Fueling analyzer canonical channel roles', () => {
  const channels = [
    channel('AFRValue', 'Air/Fuel Ratio'),
    channel('afrGasolineScale', 'Air/Fuel Ratio (Gas Scale)'),
    channel('lambdaValue', 'Lambda'),
    channel('targetAFR', 'Fuel: target AFR'),
    channel('targetLambda', 'Fuel: target lambda'),
    channel('tunedVeValue', 'Fuel: Tuned VE'),
    channel('veValue', 'Fuel: VE'),
    channel('actualLastInjection', 'Fuel: Last inj pulse width'),
    channel('actualLastInjectionStage2', 'Fuel: Last inj pulse width stg 2'),
    channel('injectorDutyCycle', 'Fuel: injector duty cycle'),
    channel('MAPValue', 'MAP'),
    channel('TPSValue', 'TPS'),
    channel('fuelingLoad', 'Fuel: Load'),
    channel('veTableYAxis', 'veTableYAxis'),
    channel('RPMValue', 'RPM - engine speed'),
    channel('dfcoActive', 'dfcoActive'),
    channel('fuelCutReason', 'Fuel: Cut Code'),
    channel('fuelCutReasonBlinker', 'fuelCutReasonBlinker'),
    channel('isAboveAccelThreshold', 'Fuel: TPS AE Active'),
    channel('isBelowDecelThreshold', 'Fuel: TPS Decel Active'),
    channel('totalFuelCorrection', 'Fuel: Total correction'),
    channel('stftCorrection1', 'STFT: Bank 1'),
    channel('stftCorrection2', 'STFT: Bank 2'),
    channel('ltftCorrection1', 'LTFT: Bank 1'),
    channel('ltftCorrection2', 'LTFT: Bank 2'),
  ];

  it('prefers lambda and target lambda over AFR representations', () => {
    expect(suggestAnalyzerChannel('fueling', 'actual', channels)?.sourceName).toBe('lambdaValue');
    expect(suggestAnalyzerChannel('fueling', 'target', channels)?.sourceName).toBe('targetLambda');
  });

  it('falls back to Gas Scale AFR before generic AFR when lambda is unavailable', () => {
    const withoutLambda = channels.filter((entry) => entry.sourceName !== 'lambdaValue');
    expect(suggestAnalyzerChannel('fueling', 'actual', withoutLambda)?.sourceName).toBe('afrGasolineScale');
  });

  it('uses current VE, actual scheduled injector PW, and the actual VE-table load axis', () => {
    expect(suggestAnalyzerChannel('fueling', 've', channels)?.sourceName).toBe('veValue');
    expect(suggestAnalyzerChannel('fueling', 'fuelCommand', channels)?.sourceName).toBe('actualLastInjection');
    expect(suggestAnalyzerChannel('fueling', 'load', channels)?.sourceName).toBe('veTableYAxis');
    expect(suggestAnalyzerChannel('fueling', 'rpm', channels)?.sourceName).toBe('RPMValue');
  });

  it('maps cut/transient context and correction layers to the canonical JZ runtime channels', () => {
    expect(suggestAnalyzerChannel('fueling', 'dfco', channels)?.sourceName).toBe('dfcoActive');
    expect(suggestAnalyzerChannel('fueling', 'fuelCutReason', channels)?.sourceName).toBe('fuelCutReason');
    expect(suggestAnalyzerChannel('fueling', 'aeActive', channels)?.sourceName).toBe('isAboveAccelThreshold');
    expect(suggestAnalyzerChannel('fueling', 'decelActive', channels)?.sourceName).toBe('isBelowDecelThreshold');
    expect(suggestAnalyzerChannel('fueling', 'totalCorrection', channels)?.sourceName).toBe('totalFuelCorrection');
    expect(suggestAnalyzerChannel('fueling', 'stft', channels)?.sourceName).toBe('stftCorrection1');
    expect(suggestAnalyzerChannel('fueling', 'ltft', channels)?.sourceName).toBe('ltftCorrection1');
  });

  it('does not use VE as a fuel-command fallback', () => {
    const noPulseWidth = [channel('veValue', 'Fuel: VE'), channel('tunedVeValue', 'Fuel: Tuned VE')];
    expect(suggestAnalyzerChannel('fueling', 'fuelCommand', noPulseWidth)).toBeUndefined();
  });

  it('also prefers lambda for AE / MAP Predict mixture evidence', () => {
    expect(suggestAnalyzerChannel('ae-map', 'afr', channels)?.sourceName).toBe('lambdaValue');
  });
});

it('uses current catalog definitions when IDs are reused with different role metadata', () => {
  const first = Object.freeze({ ...channel('unusual'), displayName: 'engine RPM' });
  const replacement = Object.freeze({ ...first, displayName: 'ignition advance' });
  expect(suggestAnalyzerChannel('idle', 'rpm', [first])).toBe(first);
  expect(suggestAnalyzerChannel('ignition', 'advance', [first])).toBeUndefined();
  expect(suggestAnalyzerChannel('idle', 'rpm', [replacement])).toBeUndefined();
  expect(suggestAnalyzerChannel('ignition', 'advance', [replacement])).toBe(replacement);
  expect(suggestAnalyzerChannel('idle', 'rpm', [first])).toBe(first);
});
