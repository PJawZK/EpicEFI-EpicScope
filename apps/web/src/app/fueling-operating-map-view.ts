import { addInlineHelpButton, showInlineHelpPopover } from '../components/inline-help';

type HeatmapMode = 'error' | 'evidence';

interface ParsedPoint {
  readonly rpmBin: string;
  readonly loadBin: string;
  readonly stableSamples: number;
  readonly actualMixture: number | undefined;
  readonly targetMixture: number | undefined;
  readonly errorMean: number | undefined;
  readonly mae: number | undefined;
  readonly evidence: 'weak' | 'moderate' | 'strong';
  readonly bias: string;
}

const INSTALLED = new WeakSet<HTMLElement>();

function numeric(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const match = text.replace(/,/g, '').replace(/−/g, '-').match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : undefined;
}

function headerIndex(table: HTMLTableElement, label: string): number {
  return [...(table.tHead?.rows[0]?.cells ?? [])].findIndex((cell) => cell.textContent?.trim() === label);
}

function cellText(row: HTMLTableRowElement, index: number): string {
  return index >= 0 ? row.cells[index]?.textContent?.trim() ?? '' : '';
}

function parsePoints(table: HTMLTableElement): ParsedPoint[] {
  const rpmIndex = headerIndex(table, 'RPM bin');
  const loadIndex = headerIndex(table, 'Load bin');
  const stableIndex = headerIndex(table, 'Stable samples');
  const samplesIndex = stableIndex >= 0 ? stableIndex : headerIndex(table, 'Samples');
  const actualIndex = headerIndex(table, 'Actual mixture');
  const targetIndex = headerIndex(table, 'Target mixture');
  const errorIndex = headerIndex(table, 'Error mean');
  const maeIndex = headerIndex(table, 'MAE');
  const evidenceIndex = headerIndex(table, 'Evidence');
  const biasIndex = headerIndex(table, 'Bias');
  if (rpmIndex < 0 || loadIndex < 0 || samplesIndex < 0 || errorIndex < 0) return [];

  const points: ParsedPoint[] = [];
  for (const row of [...(table.tBodies[0]?.rows ?? [])]) {
    if (row.dataset.analyzerEmptyState === 'true') continue;
    const rpmBin = cellText(row, rpmIndex);
    const loadBin = cellText(row, loadIndex);
    const samples = numeric(cellText(row, samplesIndex));
    const evidenceText = cellText(row, evidenceIndex).toLowerCase();
    if (!rpmBin || !loadBin || samples === undefined) continue;
    const evidence: ParsedPoint['evidence'] = evidenceText === 'strong' ? 'strong' : evidenceText === 'moderate' ? 'moderate' : 'weak';
    points.push({
      rpmBin,
      loadBin,
      stableSamples: samples,
      actualMixture: numeric(cellText(row, actualIndex)),
      targetMixture: numeric(cellText(row, targetIndex)),
      errorMean: numeric(cellText(row, errorIndex)),
      mae: numeric(cellText(row, maeIndex)),
      evidence,
      bias: cellText(row, biasIndex) || 'Unknown',
    });
  }
  return points;
}

function binStart(label: string): number {
  return numeric(label) ?? Number.POSITIVE_INFINITY;
}

function mixtureScale(view: HTMLElement): 'lambda' | 'afr' | 'unknown' {
  for (const item of view.querySelectorAll<HTMLElement>('.specialized-analyzer-summary > div')) {
    const label = item.querySelector<HTMLElement>(':scope > span')?.textContent?.trim();
    if (label !== 'Mixture scale') continue;
    const value = item.querySelector<HTMLElement>(':scope > strong')?.textContent?.trim().toLowerCase() ?? '';
    if (value.includes('lambda')) return 'lambda';
    if (value.includes('afr')) return 'afr';
  }
  return 'unknown';
}

function errorDeadband(view: HTMLElement): number {
  const input = view.querySelector<HTMLInputElement>('input[data-option="deadband"]');
  const explicit = Number(input?.value);
  if (input?.value.trim() && Number.isFinite(explicit) && explicit >= 0) return explicit;
  return mixtureScale(view) === 'lambda' ? 0.015 : 0.2;
}

