from pathlib import Path


def patch(path: str, replacements: list[tuple[str, str]]) -> None:
    p = Path(path)
    s = p.read_text()
    for old, new in replacements:
        if old not in s:
            raise SystemExit(f'{path}: missing pattern: {old[:140]!r}')
        s = s.replace(old, new, 1)
    p.write_text(s)

# Preserve semantic coordinates supplied by non-Lambda adapters.
patch('apps/web/src/pages/ve-table-interaction-dom.ts', [(
'''      const semanticRow = Number(cell.dataset.delayRow);
      const semanticCol = Number(cell.dataset.delayCol);
      cell.dataset.tableRow = Number.isInteger(semanticRow) ? String(semanticRow) : String(row);
      cell.dataset.tableCol = Number.isInteger(semanticCol) ? String(semanticCol) : String(cellIndex - 1);
''',
'''      const semanticRow = Number(cell.dataset.veRow ?? cell.dataset.delayRow);
      const semanticCol = Number(cell.dataset.veCol ?? cell.dataset.delayCol);
      const existingRow = Number(cell.dataset.tableRow);
      const existingCol = Number(cell.dataset.tableCol);
      cell.dataset.tableRow = Number.isInteger(semanticRow) ? String(semanticRow)
        : Number.isInteger(existingRow) ? String(existingRow) : String(row);
      cell.dataset.tableCol = Number.isInteger(semanticCol) ? String(semanticCol)
        : Number.isInteger(existingCol) ? String(existingCol) : String(cellIndex - 1);
''')])

# Cell Evidence becomes an explicit inspector action instead of intercepting normal table selection.
patch('apps/web/src/pages/ve-analyzer-cell-evidence.ts', [(
'''  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const cell = target.closest<HTMLTableCellElement>('[data-ve-analyzer="ve-table-view"] tbody td');
    if (!cell) return;
    // Capture the richer native VE evidence review instead of the legacy title-only popover.
    event.stopPropagation();
    showDetail(cell);
  }, { capture: true });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    if (!(target instanceof HTMLTableCellElement) || !target.closest('[data-ve-analyzer="ve-table-view"]')) return;
    event.preventDefault();
    event.stopPropagation();
    showDetail(target);
  }, { capture: true });
''',
'''  root.addEventListener('ve-cell-evidence-open', (event) => {
    const detail = (event as CustomEvent<{ readonly cell?: HTMLTableCellElement }>).detail;
    const cell = detail?.cell;
    if (!cell || !cell.closest('[data-ve-analyzer="ve-table-view"]')) return;
    showDetail(cell);
  });
''')])

# v2 owns a semantic working/review VE proposal overlay while source MSQ remains immutable.
path = 'apps/web/src/pages/ve-analyzer-view-v2.ts'
p = Path(path)
s = p.read_text()

def r(old: str, new: str) -> None:
    global s
    if old not in s:
        raise SystemExit(f'{path}: missing pattern: {old[:140]!r}')
    s = s.replace(old, new, 1)

r(
"import { registerVeDelayEditOwner, type VeDelayCellValueEdit } from './ve-analyzer-delay-edit-owner';\n",
"import { registerVeDelayEditOwner, type VeDelayCellValueEdit } from './ve-analyzer-delay-edit-owner';\nimport { registerVeProposalEditOwner, type VeProposalCellValueEdit } from './ve-analyzer-proposal-edit-owner';\n")

r(
'''  let selectedDelayCell: { row: number; col: number } | undefined;
  const remembered = new Map<string, string>();
''',
'''  let selectedDelayCell: { row: number; col: number } | undefined;
  let veReviewAuthorityGeneration = 0;
  let veReviewState: {
    readonly key: string;
    readonly model: TuneModel | undefined;
    readonly proposal: VeProposalResult | undefined;
    readonly rows: number;
    readonly cols: number;
    readonly rpmBins: readonly number[];
    readonly loadBins: readonly number[];
    readonly baselineValues: readonly (number | undefined)[];
    readonly values: readonly (number | undefined)[];
    readonly digits: number | undefined;
    readonly authorityGeneration: number;
  } | undefined;
  const remembered = new Map<string, string>();
''')

