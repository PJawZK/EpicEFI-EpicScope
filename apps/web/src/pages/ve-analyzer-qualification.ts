import type { ChannelDefinition, NumericChannelRange } from '../../../../core/log-model/log-types';

export type VeCellChangeAuthority = 'responsive' | 'normal' | 'conservative' | 'very-conservative' | 'custom';

export interface VeQuickQualificationSettings {
  readonly cltChannelId?: string;
  readonly minimumClt?: number;
  readonly tpsChannelId?: string;
  readonly minimumTps?: number;
  readonly maximumTps?: number;
}

export const VE_CELL_CHANGE_PRIOR_WEIGHT: Readonly<Record<Exclude<VeCellChangeAuthority, 'custom'>, number>> = {
  responsive: 5,
  normal: 20,
  conservative: 50,
  'very-conservative': 100,
};

function normalized(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9%°]+/g, ' ') ?? '';
}

function temperatureUnit(unit: string | undefined): boolean {
  const text = normalized(unit);
  return /(^| )(deg ?c|°c|celsius|deg ?f|°f|fahrenheit|kelvin|k)( |$)/.test(` ${text} `);
}

function pressureSemantic(channel: ChannelDefinition): boolean {
  const identity = normalized(`${channel.sourceName} ${channel.displayName} ${channel.unit ?? ''}`);
  return /pressure|(^| )(kpa|bar|psi|mpa)( |$)/.test(identity);
}

function diagnosticSemantic(channel: ChannelDefinition): boolean {
  const source = normalized(channel.sourceName);
  const display = normalized(channel.displayName);
  // EpicEFI's `cel_*` channels describe Check Engine Light diagnostics/status,
  // not the physical sensor value named after the suffix. They must never be
  // offered as measured CLT sources even when `clt` appears in the name.
  return /(^| )cel( |$)/.test(source)
    || source.startsWith('cel ')
    || /check engine|checkengine|diagnostic|fault|warning/.test(`${source} ${display}`);
}

function scoreClt(channel: ChannelDefinition): number {
  if (pressureSemantic(channel) || diagnosticSemantic(channel)) return Number.NEGATIVE_INFINITY;
  const source = normalized(channel.sourceName);
  const display = normalized(channel.displayName);
  const tempUnit = temperatureUnit(channel.unit);
  const exactClt = /(^| )clt( |$)/.test(source);
  const coolantIdentity = /coolant/.test(source) || /coolant/.test(display);
  const temperatureIdentity = /temp|temperature/.test(source) || /temp|temperature/.test(display);

  // A generic coolant-labelled value is not enough: coolant pressure,
  // diagnostic/CEL channels and other coolant-system channels must never become
  // CLT candidates. Require canonical CLT identity or explicit temperature evidence.
  if (!exactClt && !(coolantIdentity && (temperatureIdentity || tempUnit))) return Number.NEGATIVE_INFINITY;

  let score = 0;
  if (exactClt) score += 140;
  if (/coolant/.test(source)) score += 95;
  if (/coolant/.test(display)) score += 35;
  if (temperatureIdentity) score += 45;
  if (tempUnit) score += 40;
  if (/target|threshold|limit|delta|rate/.test(source)) score -= 100;
  return score;
}

function scoreTps(channel: ChannelDefinition): number {
  const source = normalized(channel.sourceName);
  const display = normalized(channel.displayName);
  const unit = normalized(channel.unit);
  let score = 0;
  if (/(^| )tps( |$)/.test(source)) score += 120;
  if (/throttle.*position|position.*throttle/.test(source)) score += 100;
  if (/throttle.*position|position.*throttle/.test(display)) score += 35;
  if (unit.includes('%')) score += 15;
  if (/target|threshold|rate|delta|dot/.test(source)) score -= 80;
  return score;
}

export function veQualificationChannelCompatible(
  channel: ChannelDefinition,
  kind: 'clt' | 'tps',
): boolean {
  const score = kind === 'clt' ? scoreClt(channel) : scoreTps(channel);
  return Number.isFinite(score) && score > 0;
}

export function preferredVeQualificationChannel(
  channels: readonly ChannelDefinition[],
  kind: 'clt' | 'tps',
): ChannelDefinition | undefined {
  const scored = channels
    .map((channel) => ({ channel, score: kind === 'clt' ? scoreClt(channel) : scoreTps(channel) }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score > 0)
    .sort((left, right) => right.score - left.score);
  return scored[0]?.channel;
}

export function veCellChangeAuthorityForPrior(priorWeight: number): VeCellChangeAuthority {
  for (const [authority, weight] of Object.entries(VE_CELL_CHANGE_PRIOR_WEIGHT) as [Exclude<VeCellChangeAuthority, 'custom'>, number][]) {
    if (Math.abs(priorWeight - weight) < 1e-9) return authority;
  }
  return 'custom';
}

function valueAt(range: NumericChannelRange | undefined, sampleIndex: number): number | undefined {
  if (!range) return undefined;
  const local = sampleIndex - range.startSampleIndex;
  if (local < 0 || local >= range.values.length || local >= range.validity.length || range.validity[local] !== 1) return undefined;
  const value = range.values[local];
  return value !== undefined && Number.isFinite(value) ? value : undefined;
}

export function veQualificationSamplePasses(
  sampleIndex: number,
  settings: VeQuickQualificationSettings,
  cltRange?: NumericChannelRange,
  tpsRange?: NumericChannelRange,
): boolean {
  if (settings.minimumClt !== undefined) {
    const clt = valueAt(cltRange, sampleIndex);
    if (clt === undefined || clt < settings.minimumClt) return false;
  }
  if (settings.minimumTps !== undefined || settings.maximumTps !== undefined) {
    const tps = valueAt(tpsRange, sampleIndex);
    if (tps === undefined) return false;
    if (settings.minimumTps !== undefined && tps < settings.minimumTps) return false;
    if (settings.maximumTps !== undefined && tps > settings.maximumTps) return false;
  }
  return true;
}

export function applyVeQualificationValidity(
  range: NumericChannelRange,
  settings: VeQuickQualificationSettings,
  cltRange?: NumericChannelRange,
  tpsRange?: NumericChannelRange,
): NumericChannelRange {
  if (settings.minimumClt === undefined && settings.minimumTps === undefined && settings.maximumTps === undefined) return range;
  const validity = new Uint8Array(range.validity);
  for (let local = 0; local < validity.length; local += 1) {
    if (validity[local] !== 1) continue;
    const sampleIndex = range.startSampleIndex + local;
    if (!veQualificationSamplePasses(sampleIndex, settings, cltRange, tpsRange)) validity[local] = 0;
  }
  return { ...range, validity };
}
