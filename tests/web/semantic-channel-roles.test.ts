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

  it('resolves generic fuel roles to measured EpicEFI runtime channels', () => {
    const channels = [
      channel('lambdaValue', 'lambdaValue', 'Lambda'),
      channel('targetLambda', 'targetLambda', 'Fuel: target lambda'),
      channel('actualLastInjection', 'actualLastInjection', 'Fuel: Last inj pulse width'),
      channel('actualLastInjectionStage2', 'actualLastInjectionStage2', 'Fuel: Last inj pulse width stg 2'),
      channel('injectorDutyCycle', 'injectorDutyCycle', 'Fuel: injector duty cycle'),
      channel('maxInjectorDutyInstant', 'maxInjectorDutyInstant', 'Max injector duty'),
      channel('lowFuelPressure', 'lowFuelPressure', 'Fuel pressure'),
      channel('rawLowFuelPressure', 'rawLowFuelPressure', 'Raw Fuel Pressure'),
      channel('totalFuelCorrection', 'totalFuelCorrection', 'Fuel: Total correction'),
    ];

    expect(resolveSemanticChannelRole('fuel.lambdaTarget', channels).channel?.id).toBe('targetLambda');
    expect(resolveSemanticChannelRole('fuel.injectorPulseWidth', channels).channel?.id).toBe('actualLastInjection');
    expect(resolveSemanticChannelRole('fuel.injectorDuty', channels).channel?.id).toBe('injectorDutyCycle');
    expect(resolveSemanticChannelRole('fuel.pressure', channels).channel?.id).toBe('lowFuelPressure');
    expect(resolveSemanticChannelRole('fuel.totalCorrection', channels).channel?.id).toBe('totalFuelCorrection');
  });

  it('resolves ignition and cooling context without consuming configuration/raw channels', () => {
    const channels = [
      channel('sparkDwell', 'sparkDwell', 'Ignition: coil charge time'),
      channel('baseDwell', 'baseDwell', 'Ignition: base dwell'),
      channel('m_knockLevel', 'm_knockLevel', 'Knock: Current level'),
      channel('m_knockRetard', 'm_knockRetard', 'Knock retard'),
      channel('vehicleSpeedKph', 'vehicleSpeedKph', 'Vehicle speed'),
      channel('oilTemp', 'oilTemp', 'Oil Temp'),
      channel('rawOilTemperature', 'rawOilTemperature', 'Raw Oil Temperature'),
      channel('oilPressure', 'oilPressure', 'Oil Pressure'),
      channel('rawOilPressure', 'rawOilPressure', 'Raw Oil Pressure'),
      channel('fan1Pwm', 'fan1Pwm', 'fan1Pwm'),
      channel('fan1PwmFrequency', 'fan1PwmFrequency', 'Fan 1 PWM frequency'),
    ];

    expect(resolveSemanticChannelRole('ignition.dwell', channels).channel?.id).toBe('sparkDwell');
    expect(resolveSemanticChannelRole('ignition.knockLevel', channels).channel?.id).toBe('m_knockLevel');
    expect(resolveSemanticChannelRole('ignition.knockRetard', channels).channel?.id).toBe('m_knockRetard');
    expect(resolveSemanticChannelRole('vehicle.speed', channels).channel?.id).toBe('vehicleSpeedKph');
    expect(resolveSemanticChannelRole('temperature.oil', channels).channel?.id).toBe('oilTemp');
    expect(resolveSemanticChannelRole('engine.oilPressure', channels).channel?.id).toBe('oilPressure');
    expect(resolveSemanticChannelRole('cooling.fanCommand', channels).channel?.id).toBe('fan1Pwm');
  });

  it('resolves transient roles to live EpicEFI measurements rather than configuration channels', () => {
    const channels = [
      channel('deltaTps', 'deltaTps', 'AE: TPS change'),
      channel('deltaTpsAverageThreshold', 'deltaTpsAverageThreshold', 'AE: TPS dynamic threshold'),
      channel('effectiveMap', 'effectiveMap', 'Effective MAP'),
      channel('instantMAPValue', 'instantMAPValue', 'Instant MAP'),
      channel('fallbackMap', 'fallbackMap', 'fallbackMap'),
      channel('tpsAccelFuel', 'tpsAccelFuel', 'Fuel: TPS AE add fuel ms'),
      channel('tpsAccelAeEnabled', 'tpsAccelAeEnabled', 'Enable TPS Acceleration Enrichment'),
      channel('wallFuelCorrectionValue', 'wallFuelCorrectionValue', 'Fuel: wall correction'),
      channel('wallFuelCorrection', 'wallFuelCorrection', 'fuel wallwetting injection time'),
      channel('wallFuelAmount', 'wallFuelAmount', 'AE: wall amount'),
    ];

    expect(resolveSemanticChannelRole('transient.tpsDelta', channels).channel?.id).toBe('deltaTps');
    expect(resolveSemanticChannelRole('transient.effectiveMap', channels).channel?.id).toBe('effectiveMap');
    expect(resolveSemanticChannelRole('transient.instantMap', channels).channel?.id).toBe('instantMAPValue');
    expect(resolveSemanticChannelRole('transient.aeFuel', channels).channel?.id).toBe('tpsAccelFuel');
    expect(resolveSemanticChannelRole('transient.wallFuelCorrection', channels).channel?.id).toBe('wallFuelCorrectionValue');
  });

  it('resolves generic fuel-system pressure delta and pump state without raw/config aliases', () => {
    const channels = [
      channel('pressureDelta', 'pressureDelta', 'Fuel: Injector pressure delta'),
      channel('pressureCorrectionReference', 'pressureCorrectionReference', 'Fuel: corr reference pressure'),
      channel('isFuelPumpOn', 'isFuelPumpOn', 'isFuelPumpOn'),
      channel('fuelPumpForceState', 'fuelPumpForceState', 'fuelPumpForceState'),
      channel('tpsFuelPumpPrime', 'tpsFuelPumpPrime', 'tpsFuelPumpPrime'),
    ];

    expect(resolveSemanticChannelRole('fuel.pressureDelta', channels).channel?.id).toBe('pressureDelta');
    expect(resolveSemanticChannelRole('fuel.pumpCommand', channels).channel?.id).toBe('isFuelPumpOn');
  });

  it('keeps generic idle roles separate from DC valve target/feedback detail', () => {
    expect(resolveSemanticChannelRole('idle.target', [
      channel('dcIdleTarget', 'dcIdleTarget', 'DC idle target'),
    ]).channel).toBeUndefined();

    expect(resolveSemanticChannelRole('idle.airCommand', [
      channel('IdlePosition', 'IdlePosition', 'Idle valve position'),
    ]).channel).toBeUndefined();
  });

  it('resolves binary cooling fan activity independently from PWM fan command', () => {
    const channels = [
      channel('fan1m_state', 'fan1m_state', 'Fan 1 state'),
      channel('fan1Pwm', 'fan1Pwm', 'Fan 1 PWM'),
      channel('enableFan1', 'enableFan1', 'Enable Fan 1'),
    ];
    expect(resolveSemanticChannelRole('cooling.fanActive', channels).channel?.id).toBe('fan1m_state');
    expect(resolveSemanticChannelRole('cooling.fanCommand', channels).channel?.id).toBe('fan1Pwm');
  });

  it('prefers the wall-film mass correction over the separate wall-wetting injection-time channel', () => {
    const channels = [
      channel('instantMAPValue', 'instantMAPValue', 'Instant MAP'),
      channel('wallFuelCorrectionValue', 'wallFuelCorrectionValue', 'Fuel: wall correction'),
      channel('wallFuelCorrection', 'wallFuelCorrection', 'fuel wallwetting injection time'),
    ];
    expect(resolveSemanticChannelRole('transient.instantMap', channels).channel?.id).toBe('instantMAPValue');
    expect(resolveSemanticChannelRole('transient.wallFuelCorrection', channels).channel?.id).toBe('wallFuelCorrectionValue');
  });

});
