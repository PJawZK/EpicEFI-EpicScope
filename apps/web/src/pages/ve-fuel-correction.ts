import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export type VeFuelCorrectionMode = 'auto' | 'off' | 'percent';

export interface VeFuelCorrectionAssessment {
  readonly applicable: boolean;
  readonly interpretation: 'percent-fuel-applied' | 'context-only';
  readonly reason: string;
}

function percentUnit(channel: ChannelDefinition | undefined): boolean {
  return channel?.unit?.trim() === '%';
}

export function isKnownPercentFuelCorrection(channel: ChannelDefinition | undefined): boolean {
  if (!channel || !percentUnit(channel)) return false;
  return /^(?:stftCorrection|ltftCorrection)\d*$/i.test(channel.sourceName.trim());
}

export function assessVeFuelCorrection(
  channel: ChannelDefinition | undefined,
  mode: VeFuelCorrectionMode,
): VeFuelCorrectionAssessment {
  if (mode === 'off') return { applicable: false, interpretation: 'context-only', reason: 'Disabled by user.' };
  if (!channel) return { applicable: false, interpretation: 'context-only', reason: 'No fuel-correction source selected.' };
  if (mode === 'percent') {
    return {
      applicable: true,
      interpretation: 'percent-fuel-applied',
      reason: 'User explicitly declared this source as percent fuel applied (+5 = +5% fuel).',
    };
  }
  if (isKnownPercentFuelCorrection(channel)) {
    return {
      applicable: true,
      interpretation: 'percent-fuel-applied',
      reason: `${channel.sourceName} [${channel.unit}] matches the known percent fuel-trim contract.`,
    };
  }
  return {
    applicable: false,
    interpretation: 'context-only',
    reason: 'Source semantics are not known to be percent fuel applied; no automatic compensation is performed.',
  };
}
