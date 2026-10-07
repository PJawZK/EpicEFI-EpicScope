interface TypographyScaleState {
  interface: number;
  info: number;
  analyzer: number;
  graph: number;
}

const STORAGE_KEY = 'epicscope.typography.v1';
const DEFAULTS: TypographyScaleState = { interface: 100, info: 120, analyzer: 100, graph: 115 };
const STYLE_ID = 'epicscope-app-wide-typography';
let canvasFontPatched = false;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function readState(): TypographyScaleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<TypographyScaleState>;
    return {
      interface: clamp(Number(parsed.interface) || DEFAULTS.interface, 80, 150),
      info: clamp(Number(parsed.info) || DEFAULTS.info, 90, 200),
      analyzer: clamp(Number(parsed.analyzer) || DEFAULTS.analyzer, 80, 180),
      graph: clamp(Number(parsed.graph) || DEFAULTS.graph, 80, 180),
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeState(state: TypographyScaleState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* local persistence is best-effort */ }
}

function graphScale(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--epicscope-font-graph-scale').trim();
  const value = Number(raw);
  return Number.isFinite(value) ? clamp(value, 0.8, 1.8) : DEFAULTS.graph / 100;
}

function installCanvasFontScaling(): void {
  if (canvasFontPatched || typeof CanvasRenderingContext2D === 'undefined') return;
  const descriptor = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
  if (!descriptor?.get || !descriptor.set) return;
  const nativeGet = descriptor.get;
  const nativeSet = descriptor.set;
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get(this: CanvasRenderingContext2D): string {
      return nativeGet.call(this) as string;
    },
    set(this: CanvasRenderingContext2D, value: string) {
      // Aligned Analyzer evidence already applies the graph scale internally.
      if (this.canvas?.classList.contains('specialized-analyzer-evidence-canvas')) {
        nativeSet.call(this, value);
        return;
      }
      const scale = graphScale();
      const scaled = value.replace(/(^|\s)(\d+(?:\.\d+)?)px(?=\s|$)/, (_match, prefix: string, size: string) => `${prefix}${Number(size) * scale}px`);
      nativeSet.call(this, scaled);
    },
  });
  canvasFontPatched = true;
}

function ensureAppWideStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* Typography categories intentionally span Logger, Analyzer and Histogram. */
    .epicscope-app button,
    .epicscope-app select,
    .epicscope-app input:not([type="range"]),
    .epicscope-app summary,
    .epicscope-app .settings-field > span,
    .epicscope-app .settings-toggle strong,
    .epicscope-app .settings-shortcuts strong,
    .epicscope-app .settings-ini-source strong,
    .epicscope-app .settings-persistence strong {
      font-size: calc(10px * var(--epicscope-font-interface-scale)) !important;
    }

    .logger-page small,
    .logger-page p,
    .logger-page [class*="description"],
    .logger-page [class*="guidance"],
    .logger-page [class*="note"],
    .logger-page [class*="hint"],
    .analyzer-page small,
    .analyzer-page p,
    .analyzer-page [class*="description"],
    .analyzer-page [class*="guidance"],
    .analyzer-page [class*="note"],
    .analyzer-page [class*="hint"],
    .histogram-page small,
    .histogram-page p,
    .histogram-page [class*="description"],
    .histogram-page [class*="guidance"],
    .histogram-page [class*="note"],
    .histogram-page [class*="hint"],
    .settings-popover small,
    .settings-note {
      font-size: calc(9px * var(--epicscope-font-info-scale)) !important;
      line-height: 1.45;
    }

    .logger-page table,
    .logger-page table th,
    .logger-page table td,
    .logger-page [class*="readout"],
    .logger-page [class*="value"],
    .analyzer-page table,
    .analyzer-page table th,
    .analyzer-page table td,
    .analyzer-page [class*="summary"] strong,
    .analyzer-page [class*="result"] strong,
    .histogram-page table,
    .histogram-page table th,
    .histogram-page table td,
    .histogram-page [class*="value"],
    .histogram-page [class*="result"] {
      font-size: calc(9px * var(--epicscope-font-analyzer-scale)) !important;
    }

    .graph-corner-readout,
    .graph-corner-readout *,
    .graph-legend,
    .graph-legend *,
    .timeline-overview-label,
    .timeline-overview-label *,
    .specialized-analyzer-evidence > header,
    .specialized-analyzer-evidence > header * {
      font-size: calc(9px * var(--epicscope-font-graph-scale)) !important;
    }
  `;
  document.head.append(style);
}

function applyState(state: TypographyScaleState): void {
  const style = document.documentElement.style;
  style.setProperty('--epicscope-font-interface-scale', String(state.interface / 100));
  style.setProperty('--epicscope-font-info-scale', String(state.info / 100));
  style.setProperty('--epicscope-font-analyzer-scale', String(state.analyzer / 100));
  style.setProperty('--epicscope-font-graph-scale', String(state.graph / 100));
  ensureAppWideStyle();
  installCanvasFontScaling();
  window.dispatchEvent(new CustomEvent('epicscope:typography-change'));
}

interface SliderSpec {
  readonly key: keyof TypographyScaleState;
  readonly label: string;
  readonly detail: string;
  readonly min: number;
  readonly max: number;
}

const SPECS: readonly SliderSpec[] = [
  { key: 'interface', label: 'Interface text', detail: 'Menus, settings and controls in Logger, Analyzer and Histogram.', min: 80, max: 150 },
  { key: 'info', label: 'Information / help text', detail: 'Descriptions, guidance, hints and explanations throughout EpicScope.', min: 90, max: 200 },
  { key: 'analyzer', label: 'Data / results text', detail: 'Readouts, values, tables and result text in all modes.', min: 80, max: 180 },
  { key: 'graph', label: 'Graph / legend text', detail: 'Graph legends, labels, axes and canvas text across Logger, Analyzer and Histogram.', min: 80, max: 180 },
];

export function installFontSizeSettings(root: HTMLElement): void {
  const host = root.querySelector<HTMLElement>('.settings-global-section .settings-section-body');
  if (!host || host.querySelector('.settings-typography')) return;

  const state = readState();
  applyState(state);

  const section = document.createElement('div');
  section.className = 'settings-typography';
  const heading = document.createElement('div');
  heading.className = 'settings-typography-head';
  heading.innerHTML = '<div><strong>Font size</strong><small>Applies across Logger, Analyzer and Histogram.</small></div><button type="button" class="settings-typography-reset">Reset</button>';
  section.append(heading);

  const rows = new Map<keyof TypographyScaleState, { input: HTMLInputElement; value: HTMLElement }>();
  for (const spec of SPECS) {
    const row = document.createElement('label');
    row.className = 'settings-font-slider';
    row.innerHTML = `
      <span class="settings-font-slider-copy"><strong>${spec.label}</strong><small>${spec.detail}</small></span>
      <span class="settings-font-slider-control"><input type="range" min="${spec.min}" max="${spec.max}" step="5" value="${state[spec.key]}" aria-label="${spec.label}"><output>${state[spec.key]}%</output></span>
    `;
    const input = row.querySelector<HTMLInputElement>('input');
    const output = row.querySelector<HTMLElement>('output');
    if (!input || !output) continue;
    rows.set(spec.key, { input, value: output });
    input.addEventListener('input', () => {
      state[spec.key] = clamp(Number(input.value), spec.min, spec.max);
      output.textContent = `${state[spec.key]}%`;
      writeState(state);
      applyState(state);
    });
    section.append(row);
  }

  heading.querySelector<HTMLButtonElement>('.settings-typography-reset')?.addEventListener('click', () => {
    Object.assign(state, DEFAULTS);
    for (const spec of SPECS) {
      const row = rows.get(spec.key);
      if (!row) continue;
      row.input.value = String(DEFAULTS[spec.key]);
      row.value.textContent = `${DEFAULTS[spec.key]}%`;
    }
    writeState(state);
    applyState(state);
  });

  host.append(section);
}

export function initializeFontSizeSettings(): void {
  applyState(readState());
}

function autoInstall(): void {
  initializeFontSizeSettings();
  const install = (): boolean => {
    const app = document.querySelector<HTMLElement>('.epicscope-app');
    if (!app) return false;
    installFontSizeSettings(app);
    return !!app.querySelector('.settings-typography');
  };
  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

autoInstall();
