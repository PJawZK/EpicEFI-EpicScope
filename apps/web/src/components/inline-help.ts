export interface InlineHelpEntry {
  readonly title: string;
  readonly text: string;
}

export type InlineHelpMatcher = readonly [RegExp, InlineHelpEntry];
export type InlineHelpPresenter = (help: InlineHelpEntry, anchor?: HTMLElement) => void;

const STYLE_ID = 'epicscope-inline-help-style';
const POPOVER_ID = 'epicscope-inline-help-popover';
let activeAnchor: HTMLElement | undefined;

export function ensureInlineHelpStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .epicscope-inline-help { display:inline-grid; place-items:center; width:14px; height:14px; margin-left:4px; padding:0; border:1px solid #385465; border-radius:50%; background:#101d28; color:#8eabb9; font:700 9px/1 system-ui,sans-serif; cursor:pointer; vertical-align:middle; text-transform:none; letter-spacing:0; }
    .epicscope-inline-help:hover, .epicscope-inline-help:focus-visible { border-color:#5d879c; color:#d9edf5; outline:none; background:#153040; }
    .epicscope-inline-help-popover { position:fixed; z-index:10000; box-sizing:border-box; width:min(360px, calc(100vw - 24px)); max-height:min(420px, calc(100vh - 24px)); overflow:auto; padding:10px 11px 11px; border:1px solid #3a5668; border-radius:6px; background:#0b171f; box-shadow:0 12px 32px rgba(0,0,0,.46); color:#dce9ef; }
    .epicscope-inline-help-popover[hidden] { display:none!important; }
    .epicscope-inline-help-popover header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:7px; }
    .epicscope-inline-help-popover strong { color:#e5f0f5; font-size:11px; line-height:1.35; }
    .epicscope-inline-help-popover p { margin:0; color:#91a7b3; font-size:10px; line-height:1.55; }
    .epicscope-inline-help-popover-close { display:grid; place-items:center; flex:0 0 auto; width:22px; height:22px; padding:0; border:1px solid #2e4958; border-radius:4px; background:#101d28; color:#91a7b3; font:700 14px/1 system-ui,sans-serif; cursor:pointer; }
    .epicscope-inline-help-popover-close:hover, .epicscope-inline-help-popover-close:focus-visible { border-color:#5d879c; color:#edf8fc; outline:none; background:#153040; }
  `;
  document.head.append(style);
}

function ensureInlineHelpPopover(): HTMLElement {
  ensureInlineHelpStyle();
  const existing = document.getElementById(POPOVER_ID);
  if (existing) return existing;
  const popover = document.createElement('aside');
  popover.id = POPOVER_ID;
  popover.className = 'epicscope-inline-help-popover';
  popover.hidden = true;
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-modal', 'false');
  popover.innerHTML = `
    <header>
      <strong data-inline-help-popover="title">Information</strong>
      <button type="button" class="epicscope-inline-help-popover-close" aria-label="Close information">×</button>
    </header>
    <p data-inline-help-popover="text"></p>
  `;
  document.body.append(popover);
  popover.querySelector<HTMLButtonElement>('.epicscope-inline-help-popover-close')?.addEventListener('click', () => closeInlineHelpPopover(true));
  return popover;
}

function positionInlineHelpPopover(popover: HTMLElement, anchor?: HTMLElement): void {
  const viewportMargin = 12;
  const gap = 7;
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  if (!anchor) {
    popover.style.left = `${Math.max(viewportMargin, (window.innerWidth - width) / 2)}px`;
    popover.style.top = `${Math.max(viewportMargin, (window.innerHeight - height) / 2)}px`;
    return;
  }
  const rect = anchor.getBoundingClientRect();
  const maxLeft = Math.max(viewportMargin, window.innerWidth - width - viewportMargin);
  let left = Math.min(Math.max(rect.left, viewportMargin), maxLeft);
  let top = rect.bottom + gap;
  if (top + height > window.innerHeight - viewportMargin) top = rect.top - height - gap;
  if (top < viewportMargin) top = viewportMargin;
  if (left + width > window.innerWidth - viewportMargin) left = window.innerWidth - width - viewportMargin;
  popover.style.left = `${Math.max(viewportMargin, left)}px`;
  popover.style.top = `${top}px`;
}

export function closeInlineHelpPopover(restoreFocus = false): void {
  const popover = document.getElementById(POPOVER_ID);
  if (!popover || popover.hidden) return;
  popover.hidden = true;
  if (activeAnchor) activeAnchor.setAttribute('aria-expanded', 'false');
  const anchor = activeAnchor;
  activeAnchor = undefined;
  if (restoreFocus) anchor?.focus();
}

export function showInlineHelpPopover(help: InlineHelpEntry, anchor?: HTMLElement): void {
  const popover = ensureInlineHelpPopover();
  if (!popover.hidden && activeAnchor === anchor) {
    closeInlineHelpPopover();
    return;
  }
  if (activeAnchor && activeAnchor !== anchor) activeAnchor.setAttribute('aria-expanded', 'false');
  activeAnchor = anchor;
  if (anchor) anchor.setAttribute('aria-expanded', 'true');
  const title = popover.querySelector<HTMLElement>('[data-inline-help-popover="title"]');
  const text = popover.querySelector<HTMLElement>('[data-inline-help-popover="text"]');
  if (title) title.textContent = help.title;
  if (text) text.textContent = help.text;
  popover.hidden = false;
  positionInlineHelpPopover(popover, anchor);
}

function installGlobalDismissHandlers(): void {
  if (document.documentElement.dataset.inlineHelpDismissInstalled === 'true') return;
  document.documentElement.dataset.inlineHelpDismissInstalled = 'true';
  document.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof Node)) return;
    const popover = document.getElementById(POPOVER_ID);
    if (!popover || popover.hidden) return;
    if (popover.contains(target) || activeAnchor?.contains(target)) return;
    closeInlineHelpPopover();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const popover = document.getElementById(POPOVER_ID);
    if (!popover || popover.hidden) return;
    event.preventDefault();
    closeInlineHelpPopover(true);
  });
  window.addEventListener('resize', () => {
    const popover = document.getElementById(POPOVER_ID);
    if (popover && !popover.hidden) positionInlineHelpPopover(popover, activeAnchor);
  });
}

export function matchingInlineHelp(text: string, entries: readonly InlineHelpMatcher[]): InlineHelpEntry | undefined {
  return entries.find(([pattern]) => pattern.test(text))?.[1];
}

export function addInlineHelpButton(
  host: HTMLElement,
  help: InlineHelpEntry,
  show: InlineHelpPresenter = showInlineHelpPopover,
): HTMLButtonElement {
  const existing = host.querySelector<HTMLButtonElement>(':scope > .epicscope-inline-help');
  if (existing) return existing;
  ensureInlineHelpStyle();
  installGlobalDismissHandlers();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'epicscope-inline-help epicscope-info-icon';
  button.textContent = 'i';
  button.title = `Explain ${help.title}`;
  button.setAttribute('aria-label', `Explain ${help.title}`);
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', POPOVER_ID);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    show(help, button);
  });
  host.append(button);
  return button;
}

export function createInlineHelpPresenter(
  _guidance: HTMLElement,
  _title: HTMLElement,
  _text: HTMLElement,
): InlineHelpPresenter {
  return showInlineHelpPopover;
}
