import { describe, expect, it } from 'vitest';

import type { ChannelDefinition } from '../../core/log-model/log-types';
import {
  resolveSemanticChannelRole,
  semanticChannelRole,
} from '../../apps/web/src/state/semantic-channel-roles';

function channel(id: string, sourceName = id, displayName = sourceName): ChannelDefinition {
  return {
    id,
    sourceName,
    displayName,
    valueType: 'number',
  };
}

describe('semantic channel roles', () => {
  it('keeps TPS as the EpicScope display name while accepting legacy TP', () => {
    expect(semanticChannelRole('engine.throttle.position').displayName).toBe('TPS');

    const result = resolveSemanticChannelRole('engine.throttle.position', [channel('TP')]);

    expect(result.channel?.id).toBe('TP');
    expect(result.source).toBe('exact-alias');
    expect(result.role.displayName).toBe('TPS');
  });

  it('prefers established EpicEFI runtime names over generic aliases', () => {
    const result = resolveSemanticChannelRole('engine.rpm', [
      channel('RPM'),
      channel('RPMValue'),
    ]);

    expect(result.channel?.id).toBe('RPMValue');
    expect(result.source).toBe('exact-alias');
  });

  it('resolves stable INI identities without changing their source identity', () => {
    const result = resolveSemanticChannelRole('engine.map', [
      channel('ini:MAPValue', 'MAPValue', 'MAP'),
    ]);

    expect(result.channel?.id).toBe('ini:MAPValue');
    expect(result.role.displayName).toBe('MAP');
  });

  it('uses an explicit user/schema override before automatic aliases', () => {
    const result = resolveSemanticChannelRole(
      'engine.throttle.position',
      [channel('TPSValue'), channel('customThrottle')],
      { overrides: new Map([['engine.throttle.position', 'customThrottle']]) },
    );

    expect(result.channel?.id).toBe('customThrottle');
    expect(result.source).toBe('override');
  });

  it('falls back conservatively to familiar cross-ECU names', () => {
    const result = resolveSemanticChannelRole('temperature.coolant', [
      channel('sensor-17', 'ECT', 'Engine coolant'),
    ]);

    expect(result.channel?.id).toBe('sensor-17');
    expect(result.source).toBe('exact-alias');
  });

  it('does not mistake MAP targets for measured MAP', () => {
    const result = resolveSemanticChannelRole('engine.map', [
      channel('boostTarget', 'Boost target', 'Manifold pressure target'),
    ]);

    expect(result.channel).toBeUndefined();
    expect(result.source).toBe('unresolved');
  });

  it('uses the EpicEFI intake and battery channels for the General overview', () => {
    expect(resolveSemanticChannelRole('temperature.intakeAir', [
      channel('intake', 'intake', 'Intake air temp'),
    ]).channel?.id).toBe('intake');

    expect(resolveSemanticChannelRole('electrical.batteryVoltage', [
      channel('VBatt', 'VBatt', 'Battery'),
    ]).channel?.id).toBe('VBatt');
  });

  it('uses measured lambda and corrected ignition advance rather than targets/base timing', () => {
    const lambda = resolveSemanticChannelRole('fuel.lambda', [
      channel('targetLambda', 'targetLambda', 'Fuel: target lambda'),
      channel('lambdaValue', 'lambdaValue', 'Lambda'),
    ]);
    expect(lambda.channel?.id).toBe('lambdaValue');

    const ignition = resolveSemanticChannelRole('ignition.advance', [
      channel('baseIgnitionAdvance', 'baseIgnitionAdvance', 'Timing: base ignition'),
      channel('correctedIgnitionAdvance', 'correctedIgnitionAdvance', 'Timing: ignition'),
    ]);
    expect(ignition.channel?.id).toBe('correctedIgnitionAdvance');
  });

  it('uses the same canonical idle target and air-command channels as the Idle analyzer', () => {
    const channels = [
      channel('idleTarget', 'idleTarget', 'Idle target'),
      channel('currentIdlePosition', 'currentIdlePosition', 'Idle final position'),
      channel('dcIdleTarget', 'dcIdleTarget', 'DC idle target'),
      channel('IdlePosition', 'IdlePosition', 'Idle valve position'),
    ];

    expect(resolveSemanticChannelRole('idle.target', channels).channel?.id).toBe('idleTarget');
    expect(resolveSemanticChannelRole('idle.airCommand', channels).channel?.id).toBe('currentIdlePosition');
  });

  it('resolves the generic boost roles to the EpicEFI runtime channels', () => {
    const channels = [
      channel('boostControlTarget', 'boostControlTarget', 'Boost: Target'),
      channel('boostOutput', 'boostOutput', 'Boost: Output'),
      channel('boostControllerClosedLoopPart', 'boostControllerClosedLoopPart', 'Boost: Closed loop'),
      channel('boostStatus_error', 'boostStatus_error', 'Boost PID error'),
      channel('emapKpa', 'emapKpa', 'EMAP'),
      channel('lwgDutyPct', 'lwgDutyPct', 'Lower WG port output'),
    ];

    expect(resolveSemanticChannelRole('boost.target', channels).channel?.id).toBe('boostControlTarget');
    expect(resolveSemanticChannelRole('boost.wastegateCommand', channels).channel?.id).toBe('boostOutput');
    expect(resolveSemanticChannelRole('boost.error', channels).channel?.id).toBe('boostStatus_error');
    expect(resolveSemanticChannelRole('exhaust.emap', channels).channel?.id).toBe('emapKpa');
  });

  it('does not substitute PID contribution or lower-WG output for generic wastegate command', () => {
    expect(resolveSemanticChannelRole('boost.wastegateCommand', [
      channel('boostControllerClosedLoopPart', 'boostControllerClosedLoopPart', 'Boost: Closed loop'),
      channel('lwgDutyPct', 'lwgDutyPct', 'Lower WG port output'),
    ]).channel).toBeUndefined();
  });

  it('keeps generic idle roles separate from DC valve target/feedback detail', () => {
    expect(resolveSemanticChannelRole('idle.target', [
      channel('dcIdleTarget', 'dcIdleTarget', 'DC idle target'),
    ]).channel).toBeUndefined();

    expect(resolveSemanticChannelRole('idle.airCommand', [
      channel('IdlePosition', 'IdlePosition', 'Idle valve position'),
    ]).channel).toBeUndefined();
  });
});