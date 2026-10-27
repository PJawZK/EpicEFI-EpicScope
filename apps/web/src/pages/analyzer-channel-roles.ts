import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export type AnalyzerRoleDomain =
  | 'idle'
  | 'ae-map'
  | 'fueling'
  | 'ignition'
  | 'fuel-injector'
  | 'trigger-sync'
  | 'boost';

export type VeActualMixtureScale = 'afr' | 'lambda';

interface RoleRule {
  readonly exact?: readonly string[];
  readonly include: readonly RegExp[];
  readonly exclude?: readonly RegExp[];
}

export { channelOptionLabel as analyzerChannelOptionLabel } from './channel-option-label';

interface ChannelRoleIdentity {
  readonly normalized: string;
  readonly exact: readonly string[];
  readonly source: string;
  readonly unit: string;
  readonly sameSourceAndDisplay: boolean;
}

// Catalog definitions are immutable. Replacement definitions get fresh entries, even when
// they reuse a channel ID; removed catalogs are not retained by this weak cache.
const roleIdentities = new WeakMap<ChannelDefinition, ChannelRoleIdentity>();

function channelRoleIdentity(channel: ChannelDefinition): ChannelRoleIdentity {
  let identity = roleIdentities.get(channel);
  if (!identity) {
    const source = channel.sourceName.toLowerCase();
    const display = channel.displayName.toLowerCase();
    identity = {
      normalized: `${channel.id} ${channel.sourceName} ${channel.displayName}`
        .replace(/[_:./\\-]+/g, ' ').replace(/\s+/g, ' ').trim(),
      exact: [channel.id.toLowerCase(), source, display],
      source: source.trim(),
      unit: channel.unit?.trim().toLowerCase() ?? '',
      sameSourceAndDisplay: source === display,
    };
    roleIdentities.set(channel, identity);
  }
  return identity;
}

const INVALID_ACTUAL_MIXTURE_IDENTITY = /(target|error|err|trim|correction|offset|delta|difference|diff|command|desired|setpoint|table|axis|bin)/i;

export function isVeActualMixtureChannelEligible(
  channel: ChannelDefinition,
  scale: VeActualMixtureScale,
): boolean {
  if (channel.valueType === 'bitfield') return false;
  const identity = channelRoleIdentity(channel).normalized;
  if (INVALID_ACTUAL_MIXTURE_IDENTITY.test(identity)) return false;

  const unit = channelRoleIdentity(channel).unit;
  if (unit === '%' || unit.includes('percent')) return false;

  const source = channelRoleIdentity(channel).source;
  if (scale === 'afr') {
    if (unit === 'afr') return true;
    if (['afrgasolinescale', 'afrvalue', 'realafrvalue', 'smoothedafrvalue'].includes(source)) return true;
    return /(^|\b)(afr|air\s*fuel)(\b|$)/i.test(identity) && !/lambda/i.test(identity);
  }

  if (unit === 'lambda') return true;
  if (['lambdavalue', 'reallambdavalue1', 'smoothedlambdavalue'].includes(source)) return true;
  return /(^|\b)lambda(\b|$)/i.test(identity) && unit !== 'afr';
}

function actualMixturePreference(channel: ChannelDefinition, scale: VeActualMixtureScale): number {
  if (!isVeActualMixtureChannelEligible(channel, scale)) return Number.NEGATIVE_INFINITY;
  const source = channelRoleIdentity(channel).source;
  const priorities = scale === 'afr'
    ? ['afrgasolinescale', 'afrvalue', 'realafrvalue', 'smoothedafrvalue']
    : ['lambdavalue', 'reallambdavalue1', 'smoothedlambdavalue', 'lambdavalue2', 'reallambdavalue2'];
  const exactIndex = priorities.indexOf(source);
  if (exactIndex >= 0) return 1000 - exactIndex * 20;

  let score = 100;
  if (channelRoleIdentity(channel).unit === scale) score += 100;
  if (channel.id.startsWith('ini:')) score += 5;
  if (/\b(actual|real|measured)\b/i.test(channelRoleIdentity(channel).normalized)) score += 10;
  if (/\b2\b|value2/i.test(channelRoleIdentity(channel).normalized)) score -= 25;
  return score;
}

