import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export type SemanticChannelRoleId =
  | 'engine.rpm'
  | 'engine.map'
  | 'engine.throttle.position'
  | 'temperature.coolant';

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
