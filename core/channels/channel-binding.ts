import type {
  ChannelDefinition,
  NumericChannelBatchResult,
  NumericChannelDataSource,
  NumericChannelRange,
} from '../log-model/log-types';
import type {
  ChannelCatalog,
  ChannelCatalogEntry,
} from './channel-catalog';

export type ChannelBindingMethod =
  | 'logical-key'
  | 'display-name'
  | 'display-name-unit';

export interface BoundChannelBinding {
  readonly logicalChannelId: string;
  readonly logicalKey: string;
  readonly sourceChannelId: string;
  readonly method: ChannelBindingMethod;
}

export interface ChannelBindingMetrics {
  readonly catalogChannelCount: number;
  readonly logChannelCount: number;
  readonly mergedChannelCount: number;
  readonly boundChannelCount: number;
  readonly knownNoDataCount: number;
  readonly logOnlyCount: number;
  readonly matchedByLogicalKey: number;
  readonly matchedByDisplayName: number;
  readonly matchedByDisplayNameUnit: number;
  readonly ambiguousLogChannelCount: number;
}

export interface BoundChannelCatalog {
  readonly channels: readonly ChannelDefinition[];
  readonly dataSource: NumericChannelDataSource;
  readonly availableChannelIds: ReadonlySet<string>;
  readonly unavailableChannelIds: ReadonlySet<string>;
  readonly sourceToLogicalChannelId: ReadonlyMap<string, string>;
  readonly logicalToSourceChannelId: ReadonlyMap<string, string>;
  readonly workspaceChannelAliases: ReadonlyMap<string, string>;
  readonly bindings: readonly BoundChannelBinding[];
  readonly metrics: ChannelBindingMetrics;
}