export function preferredVeActualMixtureChannel(
  channels: readonly ChannelDefinition[],
  scale: VeActualMixtureScale,
): ChannelDefinition | undefined {
  let best: ChannelDefinition | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const channel of channels) {
    const score = actualMixturePreference(channel, scale);
    if (score > bestScore) {
      best = channel;
      bestScore = score;
    }
  }
  return Number.isFinite(bestScore) ? best : undefined;
}

/** Update only this owner's actual-mixture selector. Never dispatch a synthetic change. */
export function updateVeActualMixtureOptions(control: HTMLSelectElement, channels: readonly ChannelDefinition[], scale: VeActualMixtureScale): boolean {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));
  for (const option of control.options) {
    if (!option.value) continue;
    const channel = byId.get(option.value);
    const disabled = !channel || !isVeActualMixtureChannelEligible(channel, scale);
    if (option.disabled !== disabled) option.disabled = disabled;
  }
  const selected = byId.get(control.value);
  if (selected && isVeActualMixtureChannelEligible(selected, scale)) return false;
  const availableIds = new Set([...control.options].map((option) => option.value));
  const preferred = preferredVeActualMixtureChannel(channels.filter((channel) => availableIds.has(channel.id)), scale);
  const previous = control.value;
  control.value = preferred?.id ?? '';
  return control.value !== previous;
}

