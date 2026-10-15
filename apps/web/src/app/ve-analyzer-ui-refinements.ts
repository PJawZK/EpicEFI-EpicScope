import { addInlineHelpButton, showInlineHelpPopover } from '../components/inline-help';

const VE_HELP = {
  title: 'VE Analyzer',
  text: 'Log-based VE proposal workbench. The VE table and target-mixture table remain the primary surfaces; analysis uses explicit qualification, mixture scale, fuel-correction handling and a timestamp-based lambda-delay model. Running analysis never mutates the loaded MSQ.',
} as const;

function normalizedLabel(label: string | undefined): string {
  return label?.trim().toLowerCase().replace(/[_/.-]+/g, ' ').replace(/\s+/g, ' ') ?? '';
}

export function isGasScaleAfrLabel(label: string): boolean {
  const text = normalizedLabel(label);
  return /gas\s*scale/.test(text) && /(afr|air\s*fuel\s*ratio)/.test(text);
}

export function isGenericAfrLabel(label: string): boolean {
  const text = normalizedLabel(label);
  if (!text || /gas\s*scale/.test(text)) return false;
  return /(^|\s)afr\s*value(\s|$)|(^|\s)afrvalue(\s|$)|air\s*fuel\s*ratio/.test(text);
}

export function shouldPreferGasScaleAfr(currentLabel: string | undefined, gasScaleLabel: string | undefined, scale: string): boolean {
  return scale === 'afr'
    && Boolean(gasScaleLabel && isGasScaleAfrLabel(gasScaleLabel))
    && (!currentLabel || isGenericAfrLabel(currentLabel));
}

export function isGasScaleAfrOption(option: HTMLOptionElement): boolean {
  return !option.disabled && Boolean(option.value) && isGasScaleAfrLabel(option.textContent ?? '');
}

export function preferGasScaleAfrOption(control: HTMLSelectElement, scale: string): boolean {
  if (scale !== 'afr') return false;
  const gasScale = [...control.options].find(isGasScaleAfrOption);
  if (!gasScale) return false;
  const selected = control.selectedOptions[0];
  if (!shouldPreferGasScaleAfr(selected?.textContent ?? undefined, gasScale.textContent ?? undefined, scale)) return false;
  if (control.value === gasScale.value) return false;
  control.value = gasScale.value;
  control.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function orientLoadAxisFromBottom(table: HTMLTableElement): void {
  if (table.dataset.veLoadOrigin === 'lower-left') return;
  const body = table.tBodies[0];
  if (!body) return;
  const rows = [...body.rows];
  for (let index = rows.length - 1; index >= 0; index -= 1) body.append(rows[index]!);
  table.dataset.veLoadOrigin = 'lower-left';
}

function compactProposalCell(cell: HTMLTableCellElement): void {
  if (cell.dataset.veCellRefined === 'true') return;
  if (cell.title.startsWith('Measured proposal')) {
    const main = cell.querySelector<HTMLElement>(':scope > span');
    const text = main?.textContent ?? '';
    const arrow = text.indexOf('→');
    if (main && arrow >= 0) main.textContent = text.slice(arrow + 1).trim();
  }
  if (cell.title) {
    cell.tabIndex = 0;
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', cell.title);
    cell.dataset.veHasDetail = 'true';
  }
  cell.dataset.veCellRefined = 'true';
}

function detailTitle(cell: HTMLTableCellElement): string {
  if (cell.classList.contains('ve-delay-table') || cell.closest('.ve-delay-table')) return 'Lambda delay detail';
  if (cell.title.startsWith('Measured proposal')) return 'VE proposed change';
  if (cell.title.startsWith('Weak evidence')) return 'VE weak evidence';
  if (cell.title.startsWith('Recommendation withheld')) return 'VE recommendation withheld';
  return 'Cell detail';
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

  const detail = document.createElement('aside');
  detail.className = 've-cell-detail-popover';
  detail.hidden = true;
  detail.innerHTML = '<header><strong>Cell detail</strong><button type="button" aria-label="Close cell detail">×</button></header><div></div>';
  analyzerPage.append(detail);
  const detailHeading = detail.querySelector<HTMLElement>('strong')!;
  const detailText = detail.querySelector<HTMLElement>('div')!;
  detail.querySelector<HTMLButtonElement>('button')!.onclick = (event) => {
    event.stopPropagation();
    detail.hidden = true;
  };

  const showCellDetail = (cell: HTMLTableCellElement): void => {
    if (!cell.title) return;
    detailHeading.textContent = detailTitle(cell);
    detailText.textContent = cell.title;
    detail.hidden = false;
  };

  analyzerPage.addEventListener('click', (event) => {
    const target = event.target;
    const cell = target instanceof Element ? target.closest<HTMLTableCellElement>('.ve-analyzer-view td[data-ve-has-detail="true"]') : null;
    if (cell) showCellDetail(cell);
  });
  analyzerPage.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target;
    const cell = target instanceof HTMLTableCellElement && target.matches('.ve-analyzer-view td[data-ve-has-detail="true"]') ? target : null;
    if (!cell) return;
    event.preventDefault();
    showCellDetail(cell);
  });

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
      if (!active) {
        detail.hidden = true;
        return;
      }

      const delayMinEvents = analyzerPage.querySelector<HTMLInputElement>('.ve-analyzer-view input[data-role="delay-min-events"]');
      if (delayMinEvents && delayMinEvents.dataset.veDefaultAdjusted !== 'true') {
        if (delayMinEvents.value === '2') delayMinEvents.value = '3';
        delayMinEvents.dataset.veDefaultAdjusted = 'true';
      }

      for (const table of analyzerPage.querySelectorAll<HTMLTableElement>('.ve-analyzer-view .ve-workbench-table')) {
        orientLoadAxisFromBottom(table);
        for (const cell of table.querySelectorAll<HTMLTableCellElement>('tbody td')) compactProposalCell(cell);
      }
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
