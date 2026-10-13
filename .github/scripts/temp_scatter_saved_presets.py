from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor not found in {path}: {old[:120]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'anchor not unique in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# Dedicated, validated Scatter preset storage.
Path('apps/web/src/state/histogram-scatter-storage.ts').write_text("""export type HistogramScatterLayout = 'single' | 'dual';
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
""")

# Scatter imports and state.
replace_once(
  'apps/web/src/pages/scatter-view.ts',
  "} from './histogram-qualification';\n",
  "} from './histogram-qualification';\nimport { createHistogramLocalId } from '../state/histogram-table-storage';\nimport { loadHistogramScatterPresets, saveHistogramScatterPresets, type HistogramScatterPresetState } from '../state/histogram-scatter-storage';\n"
)
replace_once(
  'apps/web/src/pages/scatter-view.ts',
  "  let qualificationSets = loadHistogramQualificationSets();\n",
  "  let qualificationSets = loadHistogramQualificationSets();\n  let scatterPresets = loadHistogramScatterPresets();\n"
)

# Toolbar UI.
replace_once(
  'apps/web/src/pages/scatter-view.ts',
  "      <label><span>Trace</span><select class=\"scatter-trace-mode\"><option value=\"dots\">Dots</option><option value=\"lines\">Lines</option></select></label>\n      <span class=\"scatter-scope-note\"></span>\n",
  "      <label><span>Trace</span><select class=\"scatter-trace-mode\"><option value=\"dots\">Dots</option><option value=\"lines\">Lines</option></select></label>\n      <details class=\"scatter-presets\">\n        <summary title=\"Saved Scatter setups\">Presets</summary>\n        <div class=\"scatter-preset-popover\">\n          <select class=\"scatter-preset-select\" aria-label=\"Saved Scatter setup\"></select>\n          <div class=\"scatter-preset-actions\"><button type=\"button\" class=\"scatter-preset-apply\">Apply</button><button type=\"button\" class=\"scatter-preset-save\">Save setup…</button><button type=\"button\" class=\"scatter-preset-delete\">Delete</button></div>\n          <small>Saved setups retain scope, Qualification, layout, trace mode and both panes' X/Y channels.</small>\n        </div>\n      </details>\n      <span class=\"scatter-scope-note\"></span>\n"
)
replace_once(
  'apps/web/src/pages/scatter-view.ts',
  "  const traceModeSelect = root.querySelector<HTMLSelectElement>('.scatter-trace-mode');\n  const scopeNote = root.querySelector<HTMLElement>('.scatter-scope-note');\n",
  "  const traceModeSelect = root.querySelector<HTMLSelectElement>('.scatter-trace-mode');\n  const presetSelect = root.querySelector<HTMLSelectElement>('.scatter-preset-select');\n  const presetApply = root.querySelector<HTMLButtonElement>('.scatter-preset-apply');\n  const presetSave = root.querySelector<HTMLButtonElement>('.scatter-preset-save');\n  const presetDelete = root.querySelector<HTMLButtonElement>('.scatter-preset-delete');\n  const scopeNote = root.querySelector<HTMLElement>('.scatter-scope-note');\n"
)
replace_once(
  'apps/web/src/pages/scatter-view.ts',
  "  if (!scopeSelect || !qualificationSelect || !layoutSelect || !traceModeSelect || !scopeNote || !empty || !content || !paneHost) {\n",
  "  if (!scopeSelect || !qualificationSelect || !layoutSelect || !traceModeSelect || !presetSelect || !presetApply || !presetSave || !presetDelete || !scopeNote || !empty || !content || !paneHost) {\n"
)

# Preset helpers after pane construction.
replace_once(
  'apps/web/src/pages/scatter-view.ts',
  "  const panes: ScatterPaneState[] = [createPane('A'), createPane('B')];\n  paneHost.append(panes[0]!.root, panes[1]!.root);\n\n  const hasValidRange",
  "  const panes: ScatterPaneState[] = [createPane('A'), createPane('B')];\n  paneHost.append(panes[0]!.root, panes[1]!.root);\n\n  const populatePresetSelect = (preferredId = ''): void => {\n    presetSelect.replaceChildren(new Option(scatterPresets.length > 0 ? 'Select saved setup…' : 'No saved setups', ''));\n    for (const preset of scatterPresets) presetSelect.add(new Option(preset.name, preset.id));\n    presetSelect.value = preferredId && scatterPresets.some((preset) => preset.id === preferredId) ? preferredId : '';\n    presetApply.disabled = !presetSelect.value;\n    presetDelete.disabled = !presetSelect.value;\n  };\n\n  const currentPresetState = (id: string, name: string): HistogramScatterPresetState => ({\n    id, name, scope: scopeSelect.value, qualificationId: qualificationSelect.value, layout, traceMode,\n    paneAXChannelId: panes[0]!.xSelect.value, paneAYChannelId: panes[0]!.ySelect.value,\n    paneBXChannelId: panes[1]!.xSelect.value, paneBYChannelId: panes[1]!.ySelect.value,\n  });\n\n  const setSelectIfAvailable = (select: HTMLSelectElement, value: string): void => {\n    if ([...select.options].some((option) => option.value === value && !option.disabled)) select.value = value;\n  };\n\n  const hasValidRange"
)

# Preset listeners before scope listener block.
replace_once(
  'apps/web/src/pages/scatter-view.ts',
  "  scopeSelect.addEventListener('change', () => {\n",
  "  presetSelect.addEventListener('change', () => { presetApply.disabled = !presetSelect.value; presetDelete.disabled = !presetSelect.value; });\n  presetApply.addEventListener('click', () => {\n    const preset = scatterPresets.find((candidate) => candidate.id === presetSelect.value);\n    if (!preset) return;\n    setSelectIfAvailable(scopeSelect, preset.scope);\n    setSelectIfAvailable(qualificationSelect, preset.qualificationId);\n    layout = preset.layout; layoutSelect.value = layout; syncLayout();\n    traceMode = preset.traceMode; traceModeSelect.value = traceMode;\n    setSelectIfAvailable(panes[0]!.xSelect, preset.paneAXChannelId);\n    setSelectIfAvailable(panes[0]!.ySelect, preset.paneAYChannelId);\n    setSelectIfAvailable(panes[1]!.xSelect, preset.paneBXChannelId);\n    setSelectIfAvailable(panes[1]!.ySelect, preset.paneBYChannelId);\n    void render();\n  });\n  presetSave.addEventListener('click', () => {\n    const suggested = scatterPresets.find((candidate) => candidate.id === presetSelect.value)?.name ?? `${panes[0]!.ySelect.selectedOptions[0]?.text ?? 'Y'} vs ${panes[0]!.xSelect.selectedOptions[0]?.text ?? 'X'}`;\n    const name = window.prompt('Scatter setup name', suggested)?.trim();\n    if (!name) return;\n    const existing = scatterPresets.find((candidate) => candidate.id === presetSelect.value);\n    const id = existing?.id ?? createHistogramLocalId('scatter-preset');\n    const next = currentPresetState(id, name);\n    scatterPresets = existing ? scatterPresets.map((candidate) => candidate.id === id ? next : candidate) : [...scatterPresets, next];\n    saveHistogramScatterPresets(scatterPresets);\n    populatePresetSelect(id);\n  });\n  presetDelete.addEventListener('click', () => {\n    const id = presetSelect.value;\n    if (!id) return;\n    scatterPresets = scatterPresets.filter((candidate) => candidate.id !== id);\n    saveHistogramScatterPresets(scatterPresets);\n    populatePresetSelect();\n  });\n\n  scopeSelect.addEventListener('change', () => {\n"
)

# Initialize preset UI near existing initializers.
replace_once(
  'apps/web/src/pages/scatter-view.ts',
  "  populateScopeOptions();\n  populateHistogramQualificationSelect(qualificationSelect, qualificationSets, context.channels);\n  syncLayout();\n",
  "  populateScopeOptions();\n  populateHistogramQualificationSelect(qualificationSelect, qualificationSets, context.channels);\n  populatePresetSelect();\n  syncLayout();\n"
)

# CSS.
replace_once(
  'apps/web/src/styles/scatter-mlv.css',
  ".scatter-scope { width: clamp(120px, 18vw, 230px); }\n",
  ".scatter-presets { position: relative; }\n.scatter-presets > summary {\n  height: 27px;\n  box-sizing: border-box;\n  display: flex;\n  align-items: center;\n  border: 1px solid #2b4554;\n  border-radius: 3px;\n  background: #0f1d27;\n  color: #dce9ef;\n  padding: 0 9px;\n  font-size: 10px;\n  cursor: pointer;\n  list-style: none;\n}\n.scatter-presets > summary::-webkit-details-marker { display: none; }\n.scatter-presets[open] > summary, .scatter-presets > summary:hover { background: #142938; }\n.scatter-preset-popover {\n  position: absolute;\n  z-index: 20;\n  top: calc(100% + 4px);\n  right: 0;\n  width: 340px;\n  box-sizing: border-box;\n  padding: 8px;\n  border: 1px solid #355366;\n  border-radius: 4px;\n  background: #0a151d;\n  box-shadow: 0 8px 22px rgba(0,0,0,.45);\n}\n.scatter-preset-popover > select { width: 100%; height: 27px; }\n.scatter-preset-actions { display: flex; gap: 6px; margin-top: 7px; }\n.scatter-preset-actions button { flex: 1 1 auto; }\n.scatter-preset-popover small { display: block; margin-top: 7px; color: #8299a6; font-size: 9px; line-height: 1.35; }\n\n.scatter-scope { width: clamp(120px, 18vw, 230px); }\n"
)

# Documentation.
replace_once(
  'docs/HISTOGRAM.md',
  "- Dots/Lines presentation;\n",
  "- Dots/Lines presentation;\n- saved Scatter setup presets retaining scope, Qualification, layout, trace mode and both panes' X/Y selections;\n"
)
replace_once(
  'docs/HISTOGRAM.md',
  "- saved view/setup presets;\n- CSV export of selected/all X/Y evidence;\n",
  "- CSV export of selected/all X/Y evidence;\n"
)

# Storage regression tests.
Path('tests/web/histogram-scatter-storage.test.ts').write_text("""import { beforeEach, describe, expect, it, vi } from 'vitest';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
  clear(): void { this.values.clear(); }
}

describe('Histogram Scatter preset storage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('localStorage', new MemoryStorage());
  });

  it('round-trips valid Scatter setups', async () => {
    const storage = await import('../../apps/web/src/state/histogram-scatter-storage');
    const preset = {
      id: 'scatter-preset-1', name: 'Boost response', scope: 'full', qualificationId: 'q-1',
      layout: 'dual' as const, traceMode: 'lines' as const,
      paneAXChannelId: 'rpm', paneAYChannelId: 'map', paneBXChannelId: 'tps', paneBYChannelId: 'lambda',
    };
    expect(storage.saveHistogramScatterPresets([preset])).toBe(true);
    expect(storage.loadHistogramScatterPresets()).toEqual([preset]);
  });

  it('rejects malformed stored setups', async () => {
    localStorage.setItem('epicscope.histogram.scatter-presets.v1', JSON.stringify([{ id: 'bad', name: 'Bad', layout: 'grid', traceMode: 'dots' }]));
    const storage = await import('../../apps/web/src/state/histogram-scatter-storage');
    expect(storage.loadHistogramScatterPresets()).toEqual([]);
  });
});
""")
