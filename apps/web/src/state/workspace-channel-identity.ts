export interface NormalizeWorkspaceChannelIdsOptions {
  readonly knownChannelIds: ReadonlySet<string>;
  readonly aliases?: ReadonlyMap<string, string>;
  readonly iniCatalogActive: boolean;
  readonly limit: number;
}

function resolveKnownChannelId(
  channelId: string,
  knownChannelIds: ReadonlySet<string>,
): string {
  if (knownChannelIds.has(channelId)) return channelId;
  if (channelId.startsWith('ini:')) {
    const shimChannelId = channelId.slice(4);
    if (knownChannelIds.has(shimChannelId)) return shimChannelId;
  }
  return channelId;
}

export function normalizeWorkspaceChannelIds(
  channelIds: readonly string[],
  options: NormalizeWorkspaceChannelIdsOptions,
): string[] {
  const normalized: string[] = [];
  for (const channelId of channelIds) {
    let candidate = channelId;
    const alias = options.aliases?.get(candidate);
    if (
      alias
      && (options.knownChannelIds.has(alias) || !options.knownChannelIds.has(candidate))
    ) {
      candidate = alias;
    }

    candidate = resolveKnownChannelId(candidate, options.knownChannelIds);

    if (!normalized.includes(candidate)) normalized.push(candidate);
    if (normalized.length >= options.limit) break;
  }
  return normalized;
}

export function renderableWorkspaceChannelIds(
  channelIds: readonly string[],
  options: NormalizeWorkspaceChannelIdsOptions,
): string[] {
  return normalizeWorkspaceChannelIds(channelIds, options)
    .filter((channelId) =>
      !(
        options.iniCatalogActive
        && channelId.startsWith('mlg:')
        && !options.knownChannelIds.has(channelId)
      )
    )
    .slice(0, options.limit);
}
