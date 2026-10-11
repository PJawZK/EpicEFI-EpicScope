import type {
  NumericQualificationLogic,
  NumericQualificationOperator,
} from '../../../../core/analysis/sample-qualification';

export interface AnalysisFilterConditionState {
  readonly channelId: string;
  readonly operator: NumericQualificationOperator;
  readonly value: number;
  readonly group: string;
  readonly enabled: boolean;
}

export interface AnalysisFilterSetState {
  readonly id: string;
  readonly name: string;
  readonly groupLogic: NumericQualificationLogic;
  readonly groupConditionLogic: NumericQualificationLogic;
  readonly conditions: readonly AnalysisFilterConditionState[];
}

// Preserve the established key so existing Table Generator filters remain available.
const FILTER_SET_KEY = 'epicscope.histogram.filter-sets.v1';
const qualificationOperators = new Set<NumericQualificationOperator>(['gt', 'gte', 'lt', 'lte', 'eq', 'neq']);
const qualificationLogic = new Set<NumericQualificationLogic>(['and', 'or']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function isAnalysisFilterCondition(value: unknown): value is AnalysisFilterConditionState {
  if (!isRecord(value)) return false;
  return isString(value.channelId)
    && qualificationOperators.has(value.operator as NumericQualificationOperator)
    && isFiniteNumber(value.value)
    && isString(value.group)
    && isBoolean(value.enabled);
}

function isAnalysisFilterSet(value: unknown): value is AnalysisFilterSetState {
  if (!isRecord(value) || !Array.isArray(value.conditions)) return false;
  return isString(value.id)
    && value.id.length > 0
    && isString(value.name)
    && value.name.length > 0
    && qualificationLogic.has(value.groupLogic as NumericQualificationLogic)
    && qualificationLogic.has(value.groupConditionLogic as NumericQualificationLogic)
    && value.conditions.every(isAnalysisFilterCondition);
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

let filterSetCache = readValidatedArray(FILTER_SET_KEY, isAnalysisFilterSet);

export const loadAnalysisFilterSets = (): AnalysisFilterSetState[] => [...filterSetCache];
export const saveAnalysisFilterSets = (values: readonly AnalysisFilterSetState[]): boolean => {
  filterSetCache = values.filter(isAnalysisFilterSet);
  return writeArray(FILTER_SET_KEY, filterSetCache);
};
