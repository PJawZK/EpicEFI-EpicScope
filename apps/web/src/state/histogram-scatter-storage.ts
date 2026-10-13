export type HistogramScatterLayout = 'single' | 'dual';
export type HistogramScatterTraceMode = 'dots' | 'lines';

export interface HistogramScatterPresetState {
  readonly id: string;
  readonly name: string;
  readonly scope: string;
  readonly qualificationId: string;
  readonly layout: HistogramScatterLayout;
  readonly traceMode: HistogramScatterTraceMode;
  readonly paneAXChannelId: string;
  readonly paneAYChannelId: string;
  readonly paneBXChannelId: string;
  readonly paneBYChannelId: string;
}

const PRESET_KEY = 'epicscope.histogram.scatter-presets.v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';

export function isHistogramScatterPreset(value: unknown): value is HistogramScatterPresetState {
  if (!isRecord(value)) return false;
  const stringKeys = [
    'id', 'name', 'scope', 'qualificationId',
    'paneAXChannelId', 'paneAYChannelId', 'paneBXChannelId', 'paneBYChannelId',
  ] as const;
  return stringKeys.every((key) => isString(value[key]))
    && (value.id as string).length > 0
    && (value.name as string).length > 0
    && (value.layout === 'single' || value.layout === 'dual')
    && (value.traceMode === 'dots' || value.traceMode === 'lines');
}

function readPresets(): HistogramScatterPresetState[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isHistogramScatterPreset) : [];
  } catch {
    return [];
  }
}

let presetCache = readPresets();

export const loadHistogramScatterPresets = (): HistogramScatterPresetState[] => [...presetCache];
export const saveHistogramScatterPresets = (values: readonly HistogramScatterPresetState[]): boolean => {
  presetCache = values.filter(isHistogramScatterPreset);
  try {
    localStorage.setItem(PRESET_KEY, JSON.stringify(presetCache));
    return true;
  } catch {
    return false;
  }
};
