from pathlib import Path

ROOT = Path('.')

def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    if text.count(old) != 1:
        raise SystemExit(f'{path}: expected one anchor, found {text.count(old)}')
    p.write_text(text.replace(old, new, 1))

# New pure CSV builder.
(ROOT / 'apps/web/src/pages/scatter-csv-export.ts').write_text(r'''import type { NumericScatterResult } from '../../../../core/analysis/scatter';

export type ScatterCsvEvidenceKind = 'qualified' | 'region';

export interface ScatterCsvExportOptions {
  readonly result: NumericScatterResult;
  readonly evidenceKind: ScatterCsvEvidenceKind;
  readonly scopeLabel: string;
  readonly qualificationLabel: string;
  readonly xChannelLabel: string;
  readonly xUnit?: string;
  readonly yChannelLabel: string;
  readonly yUnit?: string;
  readonly timeForSampleIndex: (sampleIndex: number) => number | undefined;
  readonly selectedSampleIndices?: ArrayLike<number>;
}

export interface ScatterCsvExportResult {
  readonly csv: string;
  readonly rowCount: number;
}

function quoteCsv(value: string | number): string {
  const text = String(value);
  return /[\",\n\r]/.test(text) ? `\"${text.replace(/\"/g, '\"\"')}\"` : text;
}

export function buildScatterEvidenceCsv(options: ScatterCsvExportOptions): ScatterCsvExportResult {
  const selected = options.selectedSampleIndices
    ? new Set(Array.from(options.selectedSampleIndices, (value) => Number(value)))
    : undefined;
  const rows: string[] = [[
    'evidence_set', 'scope', 'qualification', 'sample_index', 'time_ms', 'time_s',
    'x_channel', 'x_unit', 'x_value', 'y_channel', 'y_unit', 'y_value',
  ].join(',')];
  let rowCount = 0;

  for (let index = 0; index < options.result.validPairSampleCount; index += 1) {
    const sampleIndex = options.result.sampleIndices[index];
    const xValue = options.result.xValues[index];
    const yValue = options.result.yValues[index];
    if (sampleIndex === undefined || xValue === undefined || yValue === undefined) continue;
    if (selected && !selected.has(sampleIndex)) continue;
    const timeMs = options.timeForSampleIndex(sampleIndex);
    const values: (string | number)[] = [
      options.evidenceKind,
      options.scopeLabel,
      options.qualificationLabel || 'None',
      sampleIndex,
      timeMs ?? '',
      timeMs === undefined ? '' : timeMs / 1000,
      options.xChannelLabel,
      options.xUnit ?? '',
      xValue,
      options.yChannelLabel,
      options.yUnit ?? '',
      yValue,
    ];
    rows.push(values.map(quoteCsv).join(','));
    rowCount += 1;
  }

  return { csv: rows.join('\n'), rowCount };
}

export function scatterCsvFilename(xLabel: string, yLabel: string, evidenceKind: ScatterCsvEvidenceKind): string {
  const safe = (value: string): string => value.replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'channel';
  return `scatter-${safe(yLabel)}-vs-${safe(xLabel)}-${evidenceKind}.csv`;
}
''')

