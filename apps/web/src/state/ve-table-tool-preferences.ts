import type {
  TableBrushFalloff,
  TableBrushOptions,
  TableInterpolation1dMethod,
  TableInterpolation2dMethod,
  TableInterpolationOptions,
} from '../pages/ve-table-interaction';

// Persisted tool preferences belong to Lambda Delay. Proposal's shared adapter
// keeps instance-local, precision-derived defaults; Target remains read-only.
export type VeTableToolSurface = 'delay';

export interface VeTableToolPreferences {
  readonly adjustmentStep: number;
  readonly smoothStrength: number;
  readonly interpolation: Readonly<{
    method1d: TableInterpolation1dMethod;
    method2d: TableInterpolation2dMethod;
    strength: number;
    clamp: boolean;
  }>;
  readonly brush: Readonly<{
    delta: number;
    radius: number;
    strength: number;
    falloff: TableBrushFalloff;
  }>;
}

const STORAGE_KEY = 'epicscope.veAnalyzer.tableTools.v1';
const DELAY_DEFAULTS: VeTableToolPreferences = {
  adjustmentStep: 5,
  smoothStrength: 0.5,
  interpolation: { method1d: 'linear', method2d: 'bilinear', strength: 1, clamp: true },
  brush: { delta: 5, radius: 1, strength: 0.7, falloff: 'soft' },
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function sanitize(value: unknown): VeTableToolPreferences {
  const record = isRecord(value) ? value : {};
  const interpolation = isRecord(record.interpolation) ? record.interpolation : {};
  const brush = isRecord(record.brush) ? record.brush : {};
  const adjustmentStep = finite(record.adjustmentStep) && record.adjustmentStep > 0
    ? record.adjustmentStep : DELAY_DEFAULTS.adjustmentStep;
  const smoothStrength = finite(record.smoothStrength)
    ? clamp01(record.smoothStrength) : DELAY_DEFAULTS.smoothStrength;
  const method1d: TableInterpolation1dMethod = interpolation.method1d === 'shape' ? 'shape' : 'linear';
  const method2d: TableInterpolation2dMethod = interpolation.method2d === 'boundary' ? 'boundary' : 'bilinear';
  const interpolationStrength = finite(interpolation.strength)
    ? clamp01(interpolation.strength) : DELAY_DEFAULTS.interpolation.strength;
  const interpolationClamp = typeof interpolation.clamp === 'boolean'
    ? interpolation.clamp : DELAY_DEFAULTS.interpolation.clamp;
  const delta = finite(brush.delta) ? brush.delta : DELAY_DEFAULTS.brush.delta;
  const radius = finite(brush.radius)
    ? Math.max(1, Math.min(8, Math.round(brush.radius))) : DELAY_DEFAULTS.brush.radius;
  const brushStrength = finite(brush.strength) ? clamp01(brush.strength) : DELAY_DEFAULTS.brush.strength;
  const falloff: TableBrushFalloff = brush.falloff === 'flat' || brush.falloff === 'linear' || brush.falloff === 'soft'
    ? brush.falloff : DELAY_DEFAULTS.brush.falloff;
  return {
    adjustmentStep,
    smoothStrength,
    interpolation: { method1d, method2d, strength: interpolationStrength, clamp: interpolationClamp },
    brush: { delta, radius, strength: brushStrength, falloff },
  };
}

function readDelay(): VeTableToolPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return sanitize(undefined);
    const parsed: unknown = JSON.parse(raw);
    return sanitize(isRecord(parsed) ? parsed.delay : undefined);
  } catch {
    return sanitize(undefined);
  }
}

let delayCache = readDelay();

function persist(): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ delay: delayCache }));
    return true;
  } catch {
    return false;
  }
}

export function loadVeTableToolPreferences(_surface: VeTableToolSurface): VeTableToolPreferences {
  return {
    adjustmentStep: delayCache.adjustmentStep,
    smoothStrength: delayCache.smoothStrength,
    interpolation: { ...delayCache.interpolation },
    brush: { ...delayCache.brush },
  };
}

export function saveVeTableToolPreferences(
  _surface: VeTableToolSurface,
  value: VeTableToolPreferences,
): VeTableToolPreferences {
  delayCache = sanitize(value);
  persist();
  return loadVeTableToolPreferences('delay');
}

export function resetVeTableToolPreferences(_surface: VeTableToolSurface): VeTableToolPreferences {
  delayCache = sanitize(DELAY_DEFAULTS);
  persist();
  return loadVeTableToolPreferences('delay');
}

export function interpolationOptions(
  preferences: VeTableToolPreferences,
  axis: TableInterpolationOptions['axis'],
): TableInterpolationOptions {
  return { axis, ...preferences.interpolation };
}

export function brushOptions(preferences: VeTableToolPreferences): TableBrushOptions {
  return { ...preferences.brush };
}
