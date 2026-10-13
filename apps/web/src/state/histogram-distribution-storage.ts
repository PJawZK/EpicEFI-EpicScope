export type HistogramDistributionMetric = 'count' | 'percent' | 'time';
export type HistogramDistributionBinMode = 'auto' | 'manual' | 'fixed';
export type HistogramDistributionDisplay = 'histogram' | 'cumulative';

export interface HistogramDistributionPresetState {
  readonly id: string;
  readonly name: string;
  readonly channelId: string;
  readonly scope: string;
  readonly qualificationId: string;
  readonly metric: HistogramDistributionMetric;
  readonly binMode: HistogramDistributionBinMode;
  readonly binCount: string;
  readonly fixedMin?: string;
  readonly fixedMax?: string;
  readonly fixedWidth?: string;
  readonly display: HistogramDistributionDisplay;
  readonly compare: boolean;
  readonly compareScope: string;
}

const PRESET_KEY = 'epicscope.histogram.distribution-presets.v1';
const metricValues = new Set<HistogramDistributionMetric>(['count', 'percent', 'time']);
const binModeValues = new Set<HistogramDistributionBinMode>(['auto', 'manual', 'fixed']);
const displayValues = new Set<HistogramDistributionDisplay>(['histogram', 'cumulative']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';

function isPreset(value: unknown): value is HistogramDistributionPresetState {
  if (!isRecord(value)) return false;
  return isString(value.id) && value.id.length > 0
    && isString(value.name) && value.name.length > 0
    && isString(value.channelId)
    && isString(value.scope)
    && isString(value.qualificationId)
    && metricValues.has(value.metric as HistogramDistributionMetric)
    && binModeValues.has(value.binMode as HistogramDistributionBinMode)
    && isString(value.binCount)
    && (value.fixedMin === undefined || isString(value.fixedMin))
    && (value.fixedMax === undefined || isString(value.fixedMax))
    && (value.fixedWidth === undefined || isString(value.fixedWidth))
    && displayValues.has(value.display as HistogramDistributionDisplay)
    && typeof value.compare === 'boolean'
    && isString(value.compareScope);
}

function readPresets(): HistogramDistributionPresetState[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPreset) : [];
  } catch {
    return [];
  }
}

let presetCache = readPresets();

export const loadHistogramDistributionPresets = (): HistogramDistributionPresetState[] => [...presetCache];
export const saveHistogramDistributionPresets = (values: readonly HistogramDistributionPresetState[]): boolean => {
  presetCache = values.filter(isPreset);
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(presetCache));
    return true;
  } catch {
    return false;
  }
};