r(
'''  const evidenceDetail = (cell: VeEvidenceMapResult['cells'][number] | undefined): string => {
    if (!cell || !(cell.totalWeight > 0)) return '';
    const p10 = cell.correctionP10Ratio === undefined ? '—' : formatPercent((cell.correctionP10Ratio - 1) * 100);
    const p90 = cell.correctionP90Ratio === undefined ? '—' : formatPercent((cell.correctionP90Ratio - 1) * 100);
    const spread = cell.correctionSpreadPercent === undefined ? '—' : `${cell.correctionSpreadPercent.toFixed(1)}%`;
    return `Robust median ${formatPercent(cell.correctionPercent)}; P10 ${p10}; P90 ${p90}; spread ${spread}; confidence ${cell.confidence}; weight ${cell.totalWeight.toFixed(3)}; samples ${cell.sampleCount}.`;
  };

  const renderTable = (host: HTMLElement, entry: TuneEntry | undefined, x?: readonly number[], y?: readonly number[], evidence?: VeEvidenceMapResult, proposed?: VeProposalResult): void => {
''',
'''  const evidenceDetail = (cell: VeEvidenceMapResult['cells'][number] | undefined): string => {
    if (!cell || !(cell.totalWeight > 0)) return '';
    const p10 = cell.correctionP10Ratio === undefined ? '—' : formatPercent((cell.correctionP10Ratio - 1) * 100);
    const p90 = cell.correctionP90Ratio === undefined ? '—' : formatPercent((cell.correctionP90Ratio - 1) * 100);
    const spread = cell.correctionSpreadPercent === undefined ? '—' : `${cell.correctionSpreadPercent.toFixed(1)}%`;
    return `Robust median ${formatPercent(cell.correctionPercent)}; P10 ${p10}; P90 ${p90}; spread ${spread}; confidence ${cell.confidence}; weight ${cell.totalWeight.toFixed(3)}; samples ${cell.sampleCount}.`;
  };

  const ensureVeReviewState = () => {
    const entry = tableEntry(tuneModel, select('ve-table')?.value ?? '');
    const rpmBins = axisValues(tuneModel, select('rpm-axis')?.value ?? '');
    const loadBins = axisValues(tuneModel, select('load-axis')?.value ?? '');
    if (!entry?.numericValues || !rpmBins || !loadBins || rpmBins.length !== entry.cols || loadBins.length !== entry.rows) {
      veReviewState = undefined;
      return undefined;
    }
    const key = `${entry.name}|${select('rpm-axis')?.value ?? ''}|${select('load-axis')?.value ?? ''}`;
    if (!veReviewState || veReviewState.key !== key || veReviewState.model !== tuneModel || veReviewState.proposal !== proposal
      || veReviewState.rows !== entry.rows || veReviewState.cols !== entry.cols) {
      const baselineValues = entry.numericValues.map((current, index) => {
        const proposalCell = proposal?.cells[index];
        return proposalCell?.state === 'measured' && proposalCell.proposedValue !== undefined && Number.isFinite(proposalCell.proposedValue)
          ? proposalCell.proposedValue : current;
      });
      veReviewState = {
        key,
        model: tuneModel,
        proposal,
        rows: entry.rows,
        cols: entry.cols,
        rpmBins: [...rpmBins],
        loadBins: [...loadBins],
        baselineValues,
        values: [...baselineValues],
        digits: entry.digits,
        authorityGeneration: ++veReviewAuthorityGeneration,
      };
    }
    return veReviewState;
  };

  const renderTable = (host: HTMLElement, entry: TuneEntry | undefined, x?: readonly number[], y?: readonly number[], evidence?: VeEvidenceMapResult, proposed?: VeProposalResult, workingValues?: readonly (number | undefined)[]): void => {
''')

