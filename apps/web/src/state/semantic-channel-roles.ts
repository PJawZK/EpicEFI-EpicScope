import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export type SemanticChannelRoleId =
  | 'engine.rpm'
  | 'engine.map'
  | 'engine.throttle.position'
  | 'temperature.coolant'
  | 'temperature.intakeAir'
  | 'electrical.batteryVoltage'
  | 'fuel.lambda'
  | 'ignition.advance'
  | 'idle.target'
  | 'idle.airCommand'
  | 'boost.target'
  | 'boost.wastegateCommand'
  | 'boost.error'
  | 'exhaust.emap'
  | 'fuel.lambdaTarget'
  | 'fuel.injectorPulseWidth'
  | 'fuel.injectorDuty'
  | 'fuel.pressure'
  | 'fuel.totalCorrection'
  | 'ignition.dwell'
  | 'ignition.knockLevel'
  | 'ignition.knockRetard'
  | 'vehicle.speed'
  | 'temperature.oil'
  | 'engine.oilPressure'
  | 'cooling.fanCommand'
  | 'transient.tpsDelta'
  | 'transient.effectiveMap'
  | 'transient.aeFuel'
  | 'transient.wallFuelCorrection'
  | 'fuel.pressureDelta'
  | 'fuel.pumpCommand'
  | 'trigger.syncState'
  | 'trigger.errorActive'
  | 'trigger.errorCount'
  | 'trigger.resyncCount'
  | 'trigger.phaseSynchronized'
  | 'trigger.enginePhase'
  | 'startup.crankingFuel'
  | 'startup.afterStartCorrection'
  | 'startup.warmupCorrection'
  | 'startup.engineCycles';

export interface SemanticChannelRoleDefinition {
  readonly id: SemanticChannelRoleId;
  /** Stable EpicScope-facing name. Source aliases never replace this label. */
  readonly displayName: string;
  /** Ordered aliases. Earlier entries are preferred when several channels match. */
  readonly aliases: readonly string[];
  /** Conservative fallback matching after exact aliases have failed. */
  readonly include: readonly RegExp[];
  readonly exclude?: readonly RegExp[];
}

export type SemanticChannelResolutionSource =
  | 'override'
  | 'exact-alias'
  | 'pattern'
  | 'unresolved';

export interface SemanticChannelResolution {
  readonly role: SemanticChannelRoleDefinition;
  readonly channel: ChannelDefinition | undefined;
  readonly source: SemanticChannelResolutionSource;
  readonly score: number | undefined;
}

export interface SemanticChannelResolveOptions {
  /** Explicit user/schema mappings always win over automatic resolution. */
  readonly overrides?: ReadonlyMap<SemanticChannelRoleId, string>;
}

