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
