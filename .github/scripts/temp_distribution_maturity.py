from pathlib import Path

ROOT = Path('.')

def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one anchor, found {count}')
    p.write_text(text.replace(old, new, 1))

(ROOT / 'apps/web/src/state/histogram-distribution-storage.ts').write_text(r'''export type HistogramDistributionMetric = 'count' | 'percent' | 'time';
export type HistogramDistributionBinMode = 'auto' | 'manual';
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
  readonly display: HistogramDistributionDisplay;
  readonly compare: boolean;
  readonly compareScope: string;
}

const PRESET_KEY = 'epicscope.histogram.distribution-presets.v1';
const metricValues = new Set<HistogramDistributionMetric>(['count', 'percent', 'time']);
const binModeValues = new Set<HistogramDistributionBinMode>(['auto', 'manual']);
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
''')

(ROOT / 'apps/web/src/pages/histogram-distribution-csv.ts').write_text(r'''export interface DistributionCsvStats {
  readonly count: number;
  readonly min: number | undefined;
  readonly max: number | undefined;
  readonly mean: number | undefined;
  readonly median: number | undefined;
  readonly standardDeviation: number | undefined;
  readonly p05: number | undefined;
  readonly p25: number | undefined;
  readonly p75: number | undefined;
  readonly p95: number | undefined;
}

export interface DistributionCsvSeries {
  readonly label: string;
  readonly binValues: readonly number[];
  readonly stats: DistributionCsvStats;
  readonly inputSampleCount: number;
  readonly eligibleSampleCount: number;
  readonly rejectedSampleCount: number;
}

export interface DistributionCsvOptions {
  readonly channelLabel: string;
  readonly unit?: string | undefined;
  readonly metric: string;
  readonly display: string;
  readonly binMode: string;
  readonly rangeMin: number;
  readonly rangeMax: number;
  readonly series: readonly DistributionCsvSeries[];
}

export interface DistributionCsvResult {
  readonly csv: string;
  readonly binRowCount: number;
}

function quote(value: string | number | boolean): string {
  const text = String(value);
  return /[\",\n\r]/.test(text) ? `\"${text.replace(/\"/g, '\"\"')}\"` : text;
}

export function buildDistributionCsv(options: DistributionCsvOptions): DistributionCsvResult {
  const header = [
    'row_type', 'series', 'channel', 'unit', 'metric', 'display', 'bin_mode',
    'bin_index', 'lower', 'upper', 'upper_inclusive', 'value',
    'sample_count', 'min', 'max', 'mean', 'median', 'stddev', 'p05', 'p25', 'p75', 'p95',
    'input_samples', 'eligible_samples', 'rejected_samples',
  ];
  const rows: string[] = [header.join(',')];
  const binCount = options.series[0]?.binValues.length ?? 0;
  const width = binCount > 0 ? (options.rangeMax - options.rangeMin) / binCount : 0;
  let binRowCount = 0;

  for (const series of options.series) {
    for (let index = 0; index < series.binValues.length; index += 1) {
      const lower = options.rangeMin + width * index;
      const upper = index === binCount - 1 ? options.rangeMax : options.rangeMin + width * (index + 1);
      const values: (string | number | boolean)[] = [
        'bin', series.label, options.channelLabel, options.unit ?? '', options.metric, options.display, options.binMode,
        index, lower, upper, index === binCount - 1, series.binValues[index] ?? 0,
        '', '', '', '', '', '', '', '', '', '', '', '', '',
      ];
      rows.push(values.map(quote).join(','));
      binRowCount += 1;
    }
    const stats = series.stats;
    const summary: (string | number | boolean)[] = [
      'summary', series.label, options.channelLabel, options.unit ?? '', options.metric, options.display, options.binMode,
      '', '', '', '', '',
      stats.count, stats.min ?? '', stats.max ?? '', stats.mean ?? '', stats.median ?? '', stats.standardDeviation ?? '',
      stats.p05 ?? '', stats.p25 ?? '', stats.p75 ?? '', stats.p95 ?? '',
      series.inputSampleCount, series.eligibleSampleCount, series.rejectedSampleCount,
    ];
    rows.push(summary.map(quote).join(','));
  }
  return { csv: rows.join('\n'), binRowCount };
}

export function distributionCsvFilename(channelLabel: string): string {
  const safe = channelLabel.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'channel';
  return `distribution-${safe}.csv`;
}
''')

