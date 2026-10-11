import { describe, expect, it } from 'vitest';
import type { ChannelDefinition } from '../core/log-model/log-types';
import { suggestAnalyzerChannel } from '../apps/web/src/pages/analyzer-channel-roles';

function channel(sourceName: string, displayName = sourceName): ChannelDefinition {
  return {
    id: `ini:${sourceName}`,
    sourceName,
    displayName,
    valueType: 'number',
  };
}

describe('Idle analyzer canonical channel roles', () => {
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

  it('does not use VE as a fuel-command fallback', () => {
    const noPulseWidth = [channel('veValue', 'Fuel: VE'), channel('tunedVeValue', 'Fuel: Tuned VE')];
    expect(suggestAnalyzerChannel('fueling', 'fuelCommand', noPulseWidth)).toBeUndefined();
  });

  it('also prefers lambda for AE / MAP Predict mixture evidence', () => {
    expect(suggestAnalyzerChannel('ae-map', 'afr', channels)?.sourceName).toBe('lambdaValue');
  });
});