# Tests for complete/selected evidence and CSV quoting/provenance.
(ROOT / 'tests/web/scatter-csv-export.test.ts').write_text(r'''import { describe, expect, it } from 'vitest';
import { buildScatterEvidenceCsv, scatterCsvFilename } from '../../apps/web/src/pages/scatter-csv-export';
import type { NumericScatterResult } from '../../core/analysis/scatter';

const result: NumericScatterResult = {
  sampleIndices: Uint32Array.from([10, 11, 15]),
  xValues: Float64Array.from([100, 110, 125]),
  yValues: Float64Array.from([2500, 2800, 3200]),
  inputSampleCount: 4,
  validPairSampleCount: 3,
  invalidSampleCount: 1,
  unavailableSampleCount: 0,
  xMin: 100,
  xMax: 125,
  yMin: 2500,
  yMax: 3200,
};

describe('Scatter CSV evidence export', () => {
  it('exports every qualified valid pair with provenance', () => {
    const exported = buildScatterEvidenceCsv({
      result,
      evidenceKind: 'qualified',
      scopeLabel: 'Current A/B',
      qualificationLabel: 'Steady, warm',
      xChannelLabel: 'MAP, kPa source',
      xUnit: 'kPa',
      yChannelLabel: 'RPM',
      yUnit: 'rpm',
      timeForSampleIndex: (sampleIndex) => sampleIndex * 2,
    });
    expect(exported.rowCount).toBe(3);
    expect(exported.csv.split('\n')).toHaveLength(4);
    expect(exported.csv).toContain('qualified,Current A/B,"Steady, warm",10,20,0.02,"MAP, kPa source",kPa,100,RPM,rpm,2500');
    expect(exported.csv).toContain('15,30,0.03');
  });

  it('exports only source samples inside the selected region', () => {
    const exported = buildScatterEvidenceCsv({
      result,
      evidenceKind: 'region',
      scopeLabel: 'Full Log',
      qualificationLabel: '',
      xChannelLabel: 'MAP',
      yChannelLabel: 'RPM',
      timeForSampleIndex: () => undefined,
      selectedSampleIndices: Uint32Array.from([11, 15]),
    });
    expect(exported.rowCount).toBe(2);
    expect(exported.csv).not.toContain(',10,,');
    expect(exported.csv).toContain('region,Full Log,None,11,,,MAP,,110,RPM,,2800');
    expect(exported.csv).toContain('region,Full Log,None,15,,,MAP,,125,RPM,,3200');
  });

  it('creates bounded readable filenames', () => {
    expect(scatterCsvFilename('MAP kPa', 'Engine RPM', 'region')).toBe('scatter-Engine-RPM-vs-MAP-kPa-region.csv');
  });
});
''')

# Scatter UI import.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "import { loadHistogramScatterPresets, saveHistogramScatterPresets, type HistogramScatterPresetState } from '../state/histogram-scatter-storage';\n",
    "import { loadHistogramScatterPresets, saveHistogramScatterPresets, type HistogramScatterPresetState } from '../state/histogram-scatter-storage';\nimport { buildScatterEvidenceCsv, scatterCsvFilename, type ScatterCsvEvidenceKind } from './scatter-csv-export';\n",
)

# Global toolbar export popover.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    '''      <details class="scatter-presets">\n        <summary title="Saved Scatter setups">Presets</summary>\n        <div class="scatter-preset-popover">\n          <select class="scatter-preset-select" aria-label="Saved Scatter setup"></select>\n          <div class="scatter-preset-actions"><button type="button" class="scatter-preset-apply">Apply</button><button type="button" class="scatter-preset-save">Save setup…</button><button type="button" class="scatter-preset-delete">Delete</button></div>\n          <small>Saved setups retain scope, Qualification, layout, trace mode and both panes' X/Y channels.</small>\n        </div>\n      </details>\n      <span class="scatter-scope-note"></span>\n''',
    '''      <details class="scatter-presets">\n        <summary title="Saved Scatter setups">Presets</summary>\n        <div class="scatter-preset-popover">\n          <select class="scatter-preset-select" aria-label="Saved Scatter setup"></select>\n          <div class="scatter-preset-actions"><button type="button" class="scatter-preset-apply">Apply</button><button type="button" class="scatter-preset-save">Save setup…</button><button type="button" class="scatter-preset-delete">Delete</button></div>\n          <small>Saved setups retain scope, Qualification, layout, trace mode and both panes' X/Y channels.</small>\n        </div>\n      </details>\n      <details class="scatter-export">\n        <summary title="Export Scatter evidence">CSV</summary>\n        <div class="scatter-export-popover">\n          <label><span>Pane</span><select class="scatter-export-pane"><option value="0">A</option><option value="1">B</option></select></label>\n          <div class="scatter-export-actions"><button type="button" class="scatter-export-all">All qualified pairs</button><button type="button" class="scatter-export-region">Selected region</button></div>\n          <small>Exports source sample/time provenance plus X/Y values for the selected pane. Region export uses the complete selected pair population, not rendered point stride.</small>\n        </div>\n      </details>\n      <span class="scatter-scope-note"></span>\n''',
)

