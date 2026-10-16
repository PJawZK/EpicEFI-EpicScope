import { compileCalculatedField, evaluateCalculatedFieldRange, splitCalculatedFieldOffsetReference, type CalculatedFieldRangeBinding } from '../../../../core/analysis/calculated-field';
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

export function histogramFormulaDefinition(field: HistogramCalculatedFieldDefinition): ChannelDefinition {
  return {
    id: histogramFormulaChannelId(field.id),
    sourceName: field.name,
    displayName: `ƒ ${field.name}`,
    valueType: 'number',
    category: 'Calculated',
    ...(field.unit ? { unit: field.unit } : {}),
  };
}

interface ResolvedPhysicalReference {
  readonly channel: ChannelDefinition;
  readonly sampleOffset: number;
}

function exactPhysicalReference(reference: string, channels: readonly ChannelDefinition[], referenceLabel: string): ChannelDefinition | undefined {
  const normalized = reference.trim().toLocaleLowerCase();
  const matches = channels.filter((channel) =>
    !channel.id.startsWith('formula:')
    && (channel.id === reference
      || channel.displayName.toLocaleLowerCase() === normalized
      || channel.sourceName.toLocaleLowerCase() === normalized),
  );
  if (matches.length > 1) throw new RangeError(`${referenceLabel} reference is ambiguous: [${reference}]`);
  return matches[0];
}

function resolvePhysicalReference(reference: string, channels: readonly ChannelDefinition[], referenceLabel: string): ResolvedPhysicalReference {
  const exact = exactPhysicalReference(reference, channels, referenceLabel);
  if (exact) return { channel: exact, sampleOffset: 0 };
  const historical = splitCalculatedFieldOffsetReference(reference);
  if (historical) {
    const base = exactPhysicalReference(historical.baseReference, channels, referenceLabel);
    if (base) return { channel: base, sampleOffset: historical.sampleOffset };
  }
  throw new RangeError(`${referenceLabel} not found: [${reference}]`);
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

/** Prepared against one catalog snapshot; contains no loaded sample data. */
export interface HistogramFormulaPlan {
  readonly program: ReturnType<typeof compileCalculatedField>;
  readonly references: ReadonlyMap<string, ResolvedPhysicalReference>;
  readonly physicalIds: readonly string[];
}

export function prepareHistogramFormula(
  expression: string,
  channels: readonly ChannelDefinition[],
  referenceLabel: 'Formula channel' | 'Channel' = 'Formula channel',
): HistogramFormulaPlan {
  const program = compileCalculatedField(expression);
  const references = new Map<string, ResolvedPhysicalReference>();
  const physicalIds = new Set<string>();
  for (const reference of program.references) {
    const resolved = resolvePhysicalReference(reference, channels, referenceLabel);
    references.set(reference, resolved);
    physicalIds.add(resolved.channel.id);
  }
  return { program, references, physicalIds: [...physicalIds] };
}

/** Missing dependencies stay unavailable; owners choose their own UI/error policy. */
export function evaluateHistogramFormula(
  plan: HistogramFormulaPlan,
  physical: ReadonlyMap<string, HistogramTraceContext>,
  startMs?: number,
  endMs?: number,
): Omit<HistogramTraceContext, 'channel'> | undefined {
  const ranges = new Map<string, CalculatedFieldRangeBinding>();
  let complete = true;
  let firstTrace: HistogramTraceContext | undefined;
  for (const [reference, resolved] of plan.references) {
    const trace = physical.get(resolved.channel.id);
    if (!trace) return undefined;
    firstTrace ??= trace;
    ranges.set(reference, { range: trace.range, sampleOffset: resolved.sampleOffset });
    complete &&= traceCoversRequestedScope(trace, startMs, endMs);
  }
  return {
    range: evaluateCalculatedFieldRange(plan.program, ranges),
    complete,
    color: firstTrace?.color ?? '#58aef6',
  };
}

export function createHistogramLogicalContext(
  baseContext: HistogramPageContext,
  fields: readonly HistogramCalculatedFieldDefinition[] = loadHistogramCalculatedFields(),
): HistogramPageContext {
  const fieldByLogicalId = new Map(fields.map((field) => [histogramFormulaChannelId(field.id), field]));
  const virtualChannels = fields.map(histogramFormulaDefinition);

  return {
    ...baseContext,
    channels: [...baseContext.channels, ...virtualChannels],
    loadTraces: async (logicalIds, startMs, endMs) => {
      const requestedIds = [...new Set(logicalIds.filter(Boolean))];
      const plans = new Map<string, HistogramFormulaPlan>();
      const physicalIds = new Set<string>();

      for (const logicalId of requestedIds) {
        const field = fieldByLogicalId.get(logicalId);
        if (!field) {
          physicalIds.add(logicalId);
          continue;
        }
        const plan = prepareHistogramFormula(field.expression, baseContext.channels);
        for (const id of plan.physicalIds) physicalIds.add(id);
        plans.set(logicalId, plan);
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
        const plan = plans.get(logicalId);
        if (!field || !plan) continue;
        const evaluated = evaluateHistogramFormula(plan, physical, startMs, endMs);
        if (!evaluated) continue;
        result.push({ channel: histogramFormulaDefinition(field), ...evaluated });
      }

      return result;
    },
  };
}
