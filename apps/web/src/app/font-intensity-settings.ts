interface FontIntensityState {
  intensity: number;
}

const STORAGE_KEY = 'epicscope.fontIntensity.v1';
const DEFAULT_INTENSITY = 115;
const STYLE_ID = 'epicscope-font-intensity-style';
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function readState(): FontIntensityState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { intensity: DEFAULT_INTENSITY };
    const parsed = JSON.parse(raw) as Partial<FontIntensityState>;
    return { intensity: clamp(Number(parsed.intensity) || DEFAULT_INTENSITY, 80, 160) };
  } catch {
    return { intensity: DEFAULT_INTENSITY };
  }
}

function writeState(state: FontIntensityState): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* best-effort persistence */ }
}

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    :root { --epicscope-font-intensity-scale: 1.15; }

    /* Secondary/caption text is where EpicScope currently reads too faintly.
       Brightness changes only the text-bearing element, not parent panel backgrounds. */
    .epicscope-app label > span,
    .epicscope-app small,
    .epicscope-app summary,
    .epicscope-app .settings-section > header small,
    .epicscope-app .settings-field > span,
    .epicscope-app .specialized-analyzer-guidance span,
    .epicscope-app .specialized-analyzer-empty span,
    .epicscope-app .specialized-analyzer-controls label > span,
    .epicscope-app .specialized-analyzer-options-grid label > span,
    .epicscope-app .analyzer-head p,
    .epicscope-app .histogram-page label > span,
    .epicscope-app .logger-page label > span {
      filter: brightness(var(--epicscope-font-intensity-scale));
    }
  `;
  document.head.append(style);
}

function applyState(state: FontIntensityState): void {
  document.documentElement.style.setProperty('--epicscope-font-intensity-scale', String(state.intensity / 100));
  ensureStyle();
}

export function installFontIntensitySettings(root: HTMLElement): void {
  const host = root.querySelector<HTMLElement>('.settings-global-section .settings-section-body');
  if (!host || host.querySelector('.settings-font-intensity')) return;

  const state = readState();
  applyState(state);

  const section = document.createElement('div');
  section.className = 'settings-typography settings-font-intensity';

  const heading = document.createElement('div');
  heading.className = 'settings-typography-head';
  heading.innerHTML = '<div><strong>Font intensity</strong><small>Strengthens secondary labels and explanatory text across EpicScope.</small></div><button type="button" class="settings-intensity-reset">Reset</button>';

  const row = document.createElement('label');
  row.className = 'settings-font-slider';
  row.innerHTML = `
    <span class="settings-font-slider-copy"><strong>Text intensity</strong><small>Adjusts faded captions and labels without changing font size.</small></span>
    <span class="settings-font-slider-control"><input type="range" min="80" max="160" step="5" value="${state.intensity}" aria-label="Font intensity"><output>${state.intensity}%</output></span>
  `;

  const input = row.querySelector<HTMLInputElement>('input');
  const output = row.querySelector<HTMLElement>('output');
  input?.addEventListener('input', () => {
    state.intensity = clamp(Number(input.value), 80, 160);
    if (output) output.textContent = `${state.intensity}%`;
    writeState(state);
    applyState(state);
  });

  heading.querySelector<HTMLButtonElement>('.settings-intensity-reset')?.addEventListener('click', () => {
    state.intensity = DEFAULT_INTENSITY;
    if (input) input.value = String(DEFAULT_INTENSITY);
    if (output) output.textContent = `${DEFAULT_INTENSITY}%`;
    writeState(state);
    applyState(state);
  });

  section.append(heading, row);
  host.append(section);
}

function autoInstall(): void {
  applyState(readState());
  const install = (): boolean => {
    const app = document.querySelector<HTMLElement>('.epicscope-app');
    if (!app) return false;
    installFontIntensitySettings(app);
    return !!app.querySelector('.settings-font-intensity');
  };
  if (install()) return;
  const observer = new MutationObserver(() => {
    if (install()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

autoInstall();
