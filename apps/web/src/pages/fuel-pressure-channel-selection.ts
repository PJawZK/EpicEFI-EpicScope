import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export type FuelPressureChannelRole = 'low-side' | 'high-side';

function normalizedIdentity(channel: ChannelDefinition): string {
  return `${channel.id} ${channel.sourceName} ${channel.displayName}`
    .replace(/[_:./\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function isRawElectricalPressure(identity: string): boolean {
  const compact = identity.replace(/\s+/g, '');
  return /raw.*fuel.*pressure|fuel.*pressure.*raw/i.test(identity)
    || /rawlowfuelpressure|rawhighfuelpressure/i.test(compact);
}

function isCelIdentity(identity: string): boolean {
  return /(?:^|\b)cel(?:\b|$)|check\s*engine/i.test(identity);
}

function exactIdentityScore(channel: ChannelDefinition, role: FuelPressureChannelRole): number | undefined {
  const identities = [channel.id, channel.sourceName, channel.displayName].map((value) => value.toLowerCase());
  const candidates = role === 'low-side'
    ? ['ini:fuelpressure_low', 'fuelpressure_low', 'ini:fuelpressurelow', 'fuelpressurelow']
    : ['ini:fuelpressure_high', 'fuelpressure_high', 'ini:fuelpressurehigh', 'fuelpressurehigh'];
  const index = candidates.findIndex((candidate) => identities.includes(candidate));
  return index >= 0 ? 2000 - index : undefined;
}

function scoreFuelPressureChannel(channel: ChannelDefinition, role: FuelPressureChannelRole): number {
  const identity = normalizedIdentity(channel);
  if (!identity || isRawElectricalPressure(identity) || isCelIdentity(identity)) return Number.NEGATIVE_INFINITY;
  if (/diff|delta|differential/.test(identity)) return Number.NEGATIVE_INFINITY;

  const exact = exactIdentityScore(channel, role);
  if (exact !== undefined) return exact;

  if (role === 'low-side' && /high.*fuel.*pressure|fuel.*pressure.*high|gdi|high.*rail.*pressure/.test(identity)) return Number.NEGATIVE_INFINITY;
  if (role === 'high-side' && /low.*fuel.*pressure|fuel.*pressure.*low/.test(identity)) return Number.NEGATIVE_INFINITY;

  let score = Number.NEGATIVE_INFINITY;
  if (role === 'low-side') {
    if (/fuel.*pressure.*low|low.*fuel.*pressure/.test(identity)) score = 300;
    else if (/fuel.*pressure|rail.*pressure/.test(identity)) score = 150;
  } else {
    if (/fuel.*pressure.*high|high.*fuel.*pressure/.test(identity)) score = 300;
    else if (/gdi.*(?:fuel|rail).*pressure|(?:fuel|rail).*pressure.*gdi|high.*rail.*pressure/.test(identity)) score = 260;
  }
  if (!Number.isFinite(score)) return score;

  const unit = channel.unit?.trim().toLowerCase();
  if (unit === 'kpa') score += 80;
  else if (unit) score += 5;
  if (channel.id.startsWith('ini:')) score += 1;
  return score;
}

export function isFuelPressureChannelEligible(role: FuelPressureChannelRole, channel: ChannelDefinition): boolean {
  return Number.isFinite(scoreFuelPressureChannel(channel, role));
}

export function suggestFuelPressureChannel(
  role: FuelPressureChannelRole,
  channels: readonly ChannelDefinition[],
): ChannelDefinition | undefined {
  let selected: ChannelDefinition | undefined;
  let selectedScore = Number.NEGATIVE_INFINITY;
  for (const channel of channels) {
    const score = scoreFuelPressureChannel(channel, role);
    if (score > selectedScore) {
      selected = channel;
      selectedScore = score;
    }
  }
  return Number.isFinite(selectedScore) ? selected : undefined;
}

export function isRawFuelPressureChannel(channel: ChannelDefinition): boolean {
  return isRawElectricalPressure(normalizedIdentity(channel));
}
