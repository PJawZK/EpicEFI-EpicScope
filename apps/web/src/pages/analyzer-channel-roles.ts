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
  readonly include: readonly RegExp[];
  readonly exclude?: readonly RegExp[];
}

// Suggestions are deliberately best-effort only: the UI always leaves the mapping visible and user-overridable.
const RULES: Readonly<Record<string, RoleRule>> = {
  'idle:rpm': { include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },
  'idle:target': { include: [/idle.*target/i, /target.*idle/i, /idle.*rpm.*target/i] },
  'idle:valve': { include: [/idle.*(valve|iac).*duty/i, /(valve|iac).*idle.*duty/i, /dc.*idle.*valve/i] },
  'idle:bias': { include: [/idle.*bias/i, /dc.*bias/i] },
  'idle:feedForward': { include: [/feed.?forward/i, /idle.*\bff\b/i] },
  'idle:p': { include: [/idle.*p.*term/i, /pid.*p.*idle/i, /idle.*proportional/i] },
  'idle:i': { include: [/idle.*i.*term/i, /pid.*i.*idle/i, /idle.*integral/i] },
  'idle:d': { include: [/idle.*d.*term/i, /pid.*d.*idle/i, /idle.*derivative/i] },

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

  'fuel-injector:reference': { include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },
  'fuel-injector:fuelPressure': { include: [/fuel.*pressure/i, /rail.*pressure/i], exclude: [/diff/i, /differential/i] },
  'fuel-injector:railDiff': { include: [/rail.*diff/i, /fuel.*pressure.*diff/i, /differential.*pressure/i] },
  'fuel-injector:pw': { include: [/injector.*(pw|pulse)/i, /pulse.*width/i, /inj.*pw/i] },
  'fuel-injector:duty': { include: [/injector.*duty/i, /inj.*duty/i] },
  'fuel-injector:deadtime': { include: [/injector.*dead.*time/i, /inj.*dead.*time/i, /deadtime/i] },

  'trigger-sync:reference': { include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },
  'trigger-sync:syncState': { include: [/sync.*state/i, /engine.*sync/i, /(^|\b)synced(\b|$)/i] },
  'trigger-sync:triggerError': { include: [/trigger.*error/i, /trigger.*err/i] },
  'trigger-sync:lossCounter': { include: [/sync.*loss.*count/i, /lost.*sync.*count/i, /sync.*counter/i] },
  'trigger-sync:rpm': { include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },

  'boost:measured': { include: [/boost.*pressure/i, /^map(value)?$/i, /manifold.*pressure/i, /(^|\b)map(\b|$)/i], exclude: [/target/i] },
  'boost:target': { include: [/boost.*target/i, /target.*boost/i, /target.*pressure/i] },
  'boost:rpm': { include: [/^rpm(value)?$/i, /(^|\b)rpm(\b|$)/i] },
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
