import { compileCalculatedField, evaluateCalculatedFieldRange } from '../../../../core/analysis/calculated-field';
import { numericRangeCoversTime } from '../../../../core/analysis/range-statistics';
import type { ChannelDefinition } from '../../../../core/log-model/log-types';
import {
  loadHistogramCalculatedFields,
  type HistogramCalculatedFieldDefinition,
} from '../state/histogram-table-storage';
import type { HistogramPageContext, HistogramTraceContext } from './histogram-page';

export const HISTOGRAM_CALCULATED_FIELDS_CHANGED_EVENT = 'epicscope-histogram-calculated-fields-changed';

export function histogramFormulaChannelId(id: string): string {
  return `formula:${id}`;
}

function virtualDefinition(field: HistogramCalculatedFieldDefinition): ChannelDefinition {
  return {
    id: histogramFormulaChannelId(field.id),
    sourceName: field.name,
    displayName: `ƒ ${field.name}`,
    valueType: 'number',
    category: 'Calculated',
    ...(field.unit ? { unit: field.unit } : {}),
  };
}

function resolvePhysicalReference(reference: string, channels: readonly ChannelDefinition[]): ChannelDefinition {
  const normalized = reference.trim().toLocaleLowerCase();
  const matches = channels.filter((channel) =>
    channel.id === reference
    || channel.displayName.toLocaleLowerCase() === normalized
    || channel.sourceName.toLocaleLowerCase() === normalized,
  );
  if (matches.length === 0) throw new RangeError(`Formula channel not found: [${reference}]`);
  if (matches.length > 1) throw new RangeError(`Formula channel reference is ambiguous: [${reference}]`);
  return matches[0]!;
}

function traceCoversRequestedScope(
  trace: HistogramTraceContext,
  startMs: number | undefined,
  endMs: number | undefined,
): boolean {
  if (trace.complete) return true;
  if (startMs === undefined || endMs === undefined) return false;
  return numericRangeCoversTime(trace.range, Math.min(startMs, endMs), Math.max(startMs, endMs));
}

export function createHistogramLogicalContext(
  baseContext: HistogramPageContext,
  fields: readonly HistogramCalculatedFieldDefinition[] = loadHistogramCalculatedFields(),
): HistogramPageContext {
  const fieldByLogicalId = new Map(fields.map((field) => [histogramFormulaChannelId(field.id), field]));
  const virtualChannels = fields.map(virtualDefinition);

  return {
    ...baseContext,
    channels: [...baseContext.channels, ...virtualChannels],
    loadTraces: async (logicalIds, startMs, endMs) => {
      const requestedIds = [...new Set(logicalIds.filter(Boolean))];
      const programs = new Map<string, ReturnType<typeof compileCalculatedField>>();
      const referencesByLogicalId = new Map<string, ReadonlyMap<string, ChannelDefinition>>();
      const physicalIds = new Set<string>();

      for (const logicalId of requestedIds) {
        const field = fieldByLogicalId.get(logicalId);
        if (!field) {
          physicalIds.add(logicalId);
          continue;
        }
        const program = compileCalculatedField(field.expression);
        const references = new Map<string, ChannelDefinition>();
        for (const reference of program.references) {
          const channel = resolvePhysicalReference(reference, baseContext.channels);
          references.set(reference, channel);
          physicalIds.add(channel.id);
        }
        programs.set(logicalId, program);
        referencesByLogicalId.set(logicalId, references);
      }

      const loaded = await baseContext.loadTraces([...physicalIds], startMs, endMs);
      const physical = new Map(loaded.map((trace) => [trace.channel.id, trace]));
      const result: HistogramTraceContext[] = [];

      for (const logicalId of requestedIds) {
        const direct = physical.get(logicalId);
        if (direct) {
          result.push(direct);
          continue;
        }

        const field = fieldByLogicalId.get(logicalId);
        const program = programs.get(logicalId);
        const references = referencesByLogicalId.get(logicalId);
        if (!field || !program || !references) continue;

        const ranges = new Map<string, HistogramTraceContext['range']>();
        let complete = true;
        let firstTrace: HistogramTraceContext | undefined;
        for (const [reference, channel] of references) {
          const trace = physical.get(channel.id);
          if (!trace) {
            complete = false;
            continue;
          }
          firstTrace ??= trace;
          ranges.set(reference, trace.range);
          complete &&= traceCoversRequestedScope(trace, startMs, endMs);
        }
        if (ranges.size !== references.size) continue;

        result.push({
          channel: virtualDefinition(field),
          range: evaluateCalculatedFieldRange(program, ranges),
          complete,
          color: firstTrace?.color ?? '#58aef6',
        });
      }

      return result;
    },
  };
}
