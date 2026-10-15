import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export function channelOptionLabel(channel: { readonly sourceName: string; readonly unit?: string | undefined }): string {
  const unit = channel.unit?.trim();
  return unit ? `${channel.sourceName} [${unit}]` : channel.sourceName;
}

/** Compare immutable channel metadata relevant to labels and role eligibility. */
export function sameChannelOptionCatalog(left: readonly ChannelDefinition[], right: readonly ChannelDefinition[]): boolean {
  return left.length === right.length && left.every((channel, index) => {
    const other = right[index]!;
    return channel.id === other.id && channel.sourceName === other.sourceName
      && channel.displayName === other.displayName && channel.unit === other.unit
      && channel.valueType === other.valueType && channel.category === other.category && channel.precision === other.precision;
  });
}
