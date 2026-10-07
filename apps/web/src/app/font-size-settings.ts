interface TypographyScaleState {
  interface: number;
  info: number;
  analyzer: number;
  graph: number;
}

const STORAGE_KEY = 'epicscope.typography.v1';
const DEFAULTS: TypographyScaleState = { interface: 100, info: 100, analyzer: 100, graph: 100 };

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

function applyState(state: TypographyScaleState): void {
  const style = document.documentElement.style;
  style.setProperty('--epicscope-font-interface-scale', String(state.interface / 100));
  style.setProperty('--epicscope-font-info-scale', String(state.info / 100));
  style.setProperty('--epicscope-font-analyzer-scale', String(state.analyzer / 100));
  style.setProperty('--epicscope-font-graph-scale', String(state.graph / 100));
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
  { key: 'interface', label: 'Interface text', detail: 'Menus, settings and general controls.', min: 80, max: 150 },
  { key: 'info', label: 'Information / help text', detail: 'Descriptions, guidance and inline explanations.', min: 90, max: 200 },
  { key: 'analyzer', label: 'Analyzer data / results', detail: 'Analyzer selectors, result cards, tables and event text.', min: 80, max: 180 },
  { key: 'graph', label: 'Graph / legend text', detail: 'Aligned-evidence pane titles, legends and time labels.', min: 80, max: 180 },
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
  heading.innerHTML = '<div><strong>Font size</strong><small>Adjust text groups independently.</small></div><button type="button" class="settings-typography-reset">Reset</button>';
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