// Suggestions are deliberately best-effort only: the UI always leaves the mapping visible and user-overridable.
// Canonical runtime channels are preferred where EpicEFI has an established name; fuzzy matching is fallback only.
const RULES: Readonly<Record<string, RoleRule>> = {
  'idle:coolant': { exact: ['ini:coolant', 'coolant', 'CLT', 'Coolant temperature'], include: [/coolant/i, /^clt$/i], exclude: [/intake|aux|mcu|target|error|limit|correction/i] },
  'idle:pedal': { exact: ['ini:throttlePedalPosition', 'throttlePedalPosition', 'Accelerator pedal position'], include: [/pedal.*position/i, /accelerator.*pedal/i], exclude: [/brake|intent|target|adc|voltage|raw|switch|status|error|limit/i] },
  'idle:physicalTps': { exact: ['ini:TPSValue', 'TPSValue', 'TPS', 'Throttle position'], include: [/^tps(value)?$/i, /throttle.*position/i], exclude: [/pedal|intent|target|request|command|base|final|correction|idle|adc|voltage|raw|switch|status|error|limit/i] },
  'idle:rpm': { exact: ['ini:RPMValue', 'RPMValue', 'RPM', 'Engine RPM'], include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i], exclude: [/target|error|drop|delta|diag|limit/i] },
  'idle:target': { exact: ['ini:idleTarget', 'idleTarget', 'Idle: Target RPM'], include: [/idle.*target/i, /target.*idle/i, /idle.*rpm.*target/i], exclude: [/base|error|stepper|position/i] },

  // Outer idle RPM controller. These values decide the requested idle-air position.
  'idle:basePosition': { exact: ['ini:baseIdlePosition', 'baseIdlePosition', 'idle: base value'], include: [/base.*idle.*position/i, /idle.*base.*value/i] },
  'idle:closedLoop': { exact: ['ini:idleClosedLoop', 'idleClosedLoop', 'Closed loop'], include: [/idle.*closed.*loop/i], exclude: [/active/i, /state/i] },
  'idle:finalPosition': { exact: ['ini:currentIdlePosition', 'currentIdlePosition', 'Idle: Position'], include: [/current.*idle.*position/i, /idle.*final.*position/i] },
  'idle:p': { exact: ['ini:idleStatus_pTerm', 'idleStatus_pTerm'], include: [/idle.*p.*term/i, /pid.*p.*idle/i, /idle.*proportional/i], exclude: [/dc.*idle.*position/i] },
  'idle:i': { exact: ['ini:idleStatus_iTerm', 'idleStatus_iTerm'], include: [/idle.*i.*term/i, /pid.*i.*idle/i, /idle.*integral/i], exclude: [/dc.*idle.*position/i] },
  'idle:d': { exact: ['ini:idleStatus_dTerm', 'idleStatus_dTerm'], include: [/idle.*d.*term/i, /pid.*d.*idle/i, /idle.*derivative/i], exclude: [/dc.*idle.*position/i] },
  'idle:pidOutput': { exact: ['ini:idleStatus_output', 'idleStatus_output'], include: [/^idle.*pid.*output$/i, /^idleStatus_output$/i], exclude: [/dc|position|applied|closed.?loop/i] },

  // Feedback DC idle-valve position controller. The firmware evaluates dcIdleBias* at dcIdleTarget
  // and exposes that runtime bias/feed-forward value through etbFeedForward while in DC_IdleValve mode.
  'idle:dcTarget': { exact: ['ini:dcIdleTarget', 'dcIdleTarget'], include: [/dc.*idle.*target/i, /idle.*valve.*target/i] },
  'idle:dcPosition': { exact: ['ini:IdlePosition', 'IdlePosition', 'ini:idlePositionSensor', 'idlePositionSensor'], include: [/idle.*position/i, /dc.*idle.*position/i], exclude: [/target/i, /status/i, /term/i, /current|final|base|request|raw|stepper|closed.?loop/i] },
  'idle:dcBiasOutput': { exact: ['ini:etbFeedForward', 'etbFeedForward', 'ini:etb1etbFeedForward', 'etb1etbFeedForward'], include: [/etb.*feed.?forward/i, /dc.*idle.*bias/i, /idle.*bias.*(output|value)/i], exclude: [/curve/i, /table/i, /axis/i, /bin/i, /tune|active|failed|phase|score|result|progress|values/i] },
  'idle:dcP': { exact: ['ini:dcIdlePositionStatus_pTerm', 'dcIdlePositionStatus_pTerm'], include: [/dc.*idle.*position.*p.*term/i] },
  'idle:dcI': { exact: ['ini:dcIdlePositionStatus_iTerm', 'dcIdlePositionStatus_iTerm'], include: [/dc.*idle.*position.*i.*term/i] },
  'idle:dcD': { exact: ['ini:dcIdlePositionStatus_dTerm', 'dcIdlePositionStatus_dTerm'], include: [/dc.*idle.*position.*d.*term/i] },
  'idle:dcOutput': { exact: ['ini:dcIdleDutyCycle', 'dcIdleDutyCycle', 'DC idle valve H-bridge duty', 'ini:dcIdlePositionStatus_output', 'dcIdlePositionStatus_output'], include: [/dc.*idle.*duty/i, /dc.*idle.*position.*output/i] },

  // Generic IAC/stepper/solenoid evidence uses the outer controller's final requested position.
  'idle:valve': { exact: ['ini:currentIdlePosition', 'currentIdlePosition', 'Idle: Position'], include: [/idle.*(valve|iac).*duty/i, /(valve|iac).*idle.*duty/i, /current.*idle.*position/i] },

  'idle:etbTarget': { exact: ['ini:targetWithIdlePosition', 'targetWithIdlePosition'], include: [/etb.*target.*with.*idle/i, /idle.*etb.*target/i, /etb.*idle.*target/i, /idle.*throttle.*target/i] },
  'idle:etbPosition': { include: [/etb.*position/i, /electronic.*throttle.*position/i, /throttle.*position/i], exclude: [/target/i, /pedal/i] },
  'idle:etbContribution': { exact: ['ini:currentIdlePosition', 'currentIdlePosition', 'Idle: Position'], include: [/idle.*etb.*(output|contribution|correction)/i, /etb.*idle.*(output|contribution|correction)/i] },
  'idle:ignitionAdvance': { include: [/idle.*ignition.*advance/i, /idle.*spark.*advance/i, /ignition.*advance/i, /spark.*advance/i] },
  'idle:ignitionCorrection': { include: [/idle.*ignition.*(correction|trim|delta)/i, /idle.*spark.*(correction|trim|delta)/i] },

  'ae-map:tps': { include: [/^tps(value)?$/i, /throttle.*position/i, /(^|\b)tps(\b|$)/i] },
  'ae-map:map': { include: [/^map(value)?$/i, /manifold.*pressure/i, /(^|\b)map(\b|$)/i], exclude: [/predict/i, /estimate/i] },
  'ae-map:predictedMap': { include: [/map.*predict/i, /predict.*map/i, /map.*estimate/i, /estimate.*map/i] },
  'ae-map:afr': {
    exact: ['ini:lambdaValue', 'lambdaValue', 'ini:afrGasolineScale', 'afrGasolineScale', 'ini:AFRValue', 'AFRValue'],
    include: [/^lambda(value)?$/i, /(^|\b)lambda(\b|$)/i, /gas.*scale.*afr/i, /air.*fuel.*gas.*scale/i, /^afr(value)?$/i, /air.*fuel/i],
    exclude: [/target/i, /error/i, /lambda.*2/i, /afr.*2/i],
  },

  // EpicEFI/JZ works in lambda internally. Prefer the canonical lambda pair, then Gas Scale AFR,
  // then generic AFR only as a fallback for logs that do not expose lambda.
  'fueling:actual': {
    exact: ['ini:lambdaValue', 'lambdaValue', 'ini:afrGasolineScale', 'afrGasolineScale', 'ini:AFRValue', 'AFRValue'],
    include: [/^lambda(value)?$/i, /(^|\b)lambda(\b|$)/i, /gas.*scale.*afr/i, /air.*fuel.*gas.*scale/i, /^afr(value)?$/i, /actual.*afr/i, /air.*fuel/i],
    exclude: [/target/i, /error/i, /trim/i, /correction/i, /offset/i, /delta/i, /table/i, /axis/i, /bin/i, /lambda.*2/i, /afr.*2/i],
  },
  'fueling:target': {
    exact: ['ini:targetLambda', 'targetLambda', 'ini:targetAFR', 'targetAFR'],
    include: [/target.*lambda/i, /lambda.*target/i, /target.*afr/i, /afr.*target/i],
    exclude: [/table/i, /axis/i],
  },
  'fueling:ve': {
    exact: ['ini:veValue', 'veValue'],
    include: [/^ve(value)?$/i, /fuel.*ve/i, /(^|\b)ve(\b|$)/i],
    exclude: [/tuned/i, /table/i, /axis/i, /bin/i],
  },
  'fueling:fuelCommand': {
    exact: ['ini:actualLastInjection', 'actualLastInjection'],
    include: [/last.*inj.*pulse.*width/i, /injector.*(pw|pulse)/i, /pulse.*width/i, /inj.*pw/i, /fuel.*command/i, /commanded.*fuel/i],
    exclude: [/dead.*time/i, /duty/i, /target/i, /stage\s*2/i, /secondary/i],
  },
  'fueling:rpm': { exact: ['ini:RPMValue', 'RPMValue'], include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },
  'fueling:load': {
    exact: ['ini:veTableYAxis', 'veTableYAxis'],
    include: [/ve.*table.*y.*axis/i, /fuel.*load/i, /^map(value)?$/i, /manifold.*pressure/i, /engine.*load/i, /(^|\b)tps(\b|$)/i],
    exclude: [/predict/i, /estimate/i, /target/i, /idle/i],
  },
  'fueling:dfco': {
    exact: ['ini:dfcoActive', 'dfcoActive'],
    include: [/dfco.*active/i, /decel.*fuel.*cut/i],
  },
  'fueling:fuelCutReason': {
    exact: ['ini:fuelCutReason', 'fuelCutReason'],
    include: [/fuel.*cut.*(reason|code)/i, /(^|\b)fuelcutreason(\b|$)/i],
    exclude: [/blinker/i],
  },
  'fueling:aeActive': {
    exact: ['ini:isAboveAccelThreshold', 'isAboveAccelThreshold'],
    include: [/tps.*ae.*active/i, /accel.*enrich.*active/i, /above.*accel.*threshold/i],
  },
  'fueling:decelActive': {
    exact: ['ini:isBelowDecelThreshold', 'isBelowDecelThreshold'],
    include: [/tps.*decel.*active/i, /decel.*active/i, /below.*decel.*threshold/i],
  },
  'fueling:totalCorrection': {
    exact: ['ini:totalFuelCorrection', 'totalFuelCorrection'],
    include: [/total.*fuel.*correction/i],
  },
  'fueling:stft': {
    exact: ['ini:stftCorrection1', 'stftCorrection1'],
    include: [/stft.*bank.*1/i, /short.*term.*fuel.*trim.*bank.*1/i],
    exclude: [/input.*error/i, /state/i, /bank.*2/i],
  },
  'fueling:ltft': {
    exact: ['ini:ltftCorrection1', 'ltftCorrection1'],
    include: [/ltft.*bank.*1/i, /long.*term.*fuel.*trim.*bank.*1/i],
    exclude: [/total/i, /accum/i, /state/i, /bank.*2/i],
  },

  'ignition:advance': { include: [/ignition.*advance/i, /spark.*advance/i, /advance.*deg/i, /ign.*adv/i] },
  'ignition:retard': { include: [/ignition.*retard/i, /spark.*retard/i, /knock.*retard/i, /(^|\b)retard(\b|$)/i] },
  'ignition:knock': { include: [/knock/i], exclude: [/retard/i] },

  'fuel-injector:reference': { exact: ['ini:RPMValue', 'RPMValue'], include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },
  'fuel-injector:map': {
    exact: ['ini:MAPValue', 'MAPValue'],
    include: [/^map(value)?$/i, /manifold.*(?:absolute.*)?pressure/i, /(^|\b)map(\b|$)/i],
    exclude: [/predict/i, /estimate/i, /target/i, /diff/i, /differential/i],
  },
  // Port-injected / conventional systems use the low-side pressure channel. Keep GDI high-side
  // pressure and CEL/check-engine status channels out of this role instead of treating every
  // "fuel pressure" string as equivalent evidence.
  'fuel-injector:fuelPressure': {
    exact: ['ini:fuelPressure_low', 'fuelPressure_low', 'ini:fuelPressureLow', 'fuelPressureLow'],
    include: [/fuel.*pressure.*low/i, /low.*fuel.*pressure/i, /fuel.*pressure/i, /rail.*pressure/i],
    exclude: [/diff/i, /differential/i, /delta/i, /fuel.*pressure.*high/i, /high.*fuel.*pressure/i, /gdi/i, /(^|\b)cel(\b|$)/i, /check.*engine/i],
  },
  // High-side pressure is a separate GDI evidence domain. It is deliberately not a fallback for
  // the conventional low-side role above.
  'fuel-injector:fuelPressureHigh': {
    exact: ['ini:fuelPressure_high', 'fuelPressure_high', 'ini:fuelPressureHigh', 'fuelPressureHigh'],
    include: [/fuel.*pressure.*high/i, /high.*fuel.*pressure/i, /gdi.*(?:fuel|rail).*pressure/i, /(?:fuel|rail).*pressure.*gdi/i],
    exclude: [/diff/i, /differential/i, /delta/i, /(^|\b)cel(\b|$)/i, /check.*engine/i],
  },
  'fuel-injector:railDiff': {
    include: [/rail.*diff/i, /rail.*delta/i, /fuel.*pressure.*diff/i, /fuel.*pressure.*delta/i, /pressure.*delta/i, /differential.*pressure/i],
    exclude: [/manifold/i, /(^|\b)map(\b|$)/i, /(^|\b)cel(\b|$)/i, /check.*engine/i],
  },
  'fuel-injector:pw': { include: [/injector.*(pw|pulse)/i, /pulse.*width/i, /inj.*pw/i] },
  'fuel-injector:duty': { include: [/injector.*duty/i, /inj.*duty/i] },
  'fuel-injector:deadtime': { include: [/injector.*dead.*time/i, /inj.*dead.*time/i, /deadtime/i] },

  'trigger-sync:reference': { exact: ['ini:RPMValue', 'RPMValue'], include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },
  'trigger-sync:syncState': { include: [/sync.*state/i, /engine.*sync/i, /(^|\b)synced(\b|$)/i] },
  'trigger-sync:triggerError': { include: [/trigger.*error/i, /trigger.*err/i] },
  'trigger-sync:lossCounter': { include: [/sync.*loss.*count/i, /lost.*sync.*count/i, /sync.*counter/i] },
  'trigger-sync:rpm': { exact: ['ini:RPMValue', 'RPMValue'], include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },

  'boost:measured': { include: [/boost.*pressure/i, /^map(value)?$/i, /manifold.*pressure/i, /(^|\b)map(\b|$)/i], exclude: [/target/i] },
  'boost:target': { include: [/boost.*target/i, /target.*boost/i, /target.*pressure/i] },
  'boost:rpm': { exact: ['ini:RPMValue', 'RPMValue'], include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },
  'boost:upper': { include: [/upper.*(wastegate|wg).*duty/i, /boost.*open.*loop.*duty/i, /upper.*duty/i] },
  'boost:lower': { include: [/lower.*(wastegate|wg).*duty/i, /lower.*duty/i] },
};