# Query controls and guard.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "  const presetDelete = root.querySelector<HTMLButtonElement>('.scatter-preset-delete');\n  const scopeNote = root.querySelector<HTMLElement>('.scatter-scope-note');\n",
    "  const presetDelete = root.querySelector<HTMLButtonElement>('.scatter-preset-delete');\n  const exportPaneSelect = root.querySelector<HTMLSelectElement>('.scatter-export-pane');\n  const exportAllCsv = root.querySelector<HTMLButtonElement>('.scatter-export-all');\n  const exportRegionCsv = root.querySelector<HTMLButtonElement>('.scatter-export-region');\n  const scopeNote = root.querySelector<HTMLElement>('.scatter-scope-note');\n",
)
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "  if (!scopeSelect || !qualificationSelect || !layoutSelect || !traceModeSelect || !presetSelect || !presetApply || !presetSave || !presetDelete || !scopeNote || !empty || !content || !paneHost) {\n",
    "  if (!scopeSelect || !qualificationSelect || !layoutSelect || !traceModeSelect || !presetSelect || !presetApply || !presetSave || !presetDelete || !exportPaneSelect || !exportAllCsv || !exportRegionCsv || !scopeNote || !empty || !content || !paneHost) {\n",
)

# Add export helpers after pane creation.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "  const panes: ScatterPaneState[] = [createPane('A'), createPane('B')];\n  paneHost.append(panes[0]!.root, panes[1]!.root);\n\n",
    r'''  const panes: ScatterPaneState[] = [createPane('A'), createPane('B')];
  paneHost.append(panes[0]!.root, panes[1]!.root);

  const exportPane = (): ScatterPaneState => panes[exportPaneSelect.value === '1' && layout === 'dual' ? 1 : 0]!;

  const updateExportActions = (): void => {
    const optionB = [...exportPaneSelect.options].find((option) => option.value === '1');
    if (optionB) optionB.disabled = layout !== 'dual';
    if (layout !== 'dual' && exportPaneSelect.value === '1') exportPaneSelect.value = '0';
    const pane = exportPane();
    exportAllCsv.disabled = !pane.result || pane.result.validPairSampleCount === 0 || !pane.xTrace || !pane.yTrace;
    exportRegionCsv.disabled = !pane.selectedRegion || pane.selectedRegion.selection.selectedPairCount === 0 || !pane.result || !pane.xTrace || !pane.yTrace;
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

  const exportEvidence = (kind: ScatterCsvEvidenceKind): void => {
    const pane = exportPane();
    const result = pane.result;
    const xTrace = pane.xTrace;
    const yTrace = pane.yTrace;
    if (!result || !xTrace || !yTrace) return;
    const region = kind === 'region' ? pane.selectedRegion : undefined;
    if (kind === 'region' && (!region || region.selection.selectedPairCount === 0)) return;
    const resolvedScope = resolveScope();
    const qualificationLabel = qualificationSelect.selectedOptions[0]?.text ?? 'None';
    const exported = buildScatterEvidenceCsv({
      result,
      evidenceKind: kind,
      scopeLabel: resolvedScope?.label ?? scopeSelect.selectedOptions[0]?.text ?? 'Unknown',
      qualificationLabel,
      xChannelLabel: channelLabel(xTrace),
      xUnit: xTrace.channel.unit,
      yChannelLabel: channelLabel(yTrace),
      yUnit: yTrace.channel.unit,
      timeForSampleIndex: (sampleIndex) => sampleTime(xTrace, sampleIndex),
      selectedSampleIndices: region?.selection.sampleIndices,
    });
    if (exported.rowCount === 0) return;
    downloadCsv(exported.csv, scatterCsvFilename(channelLabel(xTrace), channelLabel(yTrace), kind));
  };

''',
)

