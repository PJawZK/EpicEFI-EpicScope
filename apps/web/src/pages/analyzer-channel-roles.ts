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

let analyzerChannelCatalog: readonly ChannelDefinition[] = [];
let analyzerChannelDecorationQueued = false;
let analyzerChannelObserver: MutationObserver | undefined;

export function analyzerChannelOptionLabel(channel: ChannelDefinition): string {
  const name = channel.sourceName;
  const unit = channel.unit?.trim();
  return unit ? `${name} [${unit}]` : name;
}

function normalizedIdentity(channel: ChannelDefinition): string {
  return `${channel.id} ${channel.sourceName} ${channel.displayName}`
    .replace(/[_:./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const INVALID_ACTUAL_MIXTURE_IDENTITY = /(target|error|err|trim|correction|offset|delta|difference|diff|command|desired|setpoint|table|axis|bin)/i;

function sourceIdentity(channel: ChannelDefinition): string {
  return channel.sourceName.trim().toLowerCase();
}

function normalizedUnit(channel: ChannelDefinition): string {
  return channel.unit?.trim().toLowerCase() ?? '';
}

export function isVeActualMixtureChannelEligible(
  channel: ChannelDefinition,
  scale: VeActualMixtureScale,
): boolean {
  if (channel.valueType === 'bitfield') return false;
  const identity = normalizedIdentity(channel);
  if (INVALID_ACTUAL_MIXTURE_IDENTITY.test(identity)) return false;

  const unit = normalizedUnit(channel);
  if (unit === '%' || unit.includes('percent')) return false;

  const source = sourceIdentity(channel);
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
  const source = sourceIdentity(channel);
  const priorities = scale === 'afr'
    ? ['afrgasolinescale', 'afrvalue', 'realafrvalue', 'smoothedafrvalue']
    : ['lambdavalue', 'reallambdavalue1', 'smoothedlambdavalue', 'lambdavalue2', 'reallambdavalue2'];
  const exactIndex = priorities.indexOf(source);
  if (exactIndex >= 0) return 1000 - exactIndex * 20;

  let score = 100;
  if (normalizedUnit(channel) === scale) score += 100;
  if (channel.id.startsWith('ini:')) score += 5;
  if (/\b(actual|real|measured)\b/i.test(normalizedIdentity(channel))) score += 10;
  if (/\b2\b|value2/i.test(normalizedIdentity(channel))) score -= 25;
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

function enforceVeActualMixtureSelection(root: ParentNode, channels: readonly ChannelDefinition[]): void {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));
  for (const control of root.querySelectorAll<HTMLSelectElement>('.ve-analyzer-view select[data-role="actual"]')) {
    const view = control.closest<HTMLElement>('.ve-analyzer-view');
    const scaleControl = view?.querySelector<HTMLSelectElement>('select[data-role="mixture-scale"]');
    const scale = scaleControl?.value === 'lambda' ? 'lambda' : 'afr';

    for (const option of control.options) {
      if (!option.value) continue;
      const channel = byId.get(option.value);
      option.disabled = channel ? !isVeActualMixtureChannelEligible(channel, scale) : true;
    }

    const selected = byId.get(control.value);
    if (selected && isVeActualMixtureChannelEligible(selected, scale)) continue;
    // A hidden VE view may still own an older (or empty) catalog. Assigning a
    // channel absent from its options leaves value empty; dispatching change in
    // that case makes its table rebuild retrigger this decorator indefinitely.
    const availableIds = new Set([...control.options].map((option) => option.value));
    const preferred = preferredVeActualMixtureChannel(channels.filter((channel) => availableIds.has(channel.id)), scale);
    const next = preferred?.id ?? '';
    if (control.value === next) continue;
    const previous = control.value;
    control.value = next;
    if (control.value !== previous) control.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

export function decorateAnalyzerChannelOptions(root: ParentNode, channels: readonly ChannelDefinition[]): void {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));
  for (const option of root.querySelectorAll<HTMLOptionElement>('select option')) {
    const channel = byId.get(option.value);
    if (!channel) continue;
    const expected = analyzerChannelOptionLabel(channel);
    if (option.textContent !== expected) option.textContent = expected;
  }
  enforceVeActualMixtureSelection(root, channels);
}

function queueAnalyzerChannelDecoration(): void {
  if (analyzerChannelDecorationQueued || typeof document === 'undefined') return;
  analyzerChannelDecorationQueued = true;
  queueMicrotask(() => {
    analyzerChannelDecorationQueued = false;
    for (const root of document.querySelectorAll<HTMLElement>('.analyzer-page')) {
      decorateAnalyzerChannelOptions(root, analyzerChannelCatalog);
    }
  });
}

function registerAnalyzerChannelCatalog(channels: readonly ChannelDefinition[]): void {
  analyzerChannelCatalog = channels;
  if (typeof document === 'undefined') return;
  if (!analyzerChannelObserver && typeof MutationObserver !== 'undefined') {
    analyzerChannelObserver = new MutationObserver(() => { queueAnalyzerChannelDecoration(); });
    analyzerChannelObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
  queueAnalyzerChannelDecoration();
}

// Suggestions are deliberately best-effort only: the UI always leaves the mapping visible and user-overridable.
// Canonical runtime channels are preferred where EpicEFI has an established name; fuzzy matching is fallback only.
const RULES: Readonly<Record<string, RoleRule>> = {
  'idle:rpm': { exact: ['ini:RPMValue', 'RPMValue'], include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },
  'idle:target': { exact: ['ini:idleTarget', 'idleTarget'], include: [/idle.*target/i, /target.*idle/i, /idle.*rpm.*target/i] },

  // Outer idle RPM controller. These values decide the requested idle-air position.
  'idle:basePosition': { exact: ['ini:baseIdlePosition', 'baseIdlePosition'], include: [/base.*idle.*position/i, /idle.*base.*value/i] },
  'idle:closedLoop': { exact: ['ini:idleClosedLoop', 'idleClosedLoop'], include: [/idle.*closed.*loop/i], exclude: [/active/i, /state/i] },
  'idle:finalPosition': { exact: ['ini:currentIdlePosition', 'currentIdlePosition'], include: [/current.*idle.*position/i, /idle.*final.*position/i] },
  'idle:p': { exact: ['ini:idleStatus_pTerm', 'idleStatus_pTerm'], include: [/idle.*p.*term/i, /pid.*p.*idle/i, /idle.*proportional/i], exclude: [/dc.*idle.*position/i] },
  'idle:i': { exact: ['ini:idleStatus_iTerm', 'idleStatus_iTerm'], include: [/idle.*i.*term/i, /pid.*i.*idle/i, /idle.*integral/i], exclude: [/dc.*idle.*position/i] },
  'idle:d': { exact: ['ini:idleStatus_dTerm', 'idleStatus_dTerm'], include: [/idle.*d.*term/i, /pid.*d.*idle/i, /idle.*derivative/i], exclude: [/dc.*idle.*position/i] },

  // Feedback DC idle-valve position controller. The firmware evaluates dcIdleBias* at dcIdleTarget
  // and exposes that runtime bias/feed-forward value through etbFeedForward while in DC_IdleValve mode.
  'idle:dcTarget': { exact: ['ini:dcIdleTarget', 'dcIdleTarget'], include: [/dc.*idle.*target/i, /idle.*valve.*target/i] },
  'idle:dcPosition': { exact: ['ini:IdlePosition', 'IdlePosition'], include: [/idle.*position/i, /dc.*idle.*position/i], exclude: [/target/i, /status/i, /term/i] },
  'idle:dcBiasOutput': { exact: ['ini:etbFeedForward', 'etbFeedForward'], include: [/etb.*feed.?forward/i, /dc.*idle.*bias/i, /idle.*bias.*(output|value)/i], exclude: [/curve/i, /table/i, /axis/i, /bin/i] },
  'idle:dcP': { exact: ['ini:dcIdlePositionStatus_pTerm', 'dcIdlePositionStatus_pTerm'], include: [/dc.*idle.*position.*p.*term/i] },
  'idle:dcI': { exact: ['ini:dcIdlePositionStatus_iTerm', 'dcIdlePositionStatus_iTerm'], include: [/dc.*idle.*position.*i.*term/i] },
  'idle:dcD': { exact: ['ini:dcIdlePositionStatus_dTerm', 'dcIdlePositionStatus_dTerm'], include: [/dc.*idle.*position.*d.*term/i] },
  'idle:dcOutput': { exact: ['ini:dcIdlePositionStatus_output', 'dcIdlePositionStatus_output'], include: [/dc.*idle.*position.*output/i] },

  // Generic IAC/stepper/solenoid evidence uses the outer controller's final requested position.
  'idle:valve': { exact: ['ini:currentIdlePosition', 'currentIdlePosition'], include: [/idle.*(valve|iac).*duty/i, /(valve|iac).*idle.*duty/i, /current.*idle.*position/i] },

  'idle:etbTarget': { exact: ['ini:targetWithIdlePosition', 'targetWithIdlePosition'], include: [/etb.*target.*with.*idle/i, /idle.*etb.*target/i, /etb.*idle.*target/i, /idle.*throttle.*target/i] },
  'idle:etbPosition': { include: [/etb.*position/i, /electronic.*throttle.*position/i, /throttle.*position/i], exclude: [/target/i, /pedal/i] },
  'idle:etbContribution': { exact: ['ini:currentIdlePosition', 'currentIdlePosition'], include: [/idle.*etb.*(output|contribution|correction)/i, /etb.*idle.*(output|contribution|correction)/i] },
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
  const exactIdentities = [channel.id, channel.sourceName, channel.displayName].map((value) => value.toLowerCase());
  const exactIndex = rule.exact?.findIndex((candidate) => exactIdentities.includes(candidate.toLowerCase())) ?? -1;
  if (exactIndex >= 0) return 1000 - exactIndex;

  const identity = normalizedIdentity(channel);
  if (rule.exclude?.some((pattern) => pattern.test(identity))) return Number.NEGATIVE_INFINITY;
  let best = Number.NEGATIVE_INFINITY;
  rule.include.forEach((pattern, index) => {
    pattern.lastIndex = 0;
    if (pattern.test(identity)) best = Math.max(best, 100 - index * 12);
  });
  if (!Number.isFinite(best)) return best;
  const source = channel.sourceName.toLowerCase();
  const display = channel.displayName.toLowerCase();
  if (source === display) best += 2;
  if (channel.id.startsWith('ini:')) best += 1;
  return best;
}

export function suggestAnalyzerChannel(
  domain: AnalyzerRoleDomain,
  role: string,
  channels: readonly ChannelDefinition[],
): ChannelDefinition | undefined {
  registerAnalyzerChannelCatalog(channels);
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
