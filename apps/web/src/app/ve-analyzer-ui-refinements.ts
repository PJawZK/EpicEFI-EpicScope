import { addInlineHelpButton, showInlineHelpPopover } from '../components/inline-help';

const VE_HELP = {
  title: 'VE Analyzer',
  text: 'Log-based VE proposal workbench. The VE table and target-mixture table remain the primary surfaces; analysis uses explicit qualification, mixture scale, fuel-correction handling and a timestamp-based lambda-delay model. Running analysis never mutates the loaded MSQ.',
} as const;

function normalizedOptionText(option: HTMLOptionElement | undefined): string {
  return option?.textContent?.trim().toLowerCase().replace(/[_/.-]+/g, ' ').replace(/\s+/g, ' ') ?? '';
}

export function isGasScaleAfrOption(option: HTMLOptionElement): boolean {
  const text = normalizedOptionText(option);
  return !option.disabled
    && Boolean(option.value)
    && /gas\s*scale/.test(text)
    && /(afr|air\s*fuel\s*ratio)/.test(text);
}

function isGenericAfrOption(option: HTMLOptionElement | undefined): boolean {
  const text = normalizedOptionText(option);
  if (!text || /gas\s*scale/.test(text)) return false;
  return /(^|\s)afr\s*value(\s|$)|(^|\s)afrvalue(\s|$)|air\s*fuel\s*ratio/.test(text);
}

export function preferGasScaleAfrOption(control: HTMLSelectElement, scale: string): boolean {
  if (scale !== 'afr') return false;
  const gasScale = [...control.options].find(isGasScaleAfrOption);
  if (!gasScale) return false;
  const selected = control.selectedOptions[0];
  if (control.value && !isGenericAfrOption(selected)) return false;
  if (control.value === gasScale.value) return false;
  control.value = gasScale.value;
  control.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

export function installVeAnalyzerUiRefinements(root: HTMLElement): void {
  const viewSelect = root.querySelector<HTMLSelectElement>('.analyzer-header-view-select');
  const analyzerPage = root.querySelector<HTMLElement>('.analyzer-page');
  if (!viewSelect || !analyzerPage) return;

  const headerHost = viewSelect.parentElement;
  let helpHost = headerHost?.querySelector<HTMLElement>('.ve-analyzer-header-help');
  if (!helpHost && headerHost) {
    helpHost = document.createElement('span');
    helpHost.className = 've-analyzer-header-help';
    headerHost.append(helpHost);
    addInlineHelpButton(helpHost, VE_HELP, showInlineHelpPopover);
  }

  let applying = false;
  const apply = (): void => {
    if (applying) return;
    applying = true;
    try {
      const active = viewSelect.value === 've';
      const analyzerHead = analyzerPage.querySelector<HTMLElement>(':scope > .analyzer-head');
      if (analyzerHead) analyzerHead.hidden = active;
      const veBanner = analyzerPage.querySelector<HTMLElement>('.ve-analyzer-view .ve-workbench-banner');
      if (veBanner) veBanner.hidden = true;
      if (helpHost) helpHost.hidden = !active;
      if (!active) return;

      const actual = analyzerPage.querySelector<HTMLSelectElement>('.ve-analyzer-view select[data-role="actual"]');
      const scale = analyzerPage.querySelector<HTMLSelectElement>('.ve-analyzer-view select[data-role="mixture-scale"]')?.value ?? '';
      if (actual) preferGasScaleAfrOption(actual, scale);
    } finally {
      applying = false;
    }
  };

  viewSelect.addEventListener('change', apply);
  analyzerPage.addEventListener('change', (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.matches('.ve-analyzer-view select[data-role="mixture-scale"]')) apply();
  });

  const observer = new MutationObserver(() => apply());
  observer.observe(analyzerPage, { childList: true, subtree: true });
  apply();
}