function scoreChannel(channel: ChannelDefinition, rule: RoleRule): number {
  const metadata = channelRoleIdentity(channel);
  const exactIdentities = metadata.exact;
  const exactIndex = rule.exact?.findIndex((candidate) => exactIdentities.includes(candidate.toLowerCase())) ?? -1;
  if (exactIndex >= 0) return 1000 - exactIndex;

  const identity = channelRoleIdentity(channel).normalized;
  if (rule.exclude?.some((pattern) => pattern.test(identity))) return Number.NEGATIVE_INFINITY;
  let best = Number.NEGATIVE_INFINITY;
  rule.include.forEach((pattern, index) => {
    pattern.lastIndex = 0;
    if (pattern.test(identity)) best = Math.max(best, 100 - index * 12);
  });
  if (!Number.isFinite(best)) return best;
  if (metadata.sameSourceAndDisplay) best += 2;
  if (channel.id.startsWith('ini:')) best += 1;
  return best;
}

export function suggestAnalyzerChannel(
  domain: AnalyzerRoleDomain,
  role: string,
  channels: readonly ChannelDefinition[],
): ChannelDefinition | undefined {
  const rule = RULES[`${domain}:${role}`];
  if (!rule) return undefined;
  let selected: ChannelDefinition | undefined;
  let selectedScore = Number.NEGATIVE_INFINITY;
  for (const channel of channels) {
    const score = scoreChannel(channel, rule);
    if (score > selectedScore) {
      selected = channel;
      selectedScore = score;
    }
  }
  return Number.isFinite(selectedScore) ? selected : undefined;
}

