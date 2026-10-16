import type {
  TableBrushFalloff,
  TableBrushOptions,
  TableInterpolation1dMethod,
  TableInterpolation2dMethod,
  TableInterpolationOptions,
} from '../pages/ve-table-interaction';

export type VeTableToolSurface = 've' | 'target' | 'delay';

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

const DEFAULTS: Readonly<Record<VeTableToolSurface, VeTableToolPreferences>> = Object.freeze({
  ve: {
    adjustmentStep: 1,
    smoothStrength: 0.5,
    interpolation: { method1d: 'linear', method2d: 'bilinear', strength: 1, clamp: true },
    brush: { delta: 1, radius: 2, strength: 0.7, falloff: 'soft' },
  },
  target: {
    adjustmentStep: 0.1,
    smoothStrength: 0.5,
    interpolation: { method1d: 'linear', method2d: 'bilinear', strength: 1, clamp: true },
    brush: { delta: 0.1, radius: 2, strength: 0.7, falloff: 'soft' },
  },
  delay: {
    adjustmentStep: 5,
    smoothStrength: 0.5,
    interpolation: { method1d: 'linear', method2d: 'bilinear', strength: 1, clamp: true },
    brush: { delta: 5, radius: 1, strength: 0.7, falloff: 'soft' },
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

function sanitize(surface: VeTableToolSurface, value: unknown): VeTableToolPreferences {
  const fallback = DEFAULTS[surface];
  const record = isRecord(value) ? value : {};
  const interpolation = isRecord(record.interpolation) ? record.interpolation : {};
  const brush = isRecord(record.brush) ? record.brush : {};
  const adjustmentStep = finite(record.adjustmentStep) && record.adjustmentStep > 0
    ? record.adjustmentStep : fallback.adjustmentStep;
  const smoothStrength = finite(record.smoothStrength)
    ? clamp01(record.smoothStrength) : fallback.smoothStrength;
  const method1d: TableInterpolation1dMethod = interpolation.method1d === 'shape' ? 'shape' : 'linear';
  const method2d: TableInterpolation2dMethod = interpolation.method2d === 'boundary' ? 'boundary' : 'bilinear';
  const interpolationStrength = finite(interpolation.strength)
    ? clamp01(interpolation.strength) : fallback.interpolation.strength;
  const interpolationClamp = typeof interpolation.clamp === 'boolean'
    ? interpolation.clamp : fallback.interpolation.clamp;
  const delta = finite(brush.delta) ? brush.delta : fallback.brush.delta;
  const radius = finite(brush.radius)
    ? Math.max(1, Math.min(8, Math.round(brush.radius))) : fallback.brush.radius;
  const brushStrength = finite(brush.strength) ? clamp01(brush.strength) : fallback.brush.strength;
  const falloff: TableBrushFalloff = brush.falloff === 'flat' || brush.falloff === 'linear' || brush.falloff === 'soft'
    ? brush.falloff : fallback.brush.falloff;
  return {
    adjustmentStep,
    smoothStrength,
    interpolation: { method1d, method2d, strength: interpolationStrength, clamp: interpolationClamp },
    brush: { delta, radius, strength: brushStrength, falloff },
  };
}

function readAll(): Record<VeTableToolSurface, VeTableToolPreferences> {
  let parsed: unknown;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = undefined;
  }
  const record = isRecord(parsed) ? parsed : {};
  return {
    ve: sanitize('ve', record.ve),
    target: sanitize('target', record.target),
    delay: sanitize('delay', record.delay),
  };
}

let cache = readAll();

function persist(): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

export function loadVeTableToolPreferences(surface: VeTableToolSurface): VeTableToolPreferences {
  const value = cache[surface];
  return {
    adjustmentStep: value.adjustmentStep,
    smoothStrength: value.smoothStrength,
    interpolation: { ...value.interpolation },
    brush: { ...value.brush },
  };
}

export function saveVeTableToolPreferences(
  surface: VeTableToolSurface,
  value: VeTableToolPreferences,
): VeTableToolPreferences {
  const next = sanitize(surface, value);
  cache = { ...cache, [surface]: next };
  persist();
  return loadVeTableToolPreferences(surface);
}

export function resetVeTableToolPreferences(surface: VeTableToolSurface): VeTableToolPreferences {
  cache = { ...cache, [surface]: sanitize(surface, DEFAULTS[surface]) };
  persist();
  return loadVeTableToolPreferences(surface);
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
