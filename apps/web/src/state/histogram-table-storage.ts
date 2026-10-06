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

const aggregationValues = new Set<HistogramTableAggregation>([
  'count',
  'sum',
  'min',
  'max',
  'mean',
  'variance',
  'standard-deviation',
  'weighted-mean',
]);
const qualificationOperators = new Set<NumericQualificationOperator>(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']);
const qualificationLogic = new Set<NumericQualificationLogic>(['and', 'or']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function isCalculatedField(value: unknown): value is HistogramCalculatedFieldDefinition {
  if (!isRecord(value)) return false;
  return isString(value.id)
    && value.id.length > 0
    && isString(value.name)
    && value.name.length > 0
    && isString(value.expression)
    && value.expression.length > 0
    && (value.unit === undefined || isString(value.unit));
}

function isFilterCondition(value: unknown): value is HistogramFilterConditionState {
  if (!isRecord(value)) return false;
  return isString(value.channelId)
    && qualificationOperators.has(value.operator as NumericQualificationOperator)
    && isFiniteNumber(value.value)
    && isString(value.group)
    && isBoolean(value.enabled);
}

function isFilterSet(value: unknown): value is HistogramFilterSetState {
  if (!isRecord(value) || !Array.isArray(value.conditions)) return false;
  return isString(value.id)
    && value.id.length > 0
    && isString(value.name)
    && value.name.length > 0
    && qualificationLogic.has(value.groupLogic as NumericQualificationLogic)
    && qualificationLogic.has(value.groupConditionLogic as NumericQualificationLogic)
    && value.conditions.every(isFilterCondition);
}

function isTablePreset(value: unknown): value is HistogramTablePresetState {
  if (!isRecord(value) || !Array.isArray(value.filters)) return false;
  const stringKeys = [
    'id', 'name', 'scope', 'xChannelId', 'yChannelId', 'zChannelId', 'deltaChannelId',
    'xBins', 'yBins', 'xMin', 'xMax', 'yMin', 'yMax', 'xBreakpoints', 'yBreakpoints',
    'msqTable', 'msqXAxis', 'msqYAxis',
  ] as const;
  return stringKeys.every((key) => isString(value[key]))
    && (value.id as string).length > 0
    && (value.name as string).length > 0
    && aggregationValues.has(value.aggregation as HistogramTableAggregation)
    && (value.axisSource === 'auto' || value.axisSource === 'custom' || value.axisSource === 'msq')
    && isBoolean(value.showHits)
    && (value.minimumIndividualWeight === undefined || isFiniteNumber(value.minimumIndividualWeight))
    && (value.minimumTotalWeight === undefined || isFiniteNumber(value.minimumTotalWeight))
    && (value.colorMode === undefined || value.colorMode === 'value' || value.colorMode === 'weight')
    && qualificationLogic.has(value.groupLogic as NumericQualificationLogic)
    && qualificationLogic.has(value.groupConditionLogic as NumericQualificationLogic)
    && value.filters.every(isFilterCondition);
}

function readValidatedArray<T>(key: string, guard: (value: unknown) => value is T): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(guard);
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, values: readonly T[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(values));
    return true;
  } catch {
    return false;
  }
}

let calculatedFieldCache = readValidatedArray(FORMULA_KEY, isCalculatedField);
let filterSetCache = readValidatedArray(FILTER_SET_KEY, isFilterSet);
let tablePresetCache = readValidatedArray(PRESET_KEY, isTablePreset);

export const loadHistogramCalculatedFields = (): HistogramCalculatedFieldDefinition[] => [...calculatedFieldCache];
export const saveHistogramCalculatedFields = (values: readonly HistogramCalculatedFieldDefinition[]): boolean => {
  calculatedFieldCache = values.filter(isCalculatedField);
  return writeArray(FORMULA_KEY, calculatedFieldCache);
};
export const loadHistogramFilterSets = (): HistogramFilterSetState[] => [...filterSetCache];
export const saveHistogramFilterSets = (values: readonly HistogramFilterSetState[]): boolean => {
  filterSetCache = values.filter(isFilterSet);
  return writeArray(FILTER_SET_KEY, filterSetCache);
};
export const loadHistogramTablePresets = (): HistogramTablePresetState[] => [...tablePresetCache];
export const saveHistogramTablePresets = (values: readonly HistogramTablePresetState[]): boolean => {
  tablePresetCache = values.filter(isTablePreset);
  return writeArray(PRESET_KEY, tablePresetCache);
};

export function createHistogramLocalId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