# syncLayout also refreshes export availability.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "  const syncLayout = (): void => {\n    panes[1]!.root.hidden = layout !== 'dual';\n    paneHost.classList.toggle('scatter-panes--dual', layout === 'dual');\n  };\n",
    "  const syncLayout = (): void => {\n    panes[1]!.root.hidden = layout !== 'dual';\n    paneHost.classList.toggle('scatter-panes--dual', layout === 'dual');\n    updateExportActions();\n  };\n",
)

# Refresh export enablement after a full render.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "    }));\n  };\n\n  const refreshCanvasOnly = (): void => {\n",
    "    }));\n    updateExportActions();\n  };\n\n  const refreshCanvasOnly = (): void => {\n",
)

# Selection detail also refreshes selected-region export availability.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "      pane.regionCard.hidden = false;\n      pane.pointDetail.hidden = true;\n      return;\n",
    "      pane.regionCard.hidden = false;\n      pane.pointDetail.hidden = true;\n      updateExportActions();\n      return;\n",
)
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "    pane.regionCard.hidden = true;\n    const index = pane.selectedResultIndex;\n",
    "    pane.regionCard.hidden = true;\n    updateExportActions();\n    const index = pane.selectedResultIndex;\n",
)

# Clear handlers update export state.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "      pane.pointDetail.hidden = true;\n      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);\n    });\n    pane.regionClear.addEventListener('click', () => {\n",
    "      pane.pointDetail.hidden = true;\n      updateExportActions();\n      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);\n    });\n    pane.regionClear.addEventListener('click', () => {\n",
)
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "      pane.selectedRegion = undefined;\n      pane.regionCard.hidden = true;\n      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);\n    });\n    pane.regionOpenLogger.addEventListener('click', () => {\n",
    "      pane.selectedRegion = undefined;\n      pane.regionCard.hidden = true;\n      updateExportActions();\n      if (pane.result && pane.xTrace && pane.yTrace) renderPane(pane, pane.result, pane.xTrace, pane.yTrace);\n    });\n    pane.regionOpenLogger.addEventListener('click', () => {\n",
)

# Export handlers near preset controls.
replace_once(
    'apps/web/src/pages/scatter-view.ts',
    "  presetDelete.addEventListener('click', () => {\n    const id = presetSelect.value;\n    if (!id) return;\n    scatterPresets = scatterPresets.filter((candidate) => candidate.id !== id);\n    saveHistogramScatterPresets(scatterPresets);\n    populatePresetSelect();\n  });\n\n  scopeSelect.addEventListener('change', () => {\n",
    "  presetDelete.addEventListener('click', () => {\n    const id = presetSelect.value;\n    if (!id) return;\n    scatterPresets = scatterPresets.filter((candidate) => candidate.id !== id);\n    saveHistogramScatterPresets(scatterPresets);\n    populatePresetSelect();\n  });\n  exportPaneSelect.addEventListener('change', updateExportActions);\n  exportAllCsv.addEventListener('click', () => exportEvidence('qualified'));\n  exportRegionCsv.addEventListener('click', () => exportEvidence('region'));\n\n  scopeSelect.addEventListener('change', () => {\n",
)