const ROLES: Readonly<Record<SemanticChannelRoleId, SemanticChannelRoleDefinition>> = {
  'engine.rpm': {
    id: 'engine.rpm',
    displayName: 'RPM',
    aliases: ['RPMValue', 'RPM', 'Engine Speed', 'Engine RPM', 'RPM_ENGINE'],
    include: [/^rpm(?:\s*value)?$/i, /^engine\s+(?:speed|rpm)$/i, /\brpm\b/i],
  },
  'engine.map': {
    id: 'engine.map',
    displayName: 'MAP',
    aliases: [
      'MAPValue',
      'MAP',
      'Manifold Pressure',
      'Manifold Pres',
      'Manifold Air Pressure',
      'Intake Manifold Absolute Pressure',
    ],
    include: [/^map(?:\s*value)?$/i, /manifold.*(?:absolute )?pressure/i],
    exclude: [/target/i, /predict/i, /estimate/i, /error/i],
  },
  'engine.throttle.position': {
    id: 'engine.throttle.position',
    displayName: 'TPS',
    aliases: [
      'TPSValue',
      'TPS',
      'Throttle Position',
      'Throttle Position Sensor Percent',
      'Throttle Pos',
      // MLV and several legacy ECU families use TP. It is compatibility input only;
      // EpicScope deliberately keeps TPS as the user-facing name.
      'TP',
    ],
    include: [/^tps(?:\s*value)?$/i, /^tp$/i, /throttle.*position/i],
    exclude: [/target/i, /pedal/i, /rate/i, /delta/i],
  },
  'temperature.coolant': {
    id: 'temperature.coolant',
    displayName: 'Coolant Temp',
    aliases: ['coolant', 'CLT', 'ECT', 'Coolant Temp', 'Coolant Temperature', 'Engine Temp'],
    include: [/^clt$/i, /^ect$/i, /coolant.*temp/i, /engine.*temp/i],
    exclude: [/target/i, /warning/i, /limit/i],
  },
  'temperature.intakeAir': {
    id: 'temperature.intakeAir',
    displayName: 'Intake Air Temp',
    aliases: ['intake', 'IAT', 'MAT', 'Intake Air Temp', 'Intake Air Temperature', 'Manifold Air Temp'],
    include: [/^iat$/i, /^mat$/i, /intake.*air.*temp/i, /manifold.*air.*temp/i],
    exclude: [/target/i, /correction/i, /limit/i],
  },
  'electrical.batteryVoltage': {
    id: 'electrical.batteryVoltage',
    displayName: 'Battery Voltage',
    aliases: ['VBatt', 'Battery Voltage', 'Battery', 'Batt V', 'BattV', 'BatteryVoltage'],
    include: [/^vbatt$/i, /battery.*voltage/i, /^batt\s*v$/i],
    exclude: [/target/i, /minimum/i, /maximum/i, /limit/i],
  },
  'fuel.lambda': {
    id: 'fuel.lambda',
    displayName: 'Lambda',
    aliases: ['lambdaValue', 'Lambda', 'Lambda 1', 'Lambda1'],
    include: [/^lambda(?:\s*(?:value|1))?$/i],
    exclude: [/target/i, /error/i, /correction/i, /bank\s*2/i, /lambda\s*2/i],
  },
  'ignition.advance': {
    id: 'ignition.advance',
    displayName: 'Ignition Advance',
    aliases: [
      'correctedIgnitionAdvance',
      'Ignition Advance',
      'Spark Advance',
      'Timing Advance',
      'Ignition Timing',
      'SparkAdv',
    ],
    include: [/corrected.*ignition.*advance/i, /ignition.*advance/i, /spark.*advance/i, /timing.*advance/i],
    exclude: [/base/i, /target/i, /correction/i, /table/i, /retard/i],
  },
  'idle.target': {
    id: 'idle.target',
    displayName: 'Idle Target',
    aliases: [
      'idleTarget',
      'Idle Target',
      'Idle RPM Target',
      'Target Idle RPM',
      'Target Idle Speed',
    ],
    include: [/idle.*(?:rpm|speed)?.*target/i, /target.*idle.*(?:rpm|speed)?/i],
    exclude: [/position/i, /valve/i, /throttle/i, /etb/i, /dc.*idle/i],
  },
  'idle.airCommand': {
    id: 'idle.airCommand',
    displayName: 'Idle Air Command',
    aliases: [
      'currentIdlePosition',
      'Idle Air Command',
      'Idle Valve Duty',
      'IAC Duty',
      'Idle Position Command',
      'Idle Valve Command',
    ],
    include: [
      /current.*idle.*position/i,
      /idle.*(?:air|valve|iac).*(?:command|duty)/i,
      /(?:valve|iac).*idle.*(?:command|duty)/i,
    ],
    exclude: [/target/i, /actual/i, /feedback/i, /status/i, /term/i, /bias/i],
  },
  'boost.target': {
    id: 'boost.target',
    displayName: 'Boost Target',
    aliases: ['boostControlTarget', 'Boost Target', 'Boost: Target', 'Target Boost', 'Boost Pressure Target'],
    include: [/boost.*target/i, /target.*boost/i, /target.*(?:map|pressure)/i],
    exclude: [/cut/i, /limit/i, /adder/i, /mult/i],
  },
  'boost.wastegateCommand': {
    id: 'boost.wastegateCommand',
    displayName: 'Wastegate Command',
    aliases: ['boostOutput', 'Wastegate Command', 'Wastegate Duty', 'WG Duty', 'Boost Duty'],
    include: [/boost.*output/i, /wastegate.*(?:command|duty)/i, /(?:wg|boost).*duty/i],
    exclude: [/lower/i, /secondary/i, /pid/i, /closed.*loop/i, /open.*loop/i, /target/i],
  },
  'boost.error': {
    id: 'boost.error',
    displayName: 'Boost Error',
    aliases: ['boostStatus_error', 'Boost Error', 'Boost PID Error'],
    include: [/boost.*(?:pid.*)?error/i],
    exclude: [/wastegate.*dc/i, /position/i],
  },
  'exhaust.emap': {
    id: 'exhaust.emap',
    displayName: 'EMAP',
    aliases: ['emapKpa', 'EMAP', 'Exhaust Manifold Pressure', 'Exhaust MAP'],
    include: [/^emap(?:\s*kpa)?$/i, /exhaust.*(?:manifold.*)?pressure/i, /exhaust.*map/i],
    exclude: [/raw/i, /voltage/i, /sensor.*config/i],
  },
  'fuel.lambdaTarget': {
    id: 'fuel.lambdaTarget',
    displayName: 'Lambda Target',
    aliases: ['targetLambda', 'Lambda Target', 'Target Lambda', 'Fuel: target lambda'],
    include: [/target.*lambda/i, /lambda.*target/i],
    exclude: [/error/i, /correction/i, /table/i],
  },
  'fuel.injectorPulseWidth': {
    id: 'fuel.injectorPulseWidth',
    displayName: 'Injector Pulse Width',
    aliases: ['actualLastInjection', 'Injector Pulse Width', 'Injection Pulse Width', 'Fuel: Last inj pulse width', 'PW'],
    include: [/actual.*injection/i, /inject(?:or|ion).*pulse.*width/i, /\binj.*pw\b/i],
    exclude: [/stage\s*2/i, /secondary/i, /target/i, /limit/i, /pre.*small/i],
  },
  'fuel.injectorDuty': {
    id: 'fuel.injectorDuty',
    displayName: 'Injector Duty',
    aliases: ['injectorDutyCycle', 'Injector Duty', 'Injector Duty Cycle', 'Fuel: injector duty cycle'],
    include: [/injector.*duty(?:.*cycle)?/i],
    exclude: [/stage\s*2/i, /secondary/i, /max/i, /limit/i, /sustained/i],
  },
  'fuel.pressure': {
    id: 'fuel.pressure',
    displayName: 'Fuel Pressure',
    aliases: ['lowFuelPressure', 'Fuel Pressure', 'FuelPressureInjector', 'Fuel Pressure Low'],
    include: [/^(?:low\s*)?fuel.*pressure$/i, /fuel.*pressure/i],
    exclude: [/raw/i, /high/i, /target/i, /minimum/i, /maximum/i, /limit/i, /correction/i, /delta/i, /sensor.*config/i],
  },
  'fuel.totalCorrection': {
    id: 'fuel.totalCorrection',
    displayName: 'Fuel Correction',
    aliases: ['totalFuelCorrection', 'Fuel: Total correction', 'Total Fuel Correction', 'Fuel Correction'],
    include: [/total.*fuel.*correction/i, /fuel.*total.*correction/i],
    exclude: [/table/i, /target/i, /long.*term/i, /short.*term/i],
  },
  'ignition.dwell': {
    id: 'ignition.dwell',
    displayName: 'Dwell',
    aliases: ['sparkDwell', 'Dwell', 'Ignition: coil charge time', 'Coil Charge Time'],
    include: [/^spark.*dwell$/i, /^dwell$/i, /coil.*charge.*time/i],
    exclude: [/base/i, /clamp/i, /crank/i, /multispark/i, /table/i, /duration.*angle/i],
  },
  'ignition.knockLevel': {
    id: 'ignition.knockLevel',
    displayName: 'Knock Level',
    aliases: ['m_knockLevel', 'Knock Level', 'Knock: Current level'],
    include: [/knock.*(?:current.*)?level/i],
    exclude: [/threshold/i, /gain/i, /cyl/i, /retard/i],
  },
  'ignition.knockRetard': {
    id: 'ignition.knockRetard',
    displayName: 'Knock Retard',
    aliases: ['m_knockRetard', 'Knock Retard', 'Knock: Retard'],
    include: [/knock.*retard/i],
    exclude: [/max/i, /table/i, /limit/i],
  },
  'vehicle.speed': {
    id: 'vehicle.speed',
    displayName: 'Vehicle Speed',
    aliases: ['vehicleSpeedKph', 'Vehicle Speed', 'VSS', 'Road Speed', 'Speed'],
    include: [/^vehicle.*speed(?:.*kph)?$/i, /^vss$/i, /road.*speed/i],
    exclude: [/target/i, /limit/i, /wheel/i, /front/i, /rear/i, /trans/i],
  },
  'temperature.oil': {
    id: 'temperature.oil',
    displayName: 'Oil Temp',
    aliases: ['oilTemp', 'Oil Temp', 'Oil Temperature'],
    include: [/^oil.*temp(?:erature)?$/i],
    exclude: [/raw/i, /limit/i, /maximum/i, /sensor.*config/i],
  },
  'engine.oilPressure': {
    id: 'engine.oilPressure',
    displayName: 'Oil Pressure',
    aliases: ['oilPressure', 'Oil Pressure'],
    include: [/^oil.*pressure$/i],
    exclude: [/raw/i, /minimum/i, /maximum/i, /limit/i, /switch/i, /sensor.*config/i],
  },
  'cooling.fanCommand': {
    id: 'cooling.fanCommand',
    displayName: 'Fan Command',
    aliases: ['fan1Pwm', 'fan1m_state', 'Fan Command', 'Cooling Fan Duty', 'Radiator Fan Duty', 'Fan Duty'],
    include: [/fan.*(?:pwm|duty|command|state|on)/i],
    exclude: [/fan\s*2/i, /frequency/i, /min/i, /max/i, /threshold/i, /temperature/i, /button/i, /broken/i, /inhibit/i],
  },
  'transient.tpsDelta': {
    id: 'transient.tpsDelta',
    displayName: 'TPS Change',
    aliases: ['deltaTps', 'TPS Change', 'TPS Delta', 'dTPS', 'AE: TPS change'],
    include: [/^delta.*tps$/i, /^tps.*(?:change|delta|rate)$/i, /^dtps$/i],
    exclude: [/threshold/i, /average/i, /smoothed/i, /table/i, /bin/i],
  },
  'transient.effectiveMap': {
    id: 'transient.effectiveMap',
    displayName: 'Effective MAP',
    aliases: ['effectiveMap', 'Effective MAP', 'Predicted MAP'],
    include: [/^effective.*map$/i, /^predicted.*map$/i],
    exclude: [/fallback/i, /instant/i, /target/i, /table/i, /bin/i, /duration/i],
  },
  'transient.aeFuel': {
    id: 'transient.aeFuel',
    displayName: 'AE Fuel',
    aliases: ['tpsAccelFuel', 'AE Fuel', 'TPS AE Fuel', 'Acceleration Enrichment', 'Fuel: TPS AE add fuel ms'],
    include: [/tps.*(?:accel|ae).*fuel/i, /accel(?:eration)?.*enrich(?:ment)?/i],
    exclude: [/enable/i, /table/i, /curve/i, /threshold/i, /multiplier/i, /retard/i],
  },
  'transient.wallFuelCorrection': {
    id: 'transient.wallFuelCorrection',
    displayName: 'Wall Fuel Correction',
    aliases: ['wallFuelCorrection', 'Wall Fuel Correction', 'Wall Wetting Correction', 'AE: wall correction extra'],
    include: [/wall.*fuel.*correction/i, /wall.*wetting.*correction/i],
    exclude: [/value$/i, /table/i, /tau/i, /beta/i, /amount/i],
  },
  'fuel.pressureDelta': {
    id: 'fuel.pressureDelta',
    displayName: 'Fuel Pressure Delta',
    aliases: ['pressureDelta', 'Fuel Pressure Delta', 'Rail Differential Pressure', 'Injector Pressure Delta', 'Fuel: Injector pressure delta'],
    include: [/(?:fuel|rail|injector).*pressure.*(?:delta|differential)/i, /pressure.*delta/i],
    exclude: [/target/i, /reference/i, /ratio/i, /raw/i, /table/i, /minimum/i, /maximum/i],
  },
  'fuel.pumpCommand': {
    id: 'fuel.pumpCommand',
    displayName: 'Fuel Pump Command',
    aliases: ['isFuelPumpOn', 'Fuel Pump Command', 'Fuel Pump State', 'Fuel Pump On'],
    include: [/fuel.*pump.*(?:command|state|on)/i],
    exclude: [/prime/i, /force/i, /button/i, /duration/i, /threshold/i, /config/i, /pin/i],
  },
  'trigger.syncState': { id: 'trigger.syncState', displayName: 'Trigger Sync State', aliases: ['triggerSyncState', 'Trigger Sync State', 'Sync State', 'Engine Sync State'], include: [/trigger.*sync.*state/i, /engine.*sync.*state/i], exclude: [/config/i, /mode/i, /target/i, /threshold/i] },
  'trigger.errorActive': { id: 'trigger.errorActive', displayName: 'Trigger Error', aliases: ['isTriggerError', 'Trigger Error', 'Error: Trigger'], include: [/trigger.*error/i], exclude: [/count/i, /counter/i, /threshold/i, /code/i, /ordering/i] },
  'trigger.errorCount': { id: 'trigger.errorCount', displayName: 'Trigger Error Count', aliases: ['totalTriggerErrorCounter', 'Trigger Error Count', 'Trigger Errors'], include: [/trigger.*error.*(?:count|counter)/i], exclude: [/ordering/i, /recent/i, /code/i, /threshold/i] },
  'trigger.resyncCount': { id: 'trigger.resyncCount', displayName: 'Resync Count', aliases: ['camResyncCounter', 'Resync Count', 'Resync Counter', 'Cam Resync Count'], include: [/(?:cam.*)?resync.*(?:count|counter)/i], exclude: [/config/i, /threshold/i, /limit/i] },
  'trigger.phaseSynchronized': { id: 'trigger.phaseSynchronized', displayName: 'Phase Synchronized', aliases: ['m_hasSynchronizedPhase', 'Phase Synchronized', 'Fully Synchronized'], include: [/(?:phase.*synchron|fully.*synchron)/i], exclude: [/target/i, /config/i, /attempt/i] },
  'trigger.enginePhase': { id: 'trigger.enginePhase', displayName: 'Engine Phase', aliases: ['currentEngineDecodedPhase', 'Engine Phase', 'Decoded Engine Phase'], include: [/engine.*(?:decoded.*)?phase/i], exclude: [/target/i, /offset/i, /config/i, /attempt/i] },
  'startup.crankingFuel': { id: 'startup.crankingFuel', displayName: 'Cranking Fuel', aliases: ['crankingFuel_fuel', 'Cranking Fuel', 'Fuel: Cranking cycle mass', 'Fuel: cranking'], include: [/cranking.*fuel/i], exclude: [/base/i, /coefficient/i, /mult/i, /table/i, /curve/i, /config/i] },
  'startup.afterStartCorrection': { id: 'startup.afterStartCorrection', displayName: 'After-start Correction', aliases: ['running_postCrankingFuelCorrection', 'After-start Correction', 'Post Cranking Fuel Correction', 'Fuel: Post cranking mult'], include: [/(?:after.*start|post.*cranking).*?(?:fuel.*)?(?:correction|mult)/i], exclude: [/table/i, /curve/i, /target/i, /config/i] },
  'startup.warmupCorrection': { id: 'startup.warmupCorrection', displayName: 'Warmup Correction', aliases: ['running_coolantTemperatureCoefficient', 'Warmup Correction', 'CLT Fuel Correction', 'Fuel: CLT correction'], include: [/(?:warmup|coolant|clt).*(?:fuel.*)?(?:correction|coefficient|mult)/i], exclude: [/cranking/i, /table/i, /curve/i, /target/i, /config/i, /afr/i, /lambda/i] },
  'startup.engineCycles': { id: 'startup.engineCycles', displayName: 'Engine Cycles Since Start', aliases: ['revolutionCounterSinceStart', 'Engine Cycle Count', 'Engine Cycles Since Start'], include: [/(?:engine.*cycle|revolution).*since.*start/i, /engine.*cycle.*count/i], exclude: [/table/i, /bin/i, /target/i] },
};