/** Missing source units may use a verified canonical Idle role, never a fuzzy label or conflicting unit. */
export function idleRoleUnit(channel: ChannelDefinition, role: 'rpm' | 'target' | 'basePosition' | 'closedLoop' | 'finalPosition' | 'dcTarget' | 'dcPosition' | 'dcOutput'):
  { readonly unit: 'RPM' | '%'; readonly authority: 'source' | 'canonical-role' } | undefined {
  if (channel.valueType === 'bitfield') return undefined;
  const rpm = role === 'rpm' || role === 'target';
  const identity = channelRoleIdentity(channel);
  if (identity.unit) return (rpm ? ['rpm', 'rev/min'].includes(identity.unit) : ['%', 'percent'].includes(identity.unit))
    ? { unit: rpm ? 'RPM' : '%', authority: 'source' } : undefined;
  // A debug PID output with no engineering unit is not verified H-bridge duty.
  if(role==='dcOutput' && ['ini:dcIdlePositionStatus_output','dcIdlePositionStatus_output'].some(alias=>identity.exact.includes(alias.toLowerCase()))) return undefined;
  const exact = RULES[`idle:${role}`]?.exact;
  if (!exact?.some(alias => identity.exact.includes(alias.toLowerCase()))) return undefined;
  return { unit: rpm ? 'RPM' : '%', authority: 'canonical-role' };
}

