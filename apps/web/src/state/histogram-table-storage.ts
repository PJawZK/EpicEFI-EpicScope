import type { NumericAggregationMethod } from '../../../../core/analysis/numeric-aggregation';
import type { NumericQualificationLogic, NumericQualificationOperator } from '../../../../core/analysis/sample-qualification';

export type HistogramTableAggregation = NumericAggregationMethod | 'weighted-mean';
export type HistogramTableColorMode = 'value' | 'weight';

export interface HistogramCalculatedFieldDefinition {
  readonly id: string;
  readonly name: string;
  readonly expression: string;
  readonly unit?: string;
}

export interface HistogramFilterConditionState {
  readonly channelId: string;
  readonly operator: NumericQualificationOperator;
  readonly value: number;
  readonly group: string;
  readonly enabled: boolean;
}

export interface HistogramFilterSetState {
  readonly id: string;
  readonly name: string;
  readonly groupLogic: NumericQualificationLogic;
  readonly groupConditionLogic: NumericQualificationLogic;
  readonly conditions: readonly HistogramFilterConditionState[];
}

export interface HistogramTablePresetState {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
  readonly xChannelId: string;
  readonly yChannelId: string;
  readonly zChannelId: string;
  readonly deltaChannelId: string;
  readonly aggregation: HistogramTableAggregation;
  readonly axisSource: 'auto' | 'custom' | 'msq';
  readonly xBins: string;
  readonly yBins: string;
  readonly xMin: string;
  readonly xMax: string;
  readonly yMin: string;
  readonly yMax: string;
  readonly xBreakpoints: string;
  readonly yBreakpoints: string;
  readonly msqTable: string;
  readonly msqXAxis: string;
  readonly msqYAxis: string;
  readonly showHits: boolean;
  readonly minimumIndividualWeight?: number;
  readonly minimumTotalWeight?: number;
  readonly colorMode?: HistogramTableColorMode;
  readonly groupLogic: NumericQualificationLogic;
  readonly groupConditionLogic: NumericQualificationLogic;
  readonly filters: readonly HistogramFilterConditionState[];
}

const FORMULA_KEY = 'epicscope.histogram.formulas.v1';
const FILTER_SET_KEY = 'epicscope.histogram.filter-sets.v1';
const PRESET_KEY = 'epicscope.histogram.table-presets.v1';

function readArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, values: readonly T[]): void {
  try { localStorage.setItem(key, JSON.stringify(values)); } catch { /* session still works without persistence */ }
}

export const loadHistogramCalculatedFields = (): HistogramCalculatedFieldDefinition[] => readArray(FORMULA_KEY);
export const saveHistogramCalculatedFields = (values: readonly HistogramCalculatedFieldDefinition[]): void => writeArray(FORMULA_KEY, values);
export const loadHistogramFilterSets = (): HistogramFilterSetState[] => readArray(FILTER_SET_KEY);
export const saveHistogramFilterSets = (values: readonly HistogramFilterSetState[]): void => writeArray(FILTER_SET_KEY, values);
export const loadHistogramTablePresets = (): HistogramTablePresetState[] => readArray(PRESET_KEY);
export const saveHistogramTablePresets = (values: readonly HistogramTablePresetState[]): void => writeArray(PRESET_KEY, values);

export function createHistogramLocalId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