export const semanticChannelRoles: readonly SemanticChannelRoleDefinition[] = Object.freeze(
  Object.values(ROLES),
);

export function semanticChannelRole(
  id: SemanticChannelRoleId,
): SemanticChannelRoleDefinition {
  return ROLES[id];
}

function normalizedText(value: string): string {
  return value
    .replace(/^ini:/i, '')
    .replace(/[_:./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function channelIdentities(channel: ChannelDefinition): readonly string[] {
  return [channel.id, channel.sourceName, channel.displayName].map(normalizedText);
}

function exactAliasScore(
  channel: ChannelDefinition,
  role: SemanticChannelRoleDefinition,
): number | undefined {
  const identities = channelIdentities(channel);
  for (let index = 0; index < role.aliases.length; index += 1) {
    const alias = role.aliases[index];
    if (alias !== undefined && identities.includes(normalizedText(alias))) {
      // Preserve alias preference while still slightly preferring canonical INI identities
      // when both source forms are otherwise equivalent.
      return 10_000 - index * 20 + (channel.id.startsWith('ini:') ? 1 : 0);
    }
  }
  return undefined;
}

function patternScore(
  channel: ChannelDefinition,
  role: SemanticChannelRoleDefinition,
): number | undefined {
  const identity = `${channel.id} ${channel.sourceName} ${channel.displayName}`
    .replace(/^ini:/i, '')
    .replace(/[_:./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (role.exclude?.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(identity);
  })) return undefined;

  let best: number | undefined;
  role.include.forEach((pattern, index) => {
    pattern.lastIndex = 0;
    if (pattern.test(identity)) best = Math.max(best ?? Number.NEGATIVE_INFINITY, 1_000 - index * 25);
  });
  if (best === undefined || !Number.isFinite(best)) return undefined;
  return best + (channel.id.startsWith('ini:') ? 1 : 0);
}

export function resolveSemanticChannelRole(
  id: SemanticChannelRoleId,
  channels: readonly ChannelDefinition[],
  options: SemanticChannelResolveOptions = {},
): SemanticChannelResolution {
  const role = semanticChannelRole(id);
  const overrideId = options.overrides?.get(id);
  if (overrideId) {
    const override = channels.find((channel) => channel.id === overrideId);
    if (override) return { role, channel: override, source: 'override', score: Number.POSITIVE_INFINITY };
  }

  let exactChannel: ChannelDefinition | undefined;
  let exactScore = Number.NEGATIVE_INFINITY;
  for (const channel of channels) {
    const score = exactAliasScore(channel, role);
    if (score !== undefined && score > exactScore) {
      exactChannel = channel;
      exactScore = score;
    }
  }
  if (exactChannel) return { role, channel: exactChannel, source: 'exact-alias', score: exactScore };

  let patternChannel: ChannelDefinition | undefined;
  let bestPatternScore = Number.NEGATIVE_INFINITY;
  for (const channel of channels) {
    const score = patternScore(channel, role);
    if (score !== undefined && score > bestPatternScore) {
      patternChannel = channel;
      bestPatternScore = score;
    }
  }
  if (patternChannel) {
    return { role, channel: patternChannel, source: 'pattern', score: bestPatternScore };
  }

  return { role, channel: undefined, source: 'unresolved', score: undefined };
}
