import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export type AnalyzerRoleDomain =
  | 'idle'
  | 'ae-map'
  | 'fueling'
  | 'ignition'
  | 'fuel-injector'
  | 'trigger-sync'
  | 'boost';

interface RoleRule {
  readonly exact?: readonly string[];
  readonly include: readonly RegExp[];
  readonly exclude?: readonly RegExp[];
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
  'ae-map:afr': { include: [/^afr(value)?$/i, /air.*fuel/i, /lambda(value)?/i], exclude: [/target/i, /error/i] },

  'fueling:actual': { include: [/^afr(value)?$/i, /actual.*afr/i, /lambda(value)?/i], exclude: [/target/i, /error/i] },
  'fueling:target': { include: [/target.*afr/i, /afr.*target/i, /lambda.*target/i, /target.*lambda/i] },
  'fueling:ve': { include: [/^ve(value)?$/i, /(^|\b)ve(\b|$)/i, /fuel.*table.*value/i] },

  'ignition:advance': { include: [/ignition.*advance/i, /spark.*advance/i, /advance.*deg/i, /ign.*adv/i] },
  'ignition:retard': { include: [/ignition.*retard/i, /spark.*retard/i, /knock.*retard/i, /(^|\b)retard(\b|$)/i] },
  'ignition:knock': { include: [/knock/i], exclude: [/retard/i] },

  'fuel-injector:reference': { exact: ['ini:RPMValue', 'RPMValue'], include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },
  'fuel-injector:fuelPressure': { include: [/fuel.*pressure/i, /rail.*pressure/i], exclude: [/diff/i, /differential/i] },
  'fuel-injector:railDiff': { include: [/rail.*diff/i, /fuel.*pressure.*diff/i, /differential.*pressure/i] },
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

function normalizedIdentity(channel: ChannelDefinition): string {
  return `${channel.id} ${channel.sourceName} ${channel.displayName}`
    .replace(/[_:./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