r(
'''        const td = document.createElement('td'); const index = row * entry.cols + col; const current = entry.numericValues[index];
        if (current !== undefined && Number.isFinite(current)) {
          const proposalCell = proposed?.cells[index]; const main = document.createElement('span');
          main.textContent = proposalCell?.state === 'measured' && proposalCell.proposedValue !== undefined ? formatValue(proposalCell.proposedValue, entry.digits) : formatValue(current, entry.digits);
''',
'''        const td = document.createElement('td'); const index = row * entry.cols + col; const current = entry.numericValues[index];
        td.dataset.veRow = String(row); td.dataset.veCol = String(col);
        td.dataset.tableRow = String(row); td.dataset.tableCol = String(col);
        if (current !== undefined && Number.isFinite(current)) {
          const proposalCell = proposed?.cells[index]; const main = document.createElement('span');
          const shown = workingValues ? workingValues[index]
            : proposalCell?.state === 'measured' && proposalCell.proposedValue !== undefined ? proposalCell.proposedValue : current;
          main.textContent = shown === undefined ? '—' : formatValue(shown, entry.digits);
''')

r(
'''        if (td.title) {
          td.tabIndex = 0;
          td.setAttribute('role', 'button');
          td.setAttribute('aria-label', td.title);
          td.dataset.veHasDetail = 'true';
        }
''',
'''        if (td.title) {
          td.setAttribute('aria-label', td.title);
          td.dataset.veHasDetail = 'true';
        }
''')

r(
'''    renderTable(veHost, ve, axisValues(tuneModel, select('rpm-axis')?.value ?? ''), axisValues(tuneModel, select('load-axis')?.value ?? ''), result, proposal);
''',
'''    const review = ensureVeReviewState();
    renderTable(veHost, ve, axisValues(tuneModel, select('rpm-axis')?.value ?? ''), axisValues(tuneModel, select('load-axis')?.value ?? ''), result, proposal, review?.values);
''')

r(
'''    // Delay rendering belongs to renderDelayDiscovery/readiness.
  };

  const mixtureAssessment = () => {
''',
'''    // Delay rendering belongs to renderDelayDiscovery/readiness.
  };

  const applyVeReviewValues = (edits: readonly VeProposalCellValueEdit[]): boolean => {
    if (!viewActive || pendingContext || pendingTune || edits.length === 0) return false;
    const state = ensureVeReviewState();
    if (!state) return false;
    const next = [...state.values];
    let changed = false;
    const lastByIndex = new Map<number, number | undefined>();
    for (const edit of edits) {
      if (!Number.isInteger(edit.row) || !Number.isInteger(edit.col) || edit.row < 0 || edit.row >= state.rows || edit.col < 0 || edit.col >= state.cols) return false;
      if (edit.value !== undefined && (!Number.isFinite(edit.value) || edit.value < 0)) return false;
      lastByIndex.set(edit.row * state.cols + edit.col, edit.value);
    }
    for (const [index, value] of lastByIndex) {
      if (next[index] === value) continue;
      next[index] = value;
      changed = true;
    }
    if (!changed) return false;
    veReviewState = { ...state, values: next, authorityGeneration: ++veReviewAuthorityGeneration };
    renderTuneTables();
    return true;
  };

  registerVeProposalEditOwner(root, {
    snapshot: () => {
      const state = ensureVeReviewState();
      return state ? {
        revision: sessionRevision,
        authorityGeneration: state.authorityGeneration,
        rows: state.rows,
        cols: state.cols,
        rpmBins: state.rpmBins,
        loadBins: state.loadBins,
        baselineValues: state.baselineValues,
        values: state.values,
        digits: state.digits,
      } : undefined;
    },
    applyValues: applyVeReviewValues,
    revert: (positions) => {
      const state = ensureVeReviewState();
      if (!state) return false;
      return applyVeReviewValues(positions.map(({ row, col }) => ({ row, col, value: state.baselineValues[row * state.cols + col] })));
    },
  });

  const mixtureAssessment = () => {
''')

