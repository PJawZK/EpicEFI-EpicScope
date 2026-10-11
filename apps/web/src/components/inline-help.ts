export interface InlineHelpEntry {
  readonly title: string;
  readonly text: string;
}

export type InlineHelpMatcher = readonly [RegExp, InlineHelpEntry];

const STYLE_ID = 'epicscope-inline-help-style';

export function ensureInlineHelpStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .epicscope-inline-help { display:inline-grid; place-items:center; width:14px; height:14px; margin-left:4px; padding:0; border:1px solid #385465; border-radius:50%; background:#101d28; color:#8eabb9; font:700 9px/1 system-ui,sans-serif; cursor:pointer; vertical-align:middle; text-transform:none; letter-spacing:0; }
    .epicscope-inline-help:hover, .epicscope-inline-help:focus-visible { border-color:#5d879c; color:#d9edf5; outline:none; background:#153040; }
  `;
  document.head.append(style);
}

export function matchingInlineHelp(text: string, entries: readonly InlineHelpMatcher[]): InlineHelpEntry | undefined {
  return entries.find(([pattern]) => pattern.test(text))?.[1];
}

export function addInlineHelpButton(
  host: HTMLElement,
  help: InlineHelpEntry,
  show: (help: InlineHelpEntry) => void,
): HTMLButtonElement {
  const existing = host.querySelector<HTMLButtonElement>(':scope > .epicscope-inline-help');
  if (existing) return existing;
  ensureInlineHelpStyle();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'epicscope-inline-help';
  button.textContent = 'i';
  button.title = `Explain ${help.title}`;
  button.setAttribute('aria-label', `Explain ${help.title}`);
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    show(help);
  });
  host.append(button);
  return button;
}

export function createInlineHelpPresenter(
  guidance: HTMLElement,
  title: HTMLElement,
  text: HTMLElement,
): (help: InlineHelpEntry) => void {
  return (help) => {
    guidance.hidden = false;
    title.textContent = help.title;
    text.textContent = help.text;
    guidance.scrollIntoView({ block: 'nearest' });
  };
}
