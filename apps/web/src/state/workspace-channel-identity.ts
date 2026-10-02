export interface NormalizeWorkspaceChannelIdsOptions {
  readonly knownChannelIds: ReadonlySet<string>;
  readonly aliases?: ReadonlyMap<string, string>;
  readonly iniCatalogActive: boolean;
  readonly limit: number;
}

export function normalizeWorkspaceChannelIds(
  channelIds: readonly string[],
  options: NormalizeWorkspaceChannelIdsOptions,
): string[] {
  const normalized: string[] = [];
  for (const channelId of channelIds) {
    let candidate = channelId;
    if (!options.knownChannelIds.has(candidate)) {
      const alias = options.aliases?.get(candidate);
      if (alias) candidate = alias;
    }

    if (
      options.iniCatalogActive
      && candidate.startsWith('mlg:')
      && !options.knownChannelIds.has(candidate)
    ) {
      continue;
    }

    if (!normalized.includes(candidate)) normalized.push(candidate);
    if (normalized.length >= options.limit) break;
  }
  return normalized;
}
