import './ve-analyzer-v50-tool-surfaces.css';

interface ToolSurface {
  readonly details: HTMLDetailsElement;
  readonly panel: HTMLElement;
  readonly open: () => void;
  readonly close: () => void;
}

function createToolSurface(
  host: HTMLElement,
  details: HTMLDetailsElement,
  title: string,
  className: string,
): ToolSurface {
  details.open = false;
  details.classList.add('ve-v50-tool-details', className);

  const originalSummary = details.querySelector<HTMLElement>(':scope > summary');
  if (originalSummary) originalSummary.hidden = true;

  const panel = document.createElement('section');
  panel.className = 've-v50-tool-surface';
  panel.hidden = true;
  panel.setAttribute('aria-label', title);

  const head = document.createElement('header');
  head.className = 've-v50-tool-surface-head';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 've-v50-tool-surface-close';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', `Close ${title}`);
  head.append(heading, closeButton);

  const body = document.createElement('div');
  body.className = 've-v50-tool-surface-body';
  body.append(details);
  panel.append(head, body);
  host.append(panel);

  const close = (): void => {
    panel.hidden = true;
    details.open = false;
  };
  const open = (): void => {
    for (const other of host.querySelectorAll<HTMLElement>('.ve-v50-tool-surface')) other.hidden = true;
    for (const other of host.querySelectorAll<HTMLDetailsElement>('.ve-v50-tool-details')) other.open = false;
    details.open = true;
    panel.hidden = false;
  };

  closeButton.addEventListener('click', close);
  panel.addEventListener('pointerdown', (event) => {
    if (event.target === panel) close();
  });

  return { details, panel, open, close };
}

/**
 * Adapts the existing production-owned Advanced and Lambda Delay details into
 * v50-style secondary tool surfaces. No domain state is copied: the original
 * nodes, listeners and controls are re-parented intact.
 */
export function installVeAnalyzerV50ToolSurfaces(root: HTMLElement): void {
  if (root.querySelector('.ve-v50-tool-host')) return;

  const advanced = root.querySelector<HTMLDetailsElement>('.ve-workbench-advanced');
  const lambda = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]')?.closest<HTMLDetailsElement>('details');
  if (!advanced && !lambda) return;

  const host = document.createElement('div');
  host.className = 've-v50-tool-host';
  root.append(host);

  const advancedTool = advanced ? createToolSurface(host, advanced, 'Advanced VE Analyzer Inputs', 've-v50-tool-advanced') : undefined;
  const lambdaTool = lambda ? createToolSurface(host, lambda, 'Lambda Delay Table', 've-v50-tool-lambda') : undefined;

  // Keep all Advanced descendants in their original production-owned subtree.
  // v2 caches the readiness tbody and queries role selects inside this details;
  // moving those nodes breaks its rebuild lifecycle.
  const openAdvancedMode = (mode: 'advanced' | 'exclusions' | 'inputs'): void => {
    if (!advancedTool) return;
    advancedTool.panel.dataset.veToolMode = mode;
    const title = mode === 'exclusions' ? 'State Exclusions'
      : mode === 'inputs' ? 'Input Readiness' : 'Advanced VE Analyzer Inputs';
    advancedTool.panel.setAttribute('aria-label', title);
    const heading = advancedTool.panel.querySelector('.ve-v50-tool-surface-head strong');
    if (heading) heading.textContent = title;
    advancedTool.open();
  };

  const advancedButton = root.querySelector<HTMLButtonElement>('.ve-v50-advanced-button');
  if (advancedButton && advancedTool) {
    const replacement = advancedButton.cloneNode(true) as HTMLButtonElement;
    replacement.addEventListener('click', () => openAdvancedMode('advanced'));
    advancedButton.replaceWith(replacement);
  }

  const quickControls = root.querySelector<HTMLElement>('.ve-workbench-quick-controls');
  if (quickControls && advancedTool) {
    const exclusions = document.createElement('button');
    exclusions.type = 'button';
    exclusions.className = 've-v50-advanced-button ve-v50-exclusions-button';
    exclusions.textContent = 'Exclusions';
    exclusions.addEventListener('click', () => openAdvancedMode('exclusions'));
    quickControls.append(exclusions);
  }

  // Inputs Ready points at the detailed readiness report, not Advanced mappings.
  // The Run strip can be installed after this layer, so use a delegated listener.
  root.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    if (!event.target.closest('.ve-v50-run-chips > .ve-v50-status-chip:first-child')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openAdvancedMode('inputs');
  }, { capture: true });

  if (lambdaTool) {
    const workflow = root.querySelector<HTMLElement>('.ve-delay-workflow-state');
    if (workflow) {
      workflow.classList.add('ve-v50-lambda-tool-trigger');
      workflow.tabIndex = 0;
      workflow.setAttribute('role', 'button');
      workflow.setAttribute('aria-label', 'Open Lambda Delay Table');
      workflow.addEventListener('click', lambdaTool.open);
      workflow.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        lambdaTool.open();
      });
    }
  }

  host.addEventListener('pointerdown', (event) => {
    if (event.target !== host) return;
    advancedTool?.close();
    lambdaTool?.close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    advancedTool?.close();
    lambdaTool?.close();
  });
}