p.write_text(s)

# Result View proposal presentation consumes current semantic review values.
patch('apps/web/src/pages/ve-analyzer-view-v7.ts', [
("import { veDelayEditOwner } from './ve-analyzer-delay-edit-owner';\n",
 "import { veDelayEditOwner } from './ve-analyzer-delay-edit-owner';\nimport { veProposalEditOwner } from './ve-analyzer-proposal-edit-owner';\n"),
('''    const delaySurface = view === 'delay' ? readDelaySurface(root) : undefined;
    const rendered: Array<{ cell: HTMLTableCellElement; value: number; mode: 'magnitude' | 'quality' | 'range' }> = [];
''',
'''    const delaySurface = view === 'delay' ? readDelaySurface(root) : undefined;
    const proposalSnapshot = view === 'proposal' ? veProposalEditOwner(root)?.snapshot() : undefined;
    const rendered: Array<{ cell: HTMLTableCellElement; value: number; mode: 'magnitude' | 'quality' | 'range' }> = [];
'''),
('''        const metrics = parseVeRenderedCellMetrics(cell.title, current === undefined ? '' : String(current));
        const delayMs = view === 'delay' ? interpolateDelay(delaySurface, rpm, load) : undefined;
        const display = veResultDisplay(metrics, view, delayMs);
        main.textContent = display.text;
''',
'''        if (proposalSnapshot) {
          const semanticRow = Number(cell.dataset.veRow);
          const semanticCol = Number(cell.dataset.veCol);
          if (Number.isInteger(semanticRow) && Number.isInteger(semanticCol)
            && semanticRow >= 0 && semanticRow < proposalSnapshot.rows && semanticCol >= 0 && semanticCol < proposalSnapshot.cols) {
            const working = proposalSnapshot.values[semanticRow * proposalSnapshot.cols + semanticCol];
            main.textContent = working === undefined ? '—' : proposalSnapshot.digits === undefined
              ? String(working) : working.toFixed(proposalSnapshot.digits);
            cell.dataset.veResultValue = working === undefined ? '' : String(working);
            cell.classList.toggle('ve-result-missing', working === undefined);
            restoreBaseLevel(cell);
            continue;
          }
        }

        const metrics = parseVeRenderedCellMetrics(cell.title, current === undefined ? '' : String(current));
        const delayMs = view === 'delay' ? interpolateDelay(delaySurface, rpm, load) : undefined;
        const display = veResultDisplay(metrics, view, delayMs);
        main.textContent = display.text;
'''),
])

# Stable entry installs the shared VE Proposal adapter as another domain adapter over the same core.
patch('apps/web/src/pages/ve-analyzer-view.ts', [
("import { installVeAnalyzerV50Presentation } from './ve-analyzer-v50-presentation';\n",
 "import { installVeAnalyzerV50Presentation } from './ve-analyzer-v50-presentation';\nimport { installVeAnalyzerProposalTableInteraction } from './ve-analyzer-proposal-table-interaction';\n"),
('''  const controller = installVeAnalyzerCellEvidence(createVeAnalyzerViewV9(observability), observability);
  return installVeAnalyzerDelayTableInteraction(installVeAnalyzerV50Presentation(controller));
''',
'''  const controller = installVeAnalyzerCellEvidence(createVeAnalyzerViewV9(observability), observability);
  const presented = installVeAnalyzerV50Presentation(controller);
  const proposalEditing = installVeAnalyzerProposalTableInteraction(presented);
  return installVeAnalyzerDelayTableInteraction(proposalEditing);
'''),
])