(ROOT / 'tests/web/histogram-distribution-storage.test.ts').write_text(r'''import { beforeEach, describe, expect, it, vi } from 'vitest';

class LocalStorageMock {
  private data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
  removeItem(key: string): void { this.data.delete(key); }
  clear(): void { this.data.clear(); }
}

describe('Distribution preset storage', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new LocalStorageMock() });
  });

  it('round-trips complete Distribution setups', async () => {
    const storage = await import('../../apps/web/src/state/histogram-distribution-storage');
    const preset = {
      id: 'dist-1', name: 'RPM compare', channelId: 'rpm', scope: 'ab', qualificationId: 'warm',
      metric: 'percent' as const, binMode: 'manual' as const, binCount: '32', display: 'cumulative' as const,
      compare: true, compareScope: 'full',
    };
    expect(storage.saveHistogramDistributionPresets([preset])).toBe(true);
    expect(storage.loadHistogramDistributionPresets()).toEqual([preset]);
  });

  it('rejects malformed persisted setups', async () => {
    localStorage.setItem('epicscope.histogram.distribution-presets.v1', JSON.stringify([{ id: 'bad', name: 'Bad', metric: 'wat' }]));
    const storage = await import('../../apps/web/src/state/histogram-distribution-storage');
    expect(storage.loadHistogramDistributionPresets()).toEqual([]);
  });
});
''')