# CSS: share preset popover treatment with export popover.
replace_once(
    'apps/web/src/styles/scatter-mlv.css',
    ".scatter-presets { position: relative; }\n.scatter-presets > summary {\n",
    ".scatter-presets,\n.scatter-export { position: relative; }\n.scatter-presets > summary,\n.scatter-export > summary {\n",
)
replace_once(
    'apps/web/src/styles/scatter-mlv.css',
    ".scatter-presets > summary::-webkit-details-marker { display: none; }\n.scatter-presets[open] > summary, .scatter-presets > summary:hover { background: #142938; }\n.scatter-preset-popover {\n",
    ".scatter-presets > summary::-webkit-details-marker,\n.scatter-export > summary::-webkit-details-marker { display: none; }\n.scatter-presets[open] > summary, .scatter-presets > summary:hover,\n.scatter-export[open] > summary, .scatter-export > summary:hover { background: #142938; }\n.scatter-preset-popover,\n.scatter-export-popover {\n",
)
replace_once(
    'apps/web/src/styles/scatter-mlv.css',
    ".scatter-preset-popover > select { width: 100%; height: 27px; }\n.scatter-preset-actions { display: flex; gap: 6px; margin-top: 7px; }\n.scatter-preset-actions button { flex: 1 1 auto; }\n.scatter-preset-popover small { display: block; margin-top: 7px; color: #8299a6; font-size: 9px; line-height: 1.35; }\n",
    ".scatter-preset-popover > select { width: 100%; height: 27px; }\n.scatter-preset-actions, .scatter-export-actions { display: flex; gap: 6px; margin-top: 7px; }\n.scatter-preset-actions button, .scatter-export-actions button { flex: 1 1 auto; }\n.scatter-preset-popover small, .scatter-export-popover small { display: block; margin-top: 7px; color: #8299a6; font-size: 9px; line-height: 1.35; }\n.scatter-export-popover { width: 360px; }\n.scatter-export-popover label { display: flex; justify-content: space-between; gap: 8px; }\n.scatter-export-popover label > select { width: 90px; }\n",
)

# Docs close Scatter maturity after CSV export.
hist = ROOT / 'docs/HISTOGRAM.md'
text = hist.read_text()
old = '''- selected-region → Logger navigation focused on the strongest contiguous visit instead of the full first-to-last hit envelope;\n- shared Logger timeline.\n\n### Scatter worthwhile future work\n\nThe initial richer evidence-selection slice is complete with box selection. Useful later additions include:\n\n- saved view/setup presets;\n- CSV export of selected/all X/Y evidence;\n- optional compact correlation/linear-fit summary where genuinely useful;\n- replacement of the remaining timeline text/DOM bridge with direct shared state propagation.\n\nThe timeline-state replacement belongs with the planned cleanup/consolidation work unless it becomes a correctness problem earlier.\n'''
new = '''- selected-region → Logger navigation focused on the strongest contiguous visit instead of the full first-to-last hit envelope;\n- saved view/setup presets covering scope, Qualification, layout, trace mode and pane X/Y selections;\n- CSV export of all qualified pairs or the complete selected-region evidence, including source sample/time provenance;\n- shared Logger timeline.\n\n### Scatter maturity checkpoint\n\nThe planned Scatter maturity track is complete at this checkpoint. Further statistical overlays such as correlation/linear-fit summaries are intentionally not part of the active plan. The remaining timeline text/DOM bridge may be replaced during later cleanup/consolidation if it becomes a correctness or maintenance problem.\n'''
if text.count(old) != 1: raise SystemExit('HISTOGRAM Scatter future-work anchor mismatch')
hist.write_text(text.replace(old, new, 1))

road = ROOT / 'docs/ROADMAP.md'
text = road.read_text()
old = '''### Remaining Histogram work\n\nThe worthwhile remaining gaps are narrower:\n\n1. saved setups/presets for Distribution and Scatter;\n2. exports for Distribution and Scatter;\n3. richer Scatter region/box/lasso selection with evidence → Logger;\n4. eventually replace the remaining Scatter timeline text/DOM bridge with direct shared state propagation;\n5. later consolidate dormant duplicate/runtime-refinement code during the dedicated cleanup phase.\n\nDo **not** start another broad Histogram rewrite.\n'''
new = '''### Remaining Histogram work\n\nScatter has completed its targeted maturity pass: saved setups, box-region evidence inspection, useful region → Logger navigation and CSV export are implemented. The next Histogram target is **Distribution maturity**.\n\nThe worthwhile remaining gaps are narrower:\n\n1. saved view/setup presets for Distribution;\n2. CSV export of Distribution bins plus summary statistics;\n3. later consolidate dormant duplicate/runtime-refinement code during the dedicated cleanup phase;\n4. replace the remaining Scatter timeline text/DOM bridge during cleanup only if it becomes a correctness or maintenance problem.\n\nDo **not** start another broad Histogram rewrite.\n'''
if text.count(old) != 1: raise SystemExit('ROADMAP Remaining Histogram anchor mismatch')
road.write_text(text.replace(old, new, 1))
