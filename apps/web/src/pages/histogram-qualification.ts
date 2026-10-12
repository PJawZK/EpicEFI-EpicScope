import {
  qualifyNumericSampleGroups,
  type NumericQualificationGroup,
} from '../../../../core/analysis/sample-qualification';
import {
  loadAnalysisFilterSets,
  type AnalysisFilterSetState,
} from '../state/analysis-filter-storage';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';

export interface HistogramQualificationState {
  readonly filterSet: AnalysisFilterSetState | undefined;
  readonly inputSampleCount: number;
  readonly eligibleSampleCount: number;
  readonly rejectedSampleCount: number;
  readonly invalidSampleCount: number;
  readonly unavailableSampleCount: number;
  readonly complete: boolean;
  readonly eligibleSampleIndices: Uint32Array;
}

export function loadHistogramQualificationSets(): AnalysisFilterSetState[] {
  return loadAnalysisFilterSets();
}

export function populateHistogramQualificationSelect(
  select: HTMLSelectElement,
  filterSets: readonly AnalysisFilterSetState[],
  channels: HistogramPageContext['channels'],
  previous = select.value,
): void {
  const availableChannelIds = new Set(channels.map((channel) => channel.id));
  select.replaceChildren(new Option('None', ''));
  for (const filterSet of filterSets) {
    const required = filterSet.conditions
      .filter((condition) => condition.enabled)
      .map((condition) => condition.channelId);
    const missing = required.filter((channelId) => !availableChannelIds.has(channelId));
    const option = new Option(
      missing.length === 0 ? filterSet.name : `${filterSet.name} · unavailable channels`,
      filterSet.id,
    );
    option.disabled = missing.length > 0;
    select.add(option);
  }
  if (previous && [...select.options].some((option) => option.value === previous && !option.disabled)) {
    select.value = previous;
  }
}

export function selectedHistogramQualification(
  select: HTMLSelectElement,
  filterSets: readonly AnalysisFilterSetState[],
): AnalysisFilterSetState | undefined {
  return select.value ? filterSets.find((filterSet) => filterSet.id === select.value) : undefined;
}

export function histogramQualificationChannelIds(filterSet: AnalysisFilterSetState | undefined): string[] {
  if (!filterSet) return [];
  return [...new Set(filterSet.conditions
    .filter((condition) => condition.enabled)
    .map((condition) => condition.channelId))];
}

function qualificationGroups(filterSet: AnalysisFilterSetState | undefined): NumericQualificationGroup[] {
  if (!filterSet) return [];
  const grouped = new Map<string, Array<{
    channelId: string;
    operator: AnalysisFilterSetState['conditions'][number]['operator'];
    value: number;
  }>>();
  for (const condition of filterSet.conditions) {
    if (!condition.enabled) continue;
    const groupId = condition.group || 'A';
    const conditions = grouped.get(groupId) ?? [];
    conditions.push({ channelId: condition.channelId, operator: condition.operator, value: condition.value });
    grouped.set(groupId, conditions);
  }
  return [...grouped.entries()].map(([id, conditions]) => ({
    id,
    logic: filterSet.groupConditionLogic,
    conditions,
  }));
}

export function qualifyHistogramSamples(
  referenceTrace: HistogramTraceContext,
  traces: readonly HistogramTraceContext[],
  filterSet: AnalysisFilterSetState | undefined,
  startMs?: number,
  endMs?: number,
): HistogramQualificationState | undefined {
  const requiredIds = histogramQualificationChannelIds(filterSet);
  const byId = new Map(traces.map((trace) => [trace.channel.id, trace]));
  if (requiredIds.some((channelId) => !byId.has(channelId))) return undefined;

  const channels = new Map(traces.map((trace) => [
    trace.channel.id,
    { range: trace.range, complete: trace.complete },
  ]));
  const qualified = qualifyNumericSampleGroups({
    referenceChannelId: referenceTrace.channel.id,
    channels,
    groupLogic: filterSet?.groupLogic ?? 'and',
    groups: qualificationGroups(filterSet),
    ...(startMs !== undefined && endMs !== undefined
      ? { timeRange: { startMs, endMs } }
      : {}),
  });

  return {
    filterSet,
    inputSampleCount: qualified.inputSampleCount,
    eligibleSampleCount: qualified.eligibleSampleCount,
    rejectedSampleCount: qualified.valueRejectedSampleCount,
    invalidSampleCount: qualified.invalidSampleCount,
    unavailableSampleCount: qualified.unavailableSampleCount,
    complete: qualified.complete,
    eligibleSampleIndices: qualified.eligibleSampleIndices,
  };
}