(ROOT / 'tests/web/histogram-distribution-csv.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { buildDistributionCsv, distributionCsvFilename } from '../../apps/web/src/pages/histogram-distribution-csv';

describe('Distribution CSV export', () => {
  it('exports shared bin geometry and summary statistics for compared series', () => {
    const result = buildDistributionCsv({
      channelLabel: 'Engine RPM, filtered', unit: 'rpm', metric: 'percent', display: 'histogram', binMode: 'manual',
      rangeMin: 1000, rangeMax: 3000,
      series: [
        { label: 'Primary A/B', binValues: [25, 75], stats: { count: 4, min: 1100, max: 2800, mean: 2000, median: 2050, standardDeviation: 600, p05: 1150, p25: 1500, p75: 2500, p95: 2750 }, inputSampleCount: 5, eligibleSampleCount: 4, rejectedSampleCount: 1 },
        { label: 'Full Log', binValues: [50, 50], stats: { count: 2, min: 1200, max: 2600, mean: 1900, median: 1900, standardDeviation: 700, p05: 1270, p25: 1550, p75: 2250, p95: 2530 }, inputSampleCount: 3, eligibleSampleCount: 2, rejectedSampleCount: 1 },
      ],
    });
    expect(result.binRowCount).toBe(4);
    expect(result.csv).toContain('bin,Primary A/B,"Engine RPM, filtered",rpm,percent,histogram,manual,0,1000,2000,false,25');
    expect(result.csv).toContain('bin,Full Log,"Engine RPM, filtered",rpm,percent,histogram,manual,1,2000,3000,true,50');
    expect(result.csv).toContain('summary,Primary A/B,"Engine RPM, filtered",rpm,percent,histogram,manual,,,,,,4,1100,2800,2000,2050,600');
    expect(result.csv).toContain(',5,4,1');
  });

  it('creates a readable channel filename', () => {
    expect(distributionCsvFilename('Engine RPM / filtered')).toBe('distribution-Engine-RPM-filtered.csv');
  });
});
''')

# Imports and type aliases in Distribution view.
replace_once(
    'apps/web/src/pages/histogram-distribution-view.ts',
    "import type { SavedTimelineRangeState } from '../state/workspace-state';\n",
    "import type { SavedTimelineRangeState } from '../state/workspace-state';\nimport { createHistogramLocalId } from '../state/histogram-table-storage';\nimport { loadHistogramDistributionPresets, saveHistogramDistributionPresets, type HistogramDistributionPresetState } from '../state/histogram-distribution-storage';\nimport { buildDistributionCsv, distributionCsvFilename } from './histogram-distribution-csv';\n",
)
replace_once(
    'apps/web/src/pages/histogram-distribution-view.ts',
    "type DistributionMetric = 'count' | 'percent' | 'time';\ntype DistributionBinMode = 'auto' | 'manual';\ntype DistributionDisplay = 'histogram' | 'cumulative';\n",
    "type DistributionMetric = 'count' | 'percent' | 'time';\ntype DistributionBinMode = 'auto' | 'manual';\ntype DistributionDisplay = 'histogram' | 'cumulative';\n",
)

# State cache.
replace_once(
    'apps/web/src/pages/histogram-distribution-view.ts',
    "  let qualificationSets = loadHistogramQualificationSets();\n",
    "  let qualificationSets = loadHistogramQualificationSets();\n  let distributionPresets = loadHistogramDistributionPresets();\n",
)

# Toolbar additions.
replace_once(
    'apps/web/src/pages/histogram-distribution-view.ts',
    '''      <label class="distribution-compare-toggle"><input type="checkbox" /><span>Compare</span></label>\n    </div>\n''',
    '''      <label class="distribution-compare-toggle"><input type="checkbox" /><span>Compare</span></label>\n      <details class="distribution-presets">\n        <summary title="Saved Distribution setups">Presets</summary>\n        <div class="distribution-preset-popover">\n          <select class="distribution-preset-select" aria-label="Saved Distribution setup"></select>\n          <div class="distribution-preset-actions"><button type="button" class="distribution-preset-apply">Apply</button><button type="button" class="distribution-preset-save">Save setup…</button><button type="button" class="distribution-preset-delete">Delete</button></div>\n          <small>Saved setups retain channel, scope, Qualification, Y axis, bins, view and compare scope.</small>\n        </div>\n      </details>\n      <button type="button" class="distribution-export-csv" disabled>CSV</button>\n    </div>\n''',
)

# Control refs.
replace_once(
    'apps/web/src/pages/histogram-distribution-view.ts',
    "  const compareScopeSelect = root.querySelector<HTMLSelectElement>('.distribution-compare-scope')!;\n  const empty = root.querySelector<HTMLElement>('.distribution-empty')!;\n",
    "  const compareScopeSelect = root.querySelector<HTMLSelectElement>('.distribution-compare-scope')!;\n  const presetSelect = root.querySelector<HTMLSelectElement>('.distribution-preset-select')!;\n  const presetApply = root.querySelector<HTMLButtonElement>('.distribution-preset-apply')!;\n  const presetSave = root.querySelector<HTMLButtonElement>('.distribution-preset-save')!;\n  const presetDelete = root.querySelector<HTMLButtonElement>('.distribution-preset-delete')!;\n  const exportCsvButton = root.querySelector<HTMLButtonElement>('.distribution-export-csv')!;\n  const empty = root.querySelector<HTMLElement>('.distribution-empty')!;\n",
)

# Helpers before range checks.
replace_once(
    'apps/web/src/pages/histogram-distribution-view.ts',
    "  const hasValidCurrentRange = (): boolean => context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;\n",
    r'''  const populatePresetSelect = (preferredId = ''): void => {
    presetSelect.replaceChildren(new Option(distributionPresets.length > 0 ? 'Select saved setup…' : 'No saved setups', ''));
    for (const preset of distributionPresets) presetSelect.add(new Option(preset.name, preset.id));
    presetSelect.value = preferredId && distributionPresets.some((preset) => preset.id === preferredId) ? preferredId : '';
    presetApply.disabled = !presetSelect.value;
    presetDelete.disabled = !presetSelect.value;
  };

  const currentPresetState = (id: string, name: string): HistogramDistributionPresetState => ({
    id,
    name,
    channelId: channelSelect.value,
    scope: scopeSelect.value,
    qualificationId: qualificationSelect.value,
    metric,
    binMode,
    binCount: binCountInput.value,
    display,
    compare,
    compareScope: compareScopeSelect.value,
  });

  const setSelectIfAvailable = (select: HTMLSelectElement, value: string): void => {
    if ([...select.options].some((option) => option.value === value && !option.disabled)) select.value = value;
  };

  const downloadCsv = (csv: string, filename: string): void => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const hasValidCurrentRange = (): boolean => context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs;
''',
)

# Clear stale export at render start and enable after successful render.
replace_once(
    'apps/web/src/pages/histogram-distribution-view.ts',
    "  const render = async (): Promise<void> => {\n    const generation = ++renderGeneration;\n    selectedBin = undefined;\n    binDetail.hidden = true;\n",
    "  const render = async (): Promise<void> => {\n    const generation = ++renderGeneration;\n    selectedBin = undefined;\n    lastSeries = [];\n    exportCsvButton.disabled = true;\n    binDetail.hidden = true;\n",
)
replace_once(
    'apps/web/src/pages/histogram-distribution-view.ts',
    "    renderLegend(series);\n    renderStats(series);\n    renderChart(series, extent.min, extent.max);\n  };\n",
    "    renderLegend(series);\n    renderStats(series);\n    renderChart(series, extent.min, extent.max);\n    exportCsvButton.disabled = false;\n  };\n",
)

# Preset + CSV handlers before ordinary controls.
replace_once(
    'apps/web/src/pages/histogram-distribution-view.ts',
    "  channelSelect.addEventListener('change', () => { void render(); });\n",
    r'''  presetSelect.addEventListener('change', () => {
    presetApply.disabled = !presetSelect.value;
    presetDelete.disabled = !presetSelect.value;
  });
  presetApply.addEventListener('click', () => {
    const preset = distributionPresets.find((candidate) => candidate.id === presetSelect.value);
    if (!preset) return;
    setSelectIfAvailable(channelSelect, preset.channelId);
    setSelectIfAvailable(scopeSelect, preset.scope);
    setSelectIfAvailable(qualificationSelect, preset.qualificationId);
    metric = preset.metric; metricSelect.value = metric;
    binMode = preset.binMode; binModeSelect.value = binMode; binCountInput.value = preset.binCount; binCountInput.hidden = binMode !== 'manual';
    display = preset.display; displaySelect.value = display;
    compare = preset.compare; compareToggle.checked = compare; compareControls.hidden = !compare;
    setSelectIfAvailable(compareScopeSelect, preset.compareScope);
    void render();
  });
  presetSave.addEventListener('click', () => {
    const suggested = distributionPresets.find((candidate) => candidate.id === presetSelect.value)?.name ?? `${channelSelect.selectedOptions[0]?.text ?? 'Distribution'} setup`;
    const name = window.prompt('Distribution setup name', suggested)?.trim();
    if (!name) return;
    const existing = distributionPresets.find((candidate) => candidate.id === presetSelect.value);
    const id = existing?.id ?? createHistogramLocalId('distribution-preset');
    const next = currentPresetState(id, name);
    distributionPresets = existing ? distributionPresets.map((candidate) => candidate.id === id ? next : candidate) : [...distributionPresets, next];
    saveHistogramDistributionPresets(distributionPresets);
    populatePresetSelect(id);
  });
  presetDelete.addEventListener('click', () => {
    const id = presetSelect.value;
    if (!id) return;
    distributionPresets = distributionPresets.filter((candidate) => candidate.id !== id);
    saveHistogramDistributionPresets(distributionPresets);
    populatePresetSelect();
  });
  exportCsvButton.addEventListener('click', () => {
    if (lastSeries.length === 0) return;
    const first = lastSeries[0]!;
    const exported = buildDistributionCsv({
      channelLabel: channelLabel(first.trace),
      unit: first.trace.channel.unit,
      metric,
      display,
      binMode,
      rangeMin: lastRangeMin,
      rangeMax: lastRangeMax,
      series: lastSeries.map((series) => ({
        label: series.label,
        binValues: series.binValues,
        stats: series.stats,
        inputSampleCount: series.qualification.inputSampleCount,
        eligibleSampleCount: series.qualification.eligibleSampleCount,
        rejectedSampleCount: series.qualification.rejectedSampleCount,
      })),
    });
    if (exported.binRowCount === 0) return;
    downloadCsv(exported.csv, distributionCsvFilename(channelLabel(first.trace)));
  });

  channelSelect.addEventListener('change', () => { void render(); });
''',
)

# Initial preset population.
replace_once(
    'apps/web/src/pages/histogram-distribution-view.ts',
    "  populateHistogramQualificationSelect(qualificationSelect, qualificationSets, context.channels);\n  refreshScopeSelectors();\n  return { element: root, setContext, refresh: () => { void render(); } };\n",
    "  populateHistogramQualificationSelect(qualificationSelect, qualificationSets, context.channels);\n  refreshScopeSelectors();\n  populatePresetSelect();\n  return { element: root, setContext, refresh: () => { void render(); } };\n",
)

# CSS popover.
replace_once(
    'apps/web/src/styles/histogram-distribution.css',
    ".distribution-controls button:hover { background: #142938; }\n\n",
    r'''.distribution-controls button:hover { background: #142938; }

.distribution-presets { position: relative; }
.distribution-presets > summary {
  height: 27px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  border: 1px solid #2b4554;
  border-radius: 3px;
  background: #0f1d27;
  color: #dce9ef;
  padding: 0 9px;
  font-size: 10px;
  cursor: pointer;
  list-style: none;
}
.distribution-presets > summary::-webkit-details-marker { display: none; }
.distribution-presets[open] > summary, .distribution-presets > summary:hover { background: #142938; }
.distribution-preset-popover {
  position: absolute;
  z-index: 30;
  top: calc(100% + 4px);
  right: 0;
  width: 350px;
  box-sizing: border-box;
  padding: 8px;
  border: 1px solid #355366;
  border-radius: 4px;
  background: #0a151d;
  box-shadow: 0 8px 22px rgba(0,0,0,.45);
}
.distribution-preset-popover > select { width: 100%; height: 27px; }
.distribution-preset-actions { display: flex; gap: 6px; margin-top: 7px; }
.distribution-preset-actions button { flex: 1 1 auto; }
.distribution-preset-popover small { display: block; margin-top: 7px; color: #8299a6; font-size: 9px; line-height: 1.35; }

''',
)

# Docs: current capability and narrower future work.
replace_once(
    'docs/HISTOGRAM.md',
    '''- optional second scope comparison;\n- one shared bin geometry for both compared scopes;\n- bin → Logger evidence navigation;\n- shared Logger timeline.\n''',
    '''- optional second scope comparison;\n- one shared bin geometry for both compared scopes;\n- saved Distribution setup presets retaining channel, scope, Qualification, metric, bins, view and compare scope;\n- CSV export of shared bin geometry/values plus per-series summary statistics and eligibility provenance;\n- bin → Logger evidence navigation;\n- shared Logger timeline.\n''',
)
replace_once(
    'docs/HISTOGRAM.md',
    '''### Distribution worthwhile future work\n\nUseful remaining improvements include:\n\n- saved view/setup presets;\n- CSV export of bins plus summary statistics;\n- explicit fixed min/max/bin-width geometry for reproducible repeated tests;\n- deeper consolidation around shared histogram-core primitives where that reduces duplicate definitions without changing behavior.\n''',
    '''### Distribution worthwhile future work\n\nThe setup-persistence and export maturity pass is complete. Remaining improvements are narrower:\n\n- explicit fixed min/max/bin-width geometry for reproducible repeated tests;\n- deeper consolidation around shared histogram-core primitives where that reduces duplicate definitions without changing behavior.\n''',
)

replace_once(
    'docs/ROADMAP.md',
    '''Scatter has completed its targeted maturity pass: saved setups, box-region evidence inspection, useful region → Logger navigation and CSV export are implemented. The next Histogram target is **Distribution maturity**.\n\nThe worthwhile remaining gaps are narrower:\n\n1. saved view/setup presets for Distribution;\n2. CSV export of Distribution bins plus summary statistics;\n3. later consolidate dormant duplicate/runtime-refinement code during the dedicated cleanup phase;\n4. replace the remaining Scatter timeline text/DOM bridge during cleanup only if it becomes a correctness or maintenance problem.\n''',
    '''Scatter has completed its targeted maturity pass: saved setups, box-region evidence inspection, useful region → Logger navigation and CSV export are implemented. Distribution has now also completed its setup-persistence/export maturity pass with saved setups and CSV bins/summary export.\n\nThe worthwhile remaining Histogram gaps are narrower:\n\n1. explicit fixed min/max/bin-width Distribution geometry if reproducible repeated-test workflows require it;\n2. later consolidate dormant duplicate/runtime-refinement code during the dedicated cleanup phase;\n3. replace the remaining Scatter timeline text/DOM bridge during cleanup only if it becomes a correctness or maintenance problem.\n''',
)