function normalized(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function stableId(logicalKey: string): string {
  return `ini:${logicalKey}`;
}

function addIndex(
  index: Map<string, ChannelCatalogEntry[]>,
  key: string,
  entry: ChannelCatalogEntry,
): void {
  if (!key) return;
  const current = index.get(key);
  if (current) current.push(entry);
  else index.set(key, [entry]);
}

function chooseUnique(
  candidates: readonly ChannelCatalogEntry[] | undefined,
): ChannelCatalogEntry | undefined {
  return candidates?.length === 1 ? candidates[0] : undefined;
}

function chooseByUnit(
  candidates: readonly ChannelCatalogEntry[] | undefined,
  unit: string | undefined,
): ChannelCatalogEntry | undefined {
  if (!candidates || candidates.length < 2) return undefined;
  const normalizedUnit = normalized(unit);
  if (!normalizedUnit) return undefined;
  const matching = candidates.filter((candidate) => normalized(candidate.unit) === normalizedUnit);
  return matching.length === 1 ? matching[0] : undefined;
}

function chooseWorkspaceAliasTarget(
  candidates: readonly ChannelCatalogEntry[] | undefined,
  source: ChannelCatalogEntry,
): ChannelCatalogEntry | undefined {
  if (!candidates) return undefined;
  const sourceUnit = normalized(source.unit);
  const compatible = candidates.filter((candidate) => {
    if (candidate.logicalKey === source.logicalKey) return false;
    if (candidate.valueType !== source.valueType) return false;
    const candidateUnit = normalized(candidate.unit);
    return !sourceUnit || !candidateUnit || sourceUnit === candidateUnit;
  });
  return compatible.length === 1 ? compatible[0] : undefined;
}

export function bindChannelCatalogToLog(
  catalog: ChannelCatalog,
  logChannels: readonly ChannelDefinition[],
  sourceData: NumericChannelDataSource,
): BoundChannelCatalog {
  const keyIndex = new Map<string, ChannelCatalogEntry[]>();
  const displayIndex = new Map<string, ChannelCatalogEntry[]>();

  for (const entry of catalog.entries) {
    addIndex(keyIndex, normalized(entry.logicalKey), entry);
    addIndex(displayIndex, normalized(entry.displayName), entry);
  }

  const boundByLogicalKey = new Map<string, {
    logChannel: ChannelDefinition;
    method: ChannelBindingMethod;
  }>();
  const sourceToLogicalChannelId = new Map<string, string>();
  const logicalToSourceChannelId = new Map<string, string>();
  const bindings: BoundChannelBinding[] = [];
  const unmatchedLogChannels: ChannelDefinition[] = [];

  let matchedByLogicalKey = 0;
  let matchedByDisplayName = 0;
  let matchedByDisplayNameUnit = 0;
  let ambiguousLogChannelCount = 0;

  for (const logChannel of logChannels) {
    const sourceName = normalized(logChannel.sourceName);
    let entry = chooseUnique(keyIndex.get(sourceName));
    let method: ChannelBindingMethod | undefined;

    if (entry) {
      method = 'logical-key';
      matchedByLogicalKey += 1;
    } else {
      const displayCandidates = displayIndex.get(sourceName);
      entry = chooseUnique(displayCandidates);
      if (entry) {
        method = 'display-name';
        matchedByDisplayName += 1;
      } else {
        entry = chooseByUnit(displayCandidates, logChannel.unit);
        if (entry) {
          method = 'display-name-unit';
          matchedByDisplayNameUnit += 1;
        } else if (displayCandidates && displayCandidates.length > 1) {
          ambiguousLogChannelCount += 1;
        }
      }
    }

    if (!entry || !method || boundByLogicalKey.has(entry.logicalKey)) {
      unmatchedLogChannels.push(logChannel);
      continue;
    }

    const logicalChannelId = stableId(entry.logicalKey);
    boundByLogicalKey.set(entry.logicalKey, { logChannel, method });
    sourceToLogicalChannelId.set(logChannel.id, logicalChannelId);
    logicalToSourceChannelId.set(logicalChannelId, logChannel.id);
    bindings.push({
      logicalChannelId,
      logicalKey: entry.logicalKey,
      sourceChannelId: logChannel.id,
      method,
    });
  }

  const channels: ChannelDefinition[] = [];
  const availableChannelIds = new Set<string>();
  const unavailableChannelIds = new Set<string>();

  for (const entry of catalog.entries) {
    const logicalChannelId = stableId(entry.logicalKey);
    const bound = boundByLogicalKey.get(entry.logicalKey);

    if (bound) {
      const logChannel = bound.logChannel;
      channels.push({
        id: logicalChannelId,
        sourceName: entry.sourceName,
        displayName: entry.displayName,
        valueType: logChannel.valueType,
        ...(logChannel.unit || entry.unit ? { unit: logChannel.unit || entry.unit } : {}),
        ...(logChannel.category ? { category: logChannel.category } : {}),
        ...(logChannel.precision !== undefined || entry.precision !== undefined
          ? { precision: logChannel.precision ?? entry.precision }
          : {}),
      });
      availableChannelIds.add(logicalChannelId);
    } else {
      channels.push({
        id: logicalChannelId,
        sourceName: entry.sourceName,
        displayName: entry.displayName,
        valueType: entry.valueType,
        ...(entry.unit ? { unit: entry.unit } : {}),
        ...(entry.precision !== undefined ? { precision: entry.precision } : {}),
      });
      unavailableChannelIds.add(logicalChannelId);
    }
  }

  for (const logChannel of unmatchedLogChannels) {
    channels.push(logChannel);
    availableChannelIds.add(logChannel.id);
    sourceToLogicalChannelId.set(logChannel.id, logChannel.id);
    logicalToSourceChannelId.set(logChannel.id, logChannel.id);
  }

  // A reusable workspace may still contain an older INI identity that remains
  // valid in the catalog but has no data in this particular log. When exactly
  // one currently bound catalog entry has the same user-facing identity and a
  // compatible value type/unit, treat the unavailable identity as a safe alias.
  const boundDisplayIndex = new Map<string, ChannelCatalogEntry[]>();
  for (const entry of catalog.entries) {
    if (boundByLogicalKey.has(entry.logicalKey)) {
      addIndex(boundDisplayIndex, normalized(entry.displayName), entry);
    }
  }

  const workspaceChannelAliases = new Map(sourceToLogicalChannelId);
  for (const entry of catalog.entries) {
    if (boundByLogicalKey.has(entry.logicalKey)) continue;
    const target = chooseWorkspaceAliasTarget(
      boundDisplayIndex.get(normalized(entry.displayName)),
      entry,
    );
    if (target) {
      workspaceChannelAliases.set(stableId(entry.logicalKey), stableId(target.logicalKey));
    }
  }

  // Older browser workspaces used short user-facing channel names such as
  // `ini:rpm` or `ini:iat` rather than INI logical keys. Those IDs are not
  // catalog entries, so the stale-known migration above cannot see them.
  // Add a legacy shorthand alias only when the normalized display label maps
  // to exactly one currently bound INI channel and does not collide with a
  // real current INI logical key.
  for (const [displayIdentity, candidates] of boundDisplayIndex) {
    if (candidates.length != 1) continue;
    if (keyIndex.has(displayIdentity)) continue;
    const target = candidates[0];
    if (!target) continue;
    const legacyId = `ini:${displayIdentity}`;
    const targetId = stableId(target.logicalKey);
    if (legacyId !== targetId && !workspaceChannelAliases.has(legacyId)) {
      workspaceChannelAliases.set(legacyId, targetId);
    }
  }

  const dataSource = new BoundNumericChannelDataSource(sourceData, logicalToSourceChannelId);

  return {
    channels,
    dataSource,
    availableChannelIds,
    unavailableChannelIds,
    sourceToLogicalChannelId,
    logicalToSourceChannelId,
    workspaceChannelAliases,
    bindings,
    metrics: {
      catalogChannelCount: catalog.entries.length,
      logChannelCount: logChannels.length,
      mergedChannelCount: channels.length,
      boundChannelCount: bindings.length,
      knownNoDataCount: unavailableChannelIds.size,
      logOnlyCount: unmatchedLogChannels.length,
      matchedByLogicalKey,
      matchedByDisplayName,
      matchedByDisplayNameUnit,
      ambiguousLogChannelCount,
    },
  };
}

export class BoundNumericChannelDataSource implements NumericChannelDataSource {
  readonly sampleCount: number;
  readonly preferredBatchWindowMs?: number;
  readonly requiresExplicitBatchSelection?: boolean;

  public constructor(
    private readonly source: NumericChannelDataSource,
    private readonly sourceChannelIdByBoundId: ReadonlyMap<string, string>,
  ) {
    this.sampleCount = source.sampleCount;
    if (source.preferredBatchWindowMs !== undefined) {
      this.preferredBatchWindowMs = source.preferredBatchWindowMs;
    }
    if (source.requiresExplicitBatchSelection !== undefined) {
      this.requiresExplicitBatchSelection = source.requiresExplicitBatchSelection;
    }
  }

  private sourceId(channelId: string): string {
    const sourceId = this.sourceChannelIdByBoundId.get(channelId);
    if (!sourceId) {
      throw new RangeError(`Channel ${channelId} has no bound log data.`);
    }
    return sourceId;
  }

  hasCachedChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): boolean {
    if (!this.source.hasCachedChannelRange) return false;
    const sourceId = this.sourceChannelIdByBoundId.get(channelId);
    return sourceId
      ? this.source.hasCachedChannelRange(sourceId, startSampleIndex, sampleCount)
      : false;
  }

  async readChannelRange(
    channelId: string,
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelRange> {
    return this.source.readChannelRange(this.sourceId(channelId), startSampleIndex, sampleCount);
  }

  async readChannelsRange(
    channelIds: readonly string[],
    startSampleIndex: number,
    sampleCount: number,
  ): Promise<NumericChannelBatchResult> {
    if (!this.source.readChannelsRange) {
      const ranges = new Map<string, NumericChannelRange>();
      for (const channelId of channelIds) {
        ranges.set(
          channelId,
          await this.readChannelRange(channelId, startSampleIndex, sampleCount),
        );
      }
      return {
        ranges,
        performance: {
          channelCount: channelIds.length,
          cacheHitChannelIds: [],
          physicalReadCount: 0,
          physicalBytesRead: 0,
          physicalReadMs: 0,
        },
      };
    }

    const sourceIds = channelIds.map((channelId) => this.sourceId(channelId));
    const sourceResult = await this.source.readChannelsRange(
      sourceIds,
      startSampleIndex,
      sampleCount,
    );

    const ranges = new Map<string, NumericChannelRange>();
    for (let index = 0; index < channelIds.length; index += 1) {
      const channelId = channelIds[index];
      const sourceId = sourceIds[index];
      if (!channelId || !sourceId) continue;
      const range = sourceResult.ranges.get(sourceId);
      if (range) ranges.set(channelId, range);
    }

    const sourceCacheHits = new Set(sourceResult.performance.cacheHitChannelIds);
    return {
      ranges,
      performance: {
        ...sourceResult.performance,
        channelCount: channelIds.length,
        cacheHitChannelIds: channelIds.filter((_channelId, index) => {
          const sourceId = sourceIds[index];
          return sourceId ? sourceCacheHits.has(sourceId) : false;
        }),
      },
    };
  }
}