/** A unitless canonical PID field is a raw number, never inferred position-percent authority. */
export function idlePidRoleUnit(channel: ChannelDefinition, role: 'p' | 'i' | 'd' | 'pidOutput'):
  { readonly unit: 'pp' | 'raw'; readonly authority: 'source' | 'unspecified' } | undefined {
  if (channel.valueType === 'bitfield') return undefined;
  const identity=channelRoleIdentity(channel);
  if (identity.unit) return ['%', 'percent', 'pp', 'percentage points'].includes(identity.unit) ? {unit:'pp',authority:'source'} : undefined;
  return RULES[`idle:${role}`]?.exact?.some(alias=>identity.exact.includes(alias.toLowerCase())) ? {unit:'raw',authority:'unspecified'} : undefined;
}

/** Inner position-loop effort is not valve travel or outer RPM correction. Generic
 * feed-forward retains unverified actuator assignment; missing units remain raw. */
export function idlePositionPidRoleUnit(channel: ChannelDefinition, role: 'dcBiasOutput'|'dcP'|'dcI'|'dcD'):
  {readonly unit:'%'|'pp'|'raw';readonly authority:'source'|'unspecified'}|undefined {
  if(channel.valueType==='bitfield')return undefined;
  const identity=channelRoleIdentity(channel);
  if(identity.unit)return ['%','percent'].includes(identity.unit)?{unit:'%',authority:'source'}:['pp','percentage points'].includes(identity.unit)?{unit:'pp',authority:'source'}:undefined;
  return RULES[`idle:${role}`]?.exact?.some(alias=>identity.exact.includes(alias.toLowerCase()))?{unit:'raw',authority:'unspecified'}:undefined;
}

/** Qualification requires declared engineering units and a matching signal identity. */
export function idleQualificationRoleUnit(channel: ChannelDefinition, role: 'coolant' | 'pedal' | 'physicalTps'):
  { readonly unit: '°C' | '°F' | '%' } | undefined {
  if (channel.valueType === 'bitfield') return undefined;
  const identity = channelRoleIdentity(channel), rule = RULES[`idle:${role}`]!;
  if (rule.exclude?.some(pattern => pattern.test(identity.normalized))) return undefined;
  if (!rule.exact?.some(alias => identity.exact.includes(alias.toLowerCase())) && !rule.include.some(pattern => pattern.test(identity.normalized))) return undefined;
  const unit = identity.unit.replace(/[°\s]/g, '');
  if (role === 'coolant') {
    if (['c','degc','celsius'].includes(unit)) return { unit: '°C' };
    if (['f','degf','fahrenheit'].includes(unit)) return { unit: '°F' };
    return undefined;
  }
  return ['%','percent'].includes(unit) ? { unit: '%' } : undefined;
}
