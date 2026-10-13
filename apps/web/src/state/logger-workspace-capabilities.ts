/**
 * Workspace structure can be edited as soon as EpicScope knows a channel
 * catalog. Sample data is only required for trace/timeline/statistics features.
 */
export function loggerWorkspaceEditingAvailable(channelCount: number): boolean {
  return Number.isFinite(channelCount) && channelCount > 0;
}
