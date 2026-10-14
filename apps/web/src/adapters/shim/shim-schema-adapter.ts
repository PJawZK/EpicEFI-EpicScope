import type { ChannelDefinition } from '../../../../../core/log-model/log-types';
import type { ShimSchema, ShimSchemaChannel } from './shim-protocol';

function firstDisplayHint(channel: ShimSchemaChannel) {
  return channel.displayHints?.[0];
}

function precision(channel: ShimSchemaChannel): number | undefined {
  const hint = firstDisplayHint(channel);
  return hint?.precision ?? hint?.labelPrecision;
}

function category(channel: ShimSchemaChannel): string | undefined {
  const hint = firstDisplayHint(channel);
  return hint?.category?.trim() || channel.category?.trim() || undefined;
}

export function shimChannelDefinition(channel: ShimSchemaChannel): ChannelDefinition {
  const unit = channel.unit.trim();
  const resolvedCategory = category(channel);
  const resolvedPrecision = precision(channel);

  return {
    // The shim channel id is already the matched-INI output-channel identity.
    // Keep source/display identity literal. EpicScope roles/categories may be
    // attached separately, but must not rename ECU/INI channels in presentation.
    id: channel.id,
    sourceName: channel.name,
    displayName: channel.name,
    valueType: 'number',
    ...(unit ? { unit } : {}),
    ...(resolvedCategory ? { category: resolvedCategory } : {}),
    ...(resolvedPrecision === undefined ? {} : { precision: resolvedPrecision }),
  };
}

export function shimSchemaChannelDefinitions(schema: ShimSchema): readonly ChannelDefinition[] {
  if (!schema.decodable) return [];
  return schema.channels.map(shimChannelDefinition);
}
