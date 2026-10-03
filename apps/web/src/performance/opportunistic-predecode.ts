import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export interface OpportunisticPredecodeSelection {
  readonly batchIds: readonly string[];
  readonly opportunisticIds: readonly string[];
  readonly opportunisticLabels: readonly string[];
}

export function buildOpportunisticPredecodeSelection(
  workspaceIds: readonly string[],
  channelDefinitions: ReadonlyMap<string, ChannelDefinition>,
  unavailableChannelIds: ReadonlySet<string>,
  targetCount: number,
): OpportunisticPredecodeSelection {
  const batchIds = [...new Set(workspaceIds)];
  const existing = new Set(batchIds);
  const opportunisticIds: string[] = [];
  const opportunisticLabels: string[] = [];

  if (targetCount > batchIds.length) {
    for (const [channelId, definition] of channelDefinitions) {
      if (batchIds.length >= targetCount) break;
      if (existing.has(channelId) || unavailableChannelIds.has(channelId)) continue;

      batchIds.push(channelId);
      existing.add(channelId);
      opportunisticIds.push(channelId);
      opportunisticLabels.push(`${definition.displayName} [${channelId}]`);
    }
  }

  return { batchIds, opportunisticIds, opportunisticLabels };
}