function errorClass(error: number | undefined, deadband: number): string {
  if (error === undefined) return 'fueling-heatmap-cell--unknown';
  if (Math.abs(error) <= deadband) return 'fueling-heatmap-cell--band';
  const magnitude = deadband > 0 ? Math.abs(error) / deadband : Math.abs(error);
  const level = magnitude >= 4 ? 3 : magnitude >= 2 ? 2 : 1;
  return error > 0 ? `fueling-heatmap-cell--lean-${level}` : `fueling-heatmap-cell--rich-${level}`;
}

function evidenceClass(evidence: ParsedPoint['evidence']): string {
  return `fueling-heatmap-cell--evidence-${evidence}`;
}

function numberText(value: number | undefined): string {
  if (value === undefined) return '—';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  return value.toFixed(3).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function signed(value: number | undefined): string {
  const text = numberText(value);
  return value !== undefined && value > 0 ? `+${text}` : text;
}

function detailText(point: ParsedPoint, scale: 'lambda' | 'afr' | 'unknown'): string {
  const unit = scale === 'lambda' ? ' λ' : scale === 'afr' ? ' AFR' : '';
  const evidence = point.evidence[0]!.toUpperCase() + point.evidence.slice(1);
  return `${point.bias} · error ${signed(point.errorMean)}${unit} · ${point.stableSamples.toLocaleString()} stable samples · ${evidence} evidence`;
}

function ensureStructure(section: HTMLElement): {
  heatmap: HTMLElement;
  grid: HTMLElement;
  mode: HTMLSelectElement;
  details: HTMLElement;
  detailTitle: HTMLElement;
  detailText: HTMLElement;
} {
  let heatmap = section.querySelector<HTMLElement>(':scope > .fueling-operating-heatmap');
  if (!heatmap) {
    heatmap = document.createElement('div');
    heatmap.className = 'fueling-operating-heatmap';
    heatmap.innerHTML = `
      <div class="fueling-operating-heatmap-toolbar">
        <div><strong>Operating map</strong><span class="fueling-operating-heatmap-help-host"></span></div>
        <label><span>View</span><select class="fueling-operating-heatmap-mode"><option value="error">Mixture error</option><option value="evidence">Evidence strength</option></select></label>
      </div>
      <div class="fueling-operating-heatmap-legend" aria-live="polite"></div>
      <div class="fueling-operating-heatmap-scroll"><div class="fueling-operating-heatmap-grid"></div></div>
      <div class="fueling-operating-heatmap-detail" hidden><strong></strong><span></span></div>
    `;
    const wrap = section.querySelector<HTMLElement>(':scope > .specialized-analyzer-table-wrap');
    section.insertBefore(heatmap, wrap ?? null);
    if (wrap) {
      const disclosure = document.createElement('details');
      disclosure.className = 'fueling-operating-map-table-details';
      const summary = document.createElement('summary');
      summary.textContent = 'Detailed operating-point table';
      wrap.replaceWith(disclosure);
      disclosure.append(summary, wrap);
    }
    const helpHost = heatmap.querySelector<HTMLElement>('.fueling-operating-heatmap-help-host');
    if (helpHost) addInlineHelpButton(helpHost, {
      title: 'Fueling operating map',
      text: 'A compact RPM × load overview of the same steady-state evidence in the detailed table. Mixture error shows lean/rich direction and magnitude relative to the configured deadband. Evidence strength shows how much window-stable evidence supports each populated cell. Click a cell to inspect its key values without expanding the full table.',
    }, showInlineHelpPopover);
  }
  return {
    heatmap,
    grid: heatmap.querySelector<HTMLElement>('.fueling-operating-heatmap-grid')!,
    mode: heatmap.querySelector<HTMLSelectElement>('.fueling-operating-heatmap-mode')!,
    details: heatmap.querySelector<HTMLElement>('.fueling-operating-heatmap-detail')!,
    detailTitle: heatmap.querySelector<HTMLElement>('.fueling-operating-heatmap-detail strong')!,
    detailText: heatmap.querySelector<HTMLElement>('.fueling-operating-heatmap-detail span')!,
  };
}

function renderLegend(host: HTMLElement, mode: HeatmapMode): void {
  host.replaceChildren();
  const items = mode === 'error'
    ? [['Rich', 'rich'], ['Within band', 'band'], ['Lean', 'lean']]
    : [['Weak', 'weak'], ['Moderate', 'moderate'], ['Strong', 'strong']];
  for (const [label, kind] of items) {
    const item = document.createElement('span');
    item.innerHTML = `<i data-kind="${kind}"></i>${label}`;
    host.append(item);
  }
}

function renderHeatmap(view: HTMLElement, section: HTMLElement, table: HTMLTableElement): void {
  const points = parsePoints(table);
  const ui = ensureStructure(section);
  if (!points.length) {
    ui.heatmap.hidden = true;
    return;
  }
  ui.heatmap.hidden = false;
  const mode: HeatmapMode = ui.mode.value === 'evidence' ? 'evidence' : 'error';
  renderLegend(ui.heatmap.querySelector<HTMLElement>('.fueling-operating-heatmap-legend')!, mode);
  const rpms = [...new Set(points.map((point) => point.rpmBin))].sort((a, b) => binStart(a) - binStart(b));
  const loads = [...new Set(points.map((point) => point.loadBin))].sort((a, b) => binStart(b) - binStart(a));
  const byCell = new Map(points.map((point) => [`${point.rpmBin}\u0000${point.loadBin}`, point]));
  const deadband = errorDeadband(view);
  const scale = mixtureScale(view);

  ui.grid.style.gridTemplateColumns = `minmax(76px, max-content) repeat(${rpms.length}, minmax(32px, max-content))`;
  const nodes: HTMLElement[] = [];
  const corner = document.createElement('span');
  corner.className = 'fueling-heatmap-axis fueling-heatmap-axis--corner';
  corner.textContent = 'Load ↓ / RPM →';
  nodes.push(corner);
  for (const rpm of rpms) {
    const label = document.createElement('span');
    label.className = 'fueling-heatmap-axis fueling-heatmap-axis--rpm';
    label.textContent = rpm;
    nodes.push(label);
  }
  for (const load of loads) {
    const label = document.createElement('span');
    label.className = 'fueling-heatmap-axis fueling-heatmap-axis--load';
    label.textContent = load;
    nodes.push(label);
    for (const rpm of rpms) {
      const point = byCell.get(`${rpm}\u0000${load}`);
      if (!point) {
        const empty = document.createElement('span');
        empty.className = 'fueling-heatmap-cell fueling-heatmap-cell--empty';
        empty.setAttribute('aria-hidden', 'true');
        nodes.push(empty);
        continue;
      }
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `fueling-heatmap-cell ${mode === 'error' ? errorClass(point.errorMean, deadband) : evidenceClass(point.evidence)}`;
      cell.setAttribute('aria-label', `${rpm} RPM, ${load} load. ${detailText(point, scale)}`);
      cell.title = detailText(point, scale);
      cell.addEventListener('click', () => {
        ui.grid.querySelectorAll('.fueling-heatmap-cell--selected').forEach((node) => node.classList.remove('fueling-heatmap-cell--selected'));
        cell.classList.add('fueling-heatmap-cell--selected');
        ui.details.hidden = false;
        ui.detailTitle.textContent = `${rpm} RPM · ${load} load`;
        const actual = point.actualMixture === undefined ? '' : ` · actual ${numberText(point.actualMixture)}`;
        const target = point.targetMixture === undefined ? '' : ` · target ${numberText(point.targetMixture)}`;
        const mae = point.mae === undefined ? '' : ` · MAE ${numberText(point.mae)}`;
        ui.detailText.textContent = `${detailText(point, scale)}${actual}${target}${mae}`;
      });
      nodes.push(cell);
    }
  }
  ui.grid.replaceChildren(...nodes);

  if (ui.mode.dataset.fuelingHeatmapBound !== 'true') {
    ui.mode.dataset.fuelingHeatmapBound = 'true';
    ui.mode.addEventListener('change', () => renderHeatmap(view, section, table));
  }
}

function apply(root: HTMLElement): void {
  for (const view of root.querySelectorAll<HTMLElement>('.specialized-analyzer-view')) {
    const title = view.querySelector<HTMLElement>('[data-specialized="title"]')?.textContent ?? '';
    if (!/^Fueling\b/i.test(title)) continue;
    const section = view.querySelector<HTMLElement>('.specialized-analyzer-map-section');
    const table = section?.querySelector<HTMLTableElement>('.specialized-analyzer-map-table');
    if (!section || !table || section.hidden) continue;
    renderHeatmap(view, section, table);
  }
}

export function installFuelingOperatingMapView(root: HTMLElement): void {
  if (INSTALLED.has(root)) return;
  INSTALLED.add(root);
  const table = root.querySelector<HTMLTableElement>('.specialized-analyzer-map-table');
  if (!table) return;

  const observer = new MutationObserver(() => apply(root));
  observer.observe(table, { childList: true, subtree: true });
  apply(root);
}
