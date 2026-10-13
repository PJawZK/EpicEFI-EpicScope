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
  | 'startup.engineCycles'
  | 'electrical.sensorSupplyVoltage'
  | 'electrical.sensorSupplyFault'
  | 'electrical.alternatorDuty'
  | 'vehicle.gear'
  | 'vehicle.clutchState'
  | 'vehicle.brakeState'
  | 'vehicle.wheelSpeedFrontLeft'
  | 'vehicle.wheelSpeedFrontRight'
  | 'vehicle.wheelSpeedRearLeft'
  | 'vehicle.wheelSpeedRearRight'
  | 'vehicle.longitudinalAcceleration'
  | 'transient.predictedMap'
  | 'transient.mapPredictionActive'
  | 'transient.wallFuelAmount'
  | 'fuel.highPressure'
  | 'fuel.highPressureTarget'
  | 'fuel.hpfpActive'
  | 'fuel.hpfpValveState'
  | 'fuel.hpfpPControl'
  | 'fuel.hpfpIControl'
  | 'etb.pedalPosition'
  | 'etb.target'
  | 'etb.error'
  | 'etb.duty'
  | 'etb.feedForward'
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
  | 'trigger.camFallCount'
  | 'fuel.injectionTiming'
  | 'ignition.tableAdvance'
  | 'ignition.baseAdvance'
  | 'ignition.corrections'
  | 'protection.stopEngineCode'
  | 'protection.currentRevLimit'
  | 'protection.fuelCutReason'
  | 'protection.sparkCutReason'
  | 'protection.totalFuelCut'
  | 'protection.totalSparkCut'
  | 'protection.criticalError'
  | 'protection.warningActive'
  | 'vvt.primary.actual'
  | 'vvt.primary.target'
  | 'vvt.primary.output'
  | 'vvt.primary.error'
  | 'vvt.primary.pControl'
  | 'vvt.primary.iControl'
  | 'vvt.primary.dControl'
  | 'als.triggered'
  | 'als.conditionActive'
  | 'als.latchActive'
  | 'als.timedOut'
  | 'als.timeRemaining'
  | 'als.fuelCorrection'
  | 'als.timingCorrection'
  | 'als.sparkSkip'
  | 'als.etbAirAdd'
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
  | 'cooling.coolantPressure';

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
  'electrical.sensorSupplyVoltage': { id: 'electrical.sensorSupplyVoltage', displayName: 'Sensor Supply Voltage', aliases: ['rawSst1Volts', 'Sensor Supply Voltage', 'Sensor Supply 1', '5V Reference', 'Sensor 5V'], include: [/(?:sensor.*supply|5v.*reference|reference.*5v).*volt/i, /sensor.*supply/i], exclude: [/fault/i, /threshold/i, /minimum/i, /maximum/i, /config/i, /adc.*channel/i] },
  'electrical.sensorSupplyFault': { id: 'electrical.sensorSupplyFault', displayName: 'Sensor Supply Fault', aliases: ['sst1Fault', 'Sensor Supply Fault', 'SST1: Fault', '5V Reference Fault'], include: [/(?:sensor.*supply|sst|5v.*reference).*fault/i], exclude: [/threshold/i, /config/i] },
  'electrical.alternatorDuty': { id: 'electrical.alternatorDuty', displayName: 'Alternator Duty', aliases: ['alternatorDutyCycle', 'Alternator Duty', 'Alternator duty cycle'], include: [/alternator.*duty(?:.*cycle)?/i], exclude: [/adder/i, /target/i, /conditioned/i, /table/i, /config/i] },
  'vehicle.gear': { id: 'vehicle.gear', displayName: 'Gear', aliases: ['detectedGear', 'Detected Gear', 'Gear'], include: [/^(?:detected\s*)?gear$/i, /gear.*detected/i], exclude: [/target/i, /next/i, /ratio/i, /upshift/i, /downshift/i, /table/i, /config/i] },
  'vehicle.clutchState': { id: 'vehicle.clutchState', displayName: 'Clutch State', aliases: ['clutchDownState', 'Clutch State', 'Clutch Down', 'Clutch: down'], include: [/clutch.*(?:down|state|pedal)/i], exclude: [/up/i, /pressure/i, /target/i, /pin/i, /mode/i, /position/i] },
  'vehicle.brakeState': { id: 'vehicle.brakeState', displayName: 'Brake State', aliases: ['brakePedalState', 'Brake State', 'Brake Pedal State', 'Brake switch'], include: [/brake.*(?:pedal|switch|state)/i], exclude: [/pressure/i, /target/i, /pin/i, /mode/i, /trans/i] },
  'vehicle.wheelSpeedFrontLeft': { id: 'vehicle.wheelSpeedFrontLeft', displayName: 'Wheel Speed FL', aliases: ['vehicleSpeedKph1', 'Wheel Speed FL', 'Vehicle Speed Front Left'], include: [/(?:wheel|vehicle).*speed.*(?:front.*left|fl)/i], exclude: [/average/i, /reference/i, /target/i] },
  'vehicle.wheelSpeedFrontRight': { id: 'vehicle.wheelSpeedFrontRight', displayName: 'Wheel Speed FR', aliases: ['vehicleSpeedKph2', 'Wheel Speed FR', 'Vehicle Speed Front Right'], include: [/(?:wheel|vehicle).*speed.*(?:front.*right|fr)/i], exclude: [/average/i, /reference/i, /target/i] },
  'vehicle.wheelSpeedRearLeft': { id: 'vehicle.wheelSpeedRearLeft', displayName: 'Wheel Speed RL', aliases: ['vehicleSpeedKph3', 'Wheel Speed RL', 'Vehicle Speed Rear Left'], include: [/(?:wheel|vehicle).*speed.*(?:rear.*left|rl)/i], exclude: [/average/i, /reference/i, /target/i] },
  'vehicle.wheelSpeedRearRight': { id: 'vehicle.wheelSpeedRearRight', displayName: 'Wheel Speed RR', aliases: ['vehicleSpeedKph4', 'Wheel Speed RR', 'Vehicle Speed Rear Right'], include: [/(?:wheel|vehicle).*speed.*(?:rear.*right|rr)/i], exclude: [/average/i, /reference/i, /target/i] },
  'vehicle.longitudinalAcceleration': { id: 'vehicle.longitudinalAcceleration', displayName: 'Longitudinal Accel', aliases: ['accelerationLon', 'Accel: Longitudinal', 'Longitudinal Acceleration', 'Longitudinal Accel'], include: [/longitudinal.*(?:accel|acceleration)/i, /accel.*longitudinal/i], exclude: [/target/i, /limit/i] },
  'transient.predictedMap': { id: 'transient.predictedMap', displayName: 'Predicted MAP', aliases: ['fallbackMap', 'Predicted MAP', 'MAP Estimate', 'Estimated MAP'], include: [/fallback.*map/i, /predicted.*map/i, /estimated.*map/i], exclude: [/use.*(?:map.*estimate|estimate.*map)/i, /enable/i, /during.*transient/i, /blend/i, /table/i, /target/i, /error/i, /duration/i, /config/i, /raw/i] },
  'transient.mapPredictionActive': { id: 'transient.mapPredictionActive', displayName: 'MAP Prediction Active', aliases: ['isMapPredictionActive', 'MAP Prediction Active', 'Prediction Active'], include: [/map.*prediction.*active/i, /prediction.*active.*map/i], exclude: [/enable/i, /table/i, /config/i, /duration/i] },
  'transient.wallFuelAmount': { id: 'transient.wallFuelAmount', displayName: 'Wall Fuel Amount', aliases: ['wallFuelAmount', 'Fuel: wall amount', 'Wall Fuel Amount', 'Fuel on the wall'], include: [/wall.*fuel.*amount/i, /fuel.*wall.*amount/i, /^fuel on the wall$/i], exclude: [/correction/i, /tau/i, /beta/i, /table/i, /config/i] },
  'fuel.highPressure': { id: 'fuel.highPressure', displayName: 'High Fuel Pressure', aliases: ['highFuelPressure', 'Fuel pressure (high)', 'Fuel Pressure High', 'High Fuel Pressure'], include: [/(?:high.*fuel|fuel.*high).*pressure/i, /fuel.*pressure.*high/i], exclude: [/raw/i, /bank.*2/i, /high2/i, /target/i, /table/i, /config/i, /minimum/i, /maximum/i] },
  'fuel.highPressureTarget': { id: 'fuel.highPressureTarget', displayName: 'High Fuel Pressure Target', aliases: ['m_pressureTarget_kPa', 'GDI: target pressure', 'HPFP Pressure Target', 'Fuel Rail Pressure Target'], include: [/(?:gdi|hpfp|fuel|rail).*target.*pressure/i, /pressure.*target.*(?:fuel|rail|hpfp)/i], exclude: [/table/i, /config/i, /decay/i, /reference/i, /minimum/i, /maximum/i] },
  'fuel.hpfpActive': { id: 'fuel.hpfpActive', displayName: 'HPFP Active', aliases: ['isHpfpActive', 'GDI: HPFP Active', 'HPFP Active'], include: [/hpfp.*active/i], exclude: [/enable/i, /config/i, /table/i] },
  'fuel.hpfpValveState': { id: 'fuel.hpfpValveState', displayName: 'HPFP Valve State', aliases: ['HpfpValveState', 'GDI: HPFP Valve state', 'HPFP Valve State'], include: [/hpfp.*valve.*state/i], exclude: [/pin/i, /mode/i, /config/i, /table/i] },
  'fuel.hpfpPControl': { id: 'fuel.hpfpPControl', displayName: 'HPFP P Control', aliases: ['hpfp_p_control_percent', 'HPFP P Control', 'HPFP P Term'], include: [/hpfp.*(?:p.*control|p.*term)/i], exclude: [/pid.*factor/i, /config/i, /table/i] },
  'fuel.hpfpIControl': { id: 'fuel.hpfpIControl', displayName: 'HPFP I Control', aliases: ['hpfp_i_control_percent', 'HPFP I Control', 'HPFP I Term'], include: [/hpfp.*(?:i.*control|i.*term)/i], exclude: [/pid.*factor/i, /min/i, /max/i, /config/i, /table/i] },
  'etb.pedalPosition': { id: 'etb.pedalPosition', displayName: 'Pedal Position', aliases: ['throttlePedalPosition', 'Throttle pedal position', 'Accelerator Pedal', 'Pedal Position'], include: [/(?:throttle|accelerator).*pedal.*position/i, /^pedal.*position$/i], exclude: [/raw/i, /primary/i, /secondary/i, /target/i, /table/i, /config/i] },
  'etb.target': { id: 'etb.target', displayName: 'ETB Target', aliases: ['etb1m_adjustedTarget', 'ETB: position target', 'ETB 1 target', 'ETB Target'], include: [/etb.*(?:position.*)?target/i], exclude: [/table/i, /bias/i, /min/i, /max/i, /config/i, /target.*table/i] },
  'etb.error': { id: 'etb.error', displayName: 'ETB Error', aliases: ['etbStatus_error', 'ETB: position error', 'ETB 1 PID error', 'ETB Error'], include: [/etb.*(?:position.*|pid.*)?error/i], exclude: [/counter/i, /code/i, /timer/i, /threshold/i, /config/i] },
  'etb.duty': { id: 'etb.duty', displayName: 'ETB Duty', aliases: ['etb1DutyCycle', 'ETB: Duty', 'ETB 1 duty', 'ETB Duty'], include: [/etb.*(?:duty|duty.*cycle)/i], exclude: [/test/i, /bias/i, /table/i, /config/i] },
  'etb.feedForward': { id: 'etb.feedForward', displayName: 'ETB Feed Forward', aliases: ['etb1etbFeedForward', 'ETB Feed Forward', 'ETB Feedforward'], include: [/etb.*feed.*forward/i], exclude: [/table/i, /curve/i, /config/i] },
  'etb.jamDetected': { id: 'etb.jamDetected', displayName: 'ETB Jam Detected', aliases: ['etb1jamDetected', 'ETB Jam Detected', 'ETB control fault/jam'], include: [/etb.*jam.*(?:detected|fault)/i, /jam.*detected/i], exclude: [/enable/i, /threshold/i, /timeout/i, /config/i] },
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
  'fuel.injectionTiming': { id: 'fuel.injectionTiming', displayName: 'Injection Timing SOI', aliases: ['injectionOffset', 'Fuel: Injection timing SOI', 'Injection Timing SOI'], include: [/injection.*timing.*soi/i, /^injection.*offset$/i, /start.*of.*injection/i], exclude: [/mode/i, /table/i, /phase.*table/i, /assist/i, /start.*deg/i, /end.*deg/i, /axis/i, /config/i] },
  'ignition.tableAdvance': { id: 'ignition.tableAdvance', displayName: 'Raw Ignition Table Advance', aliases: ['ignitionTableAdvance', 'Ignition: Raw table advance', 'Raw Ignition Table Advance'], include: [/^ignition.*raw.*table.*advance$/i, /^ignitiontableadvance$/i], exclude: [/config/i, /axis/i, /bin/i] },
  'ignition.baseAdvance': { id: 'ignition.baseAdvance', displayName: 'Base Ignition Advance', aliases: ['baseIgnitionAdvance', 'Timing: base ignition', 'Base Ignition Advance'], include: [/^base.*ignition.*advance$/i, /^timing.*base.*ignition$/i], exclude: [/table/i, /config/i, /cranking/i] },
  'ignition.corrections': { id: 'ignition.corrections', displayName: 'Ignition Corrections', aliases: ['ignitionCorrections', 'ignitionAdvanceCorrections', 'Ignition: Corrections SUM', 'Ignition: Advance corrections'], include: [/ignition.*correction/i], exclude: [/table/i, /config/i, /limit/i, /individual/i] },
  'protection.stopEngineCode': { id: 'protection.stopEngineCode', displayName: 'Stop Engine Code', aliases: ['stopEngineCode', 'Stop Engine Code'], include: [/^stop.*engine.*code$/i], exclude: [/config/i, /enable/i] },
  'protection.currentRevLimit': { id: 'protection.currentRevLimit', displayName: 'Current Rev Limit', aliases: ['rev_limit', 'Current Rev Limit'], include: [/^current.*rev.*limit$/i], exclude: [/minimum/i, /maximum/i, /soft/i, /hard/i, /window/i, /table/i, /config/i, /adder/i] },
  'protection.fuelCutReason': { id: 'protection.fuelCutReason', displayName: 'Fuel Cut Reason', aliases: ['fuelCutReason', 'Fuel: Cut Code', 'Fuel Cut Reason'], include: [/^fuel.*cut.*(?:reason|code)$/i], exclude: [/blink/i, /enable/i, /config/i, /hard.*limit/i] },
  'protection.sparkCutReason': { id: 'protection.sparkCutReason', displayName: 'Spark Cut Reason', aliases: ['sparkCutReason', 'Ign: Cut Code', 'Spark Cut Reason'], include: [/(?:spark|ignition|ign).*cut.*(?:reason|code)/i], exclude: [/blink/i, /enable/i, /config/i, /hard.*limit/i] },
  'protection.totalFuelCut': { id: 'protection.totalFuelCut', displayName: 'Total Fuel Cut', aliases: ['totalFuelCut', 'Total Fuel Cut'], include: [/^total.*fuel.*cut$/i], exclude: [/config/i, /enable/i] },
  'protection.totalSparkCut': { id: 'protection.totalSparkCut', displayName: 'Total Spark Cut', aliases: ['totalSparkCut', 'Total Spark Cut'], include: [/^total.*spark.*cut$/i], exclude: [/config/i, /enable/i] },
  'protection.criticalError': { id: 'protection.criticalError', displayName: 'Critical Error', aliases: ['hasCriticalError', 'Error: Active', 'Critical Error'], include: [/critical.*error/i, /^error.*active$/i], exclude: [/code/i, /count/i, /config/i] },
  'protection.warningActive': { id: 'protection.warningActive', displayName: 'Warning Active', aliases: ['isWarnNow', 'Warning: Active', 'Warning Active'], include: [/warning.*active/i, /^is.*warn.*now$/i], exclude: [/counter/i, /code/i, /config/i] },
  'vvt.primary.actual': { id: 'vvt.primary.actual', displayName: 'VVT 1 Actual', aliases: ['vvtPositionB1I', 'VVT 1 in actual', 'VVT 1 Actual', 'Bank 1 Intake VVT Actual'], include: [/^vvt.*(?:1|bank\s*1).*intake.*actual$/i, /^vvt.*position.*b1i$/i], exclude: [/target/i, /table/i, /channel/i, /config/i] },
  'vvt.primary.target': { id: 'vvt.primary.target', displayName: 'VVT 1 Target', aliases: ['vvtTargets1', 'VVT 1 in target', 'VVT 1 Target', 'Bank 1 Intake VVT Target'], include: [/^vvt.*(?:target|targets).*1$/i, /^vvt.*(?:1|bank\s*1).*intake.*target$/i], exclude: [/table/i, /blend/i, /config/i] },
  'vvt.primary.output': { id: 'vvt.primary.output', displayName: 'VVT 1 Output', aliases: ['vvtStatus1_output', 'VVT 1 Output'], include: [/^vvt.*status.*1.*output$/i, /^vvt.*1.*output$/i], exclude: [/table/i, /pin/i, /channel/i, /config/i] },
  'vvt.primary.error': { id: 'vvt.primary.error', displayName: 'VVT 1 Error', aliases: ['vvtStatus1_error', 'VVT 1 Error'], include: [/^vvt.*status.*1.*error$/i, /^vvt.*1.*error$/i], exclude: [/counter/i, /code/i, /config/i] },
  'vvt.primary.pControl': { id: 'vvt.primary.pControl', displayName: 'VVT 1 P', aliases: ['vvtStatus1_pTerm', 'VVT 1 P Term'], include: [/^vvt.*status.*1.*p.*term$/i], exclude: [/config/i] },
  'vvt.primary.iControl': { id: 'vvt.primary.iControl', displayName: 'VVT 1 I', aliases: ['vvtStatus1_iTerm', 'VVT 1 I Term'], include: [/^vvt.*status.*1.*i.*term$/i], exclude: [/config/i] },
  'vvt.primary.dControl': { id: 'vvt.primary.dControl', displayName: 'VVT 1 D', aliases: ['vvtStatus1_dTerm', 'VVT 1 D Term'], include: [/^vvt.*status.*1.*d.*term$/i], exclude: [/config/i] },
  'als.triggered': { id: 'als.triggered', displayName: 'ALS Triggered', aliases: ['antilagTriggered', 'Antilag triggered', 'Anti-Lag Triggered'], include: [/anti.?lag.*triggered/i, /^antilag.*triggered$/i], exclude: [/enable/i, /button/i, /mode/i, /config/i] },
  'als.conditionActive': { id: 'als.conditionActive', displayName: 'ALS Condition Active', aliases: ['isAntilagCondition', 'ALS Condition Active', 'Anti-Lag Condition Active'], include: [/^is.*antilag.*condition$/i, /(?:als|anti.?lag).*condition.*active/i], exclude: [/min/i, /max/i, /switch/i, /timer/i, /start/i, /end/i, /enable/i, /config/i] },
  'als.latchActive': { id: 'als.latchActive', displayName: 'ALS Latch Active', aliases: ['ALSLatchActive', 'ALS Latch Active'], include: [/als.*latch.*active/i], exclude: [/enable/i, /config/i] },
  'als.timedOut': { id: 'als.timedOut', displayName: 'ALS Timed Out', aliases: ['ALSTimedOut', 'ALS Timed Out'], include: [/als.*timed.*out/i], exclude: [/duration/i, /timeout.*setting/i, /config/i] },
  'als.timeRemaining': { id: 'als.timeRemaining', displayName: 'ALS Time Remaining', aliases: ['ALSTimeRemaining', 'ALS Time Remaining'], include: [/als.*time.*remaining/i], exclude: [/duration/i, /maximum/i, /max/i, /minimum/i, /min/i, /config/i] },
  'als.fuelCorrection': { id: 'als.fuelCorrection', displayName: 'ALS Fuel Correction', aliases: ['fuelALSCorrection', 'ALS Fuel Correction'], include: [/(?:als|anti.?lag).*fuel.*correction/i, /fuel.*als.*correction/i], exclude: [/table/i, /adjustment/i, /bin/i, /axis/i, /config/i] },
  'als.timingCorrection': { id: 'als.timingCorrection', displayName: 'ALS Timing Correction', aliases: ['timingALSCorrection', 'ALS Timing Correction'], include: [/(?:als|anti.?lag).*timing.*correction/i, /timing.*als.*correction/i], exclude: [/table/i, /retard.*table/i, /bin/i, /axis/i, /config/i] },
  'als.sparkSkip': { id: 'als.sparkSkip', displayName: 'ALS Spark Skip', aliases: ['ALSHardSparkSkip', 'ALS Hard Spark Skip', 'ALS Spark Skip'], include: [/als.*(?:hard.*)?spark.*skip/i], exclude: [/table/i, /ratio/i, /setting/i, /bin/i, /axis/i, /config/i] },
  'als.etbAirAdd': { id: 'als.etbAirAdd', displayName: 'ALS ETB Air Add', aliases: ['alsEtbAddValue', 'ALS ETB Air Add'], include: [/als.*etb.*(?:air.*)?add.*value/i, /anti.?lag.*etb.*air.*add/i], exclude: [/table/i, /position/i, /setting/i, /bin/i, /axis/i, /config/i] },
  'launch.preLaunchActive': { id: 'launch.preLaunchActive', displayName: 'Pre-Launch Active', aliases: ['isPreLaunchCondition', 'Pre-Launch Active'], include: [/^is.*pre.*launch.*condition$/i, /^pre.*launch.*active$/i], exclude: [/enable/i, /window/i, /table/i, /config/i] },
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

  'cooling.coolantPressure': { id: 'cooling.coolantPressure', displayName: 'Coolant Pressure', aliases: ['coolantPressure', 'Coolant Pressure'], include: [/^coolant.*pressure$/i], exclude: [/raw/i, /minimum/i, /maximum/i, /limit/i, /sensor.*config/i] },

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
