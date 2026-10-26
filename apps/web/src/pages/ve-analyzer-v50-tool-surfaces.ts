import { veDelayPresentationOwner } from './ve-analyzer-delay-presentation-owner';
import { closeVeAnalyzerSetupDisclosures } from './ve-analyzer-v50-setup-disclosure';
import { registerVeReadinessTargetRevealer } from './ve-analyzer-readiness';
import './ve-analyzer-v50-tool-surfaces.css';

interface ToolSurface {
  readonly details: HTMLDetailsElement;
  readonly panel: HTMLElement;
  readonly open: () => void;
  readonly close: (restoreFocus?: boolean) => void;
  readonly toggle: () => void;
}

function createToolSurface(
  host: HTMLElement,
  details: HTMLDetailsElement,
  title: string,
  className: string,
  closeOthers: (current: HTMLDetailsElement) => void,
  canOpen: () => boolean,
  visibilityChanged?: (visible: boolean) => void,
): ToolSurface {
  details.open = false;
  details.classList.add('ve-v50-tool-details', className);

  const originalSummary = details.querySelector<HTMLElement>(':scope > summary');
  if (originalSummary) originalSummary.hidden = true;

  const panel = document.createElement('section');
  panel.className = 've-v50-tool-surface';
  panel.hidden = true;
  panel.setAttribute('aria-label', title);
  panel.setAttribute('role', 'dialog');

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

  let opener: HTMLElement | undefined;
  const close = (restoreFocus = true): void => {
    if (panel.hidden) return;
    panel.hidden = true;
    details.open = false;
    visibilityChanged?.(false);
    if (restoreFocus && opener?.isConnected && !opener.closest('[hidden]')) opener.focus({ preventScroll: true });
    opener = undefined;
  };
  const open = (): void => {
    if (!canOpen()) return;
    const wasHidden = panel.hidden;
    if (wasHidden) {
      const focused = document.activeElement;
      opener = focused instanceof HTMLElement && host.parentElement?.contains(focused) && !focused.closest('[hidden]')
        ? focused : undefined;
    }
    if (host.parentElement) closeVeAnalyzerSetupDisclosures(host.parentElement);
    closeOthers(details);
    details.open = true;
    panel.hidden = false;
    visibilityChanged?.(true);
    if (wasHidden) closeButton.focus({ preventScroll: true });
  };
  visibilityChanged?.(false);

  closeButton.addEventListener('click', () => close());
  panel.addEventListener('pointerdown', (event) => {
    if (event.target === panel) close();
  });

  const toggle = (): void => panel.hidden ? open() : close();
  return { details, panel, open, close, toggle };
}

/**
 * Adapts the existing production-owned Advanced and Lambda Delay details into
 * v50-style secondary tool surfaces. No domain state is copied: the original
 * nodes, listeners and controls are re-parented intact.
 */
export interface VeAnalyzerToolSurfaces {
  setActive(active: boolean): void;
  dispose(): void;
}

export function installVeAnalyzerV50ToolSurfaces(root: HTMLElement): VeAnalyzerToolSurfaces {
  const noop: VeAnalyzerToolSurfaces = { setActive() {}, dispose() {} };
  if (root.querySelector('.ve-v50-tool-host')) return noop;

  const advanced = root.querySelector<HTMLDetailsElement>('.ve-workbench-advanced');
  const lambda = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]')?.closest<HTMLDetailsElement>('details');
  if (!advanced && !lambda) return noop;
  let active = true;
  let disposed = false;
  const events = new AbortController();
  const canOpen = (): boolean => active && !disposed;

  const host = document.createElement('div');
  host.className = 've-v50-tool-host';
  root.append(host);

  const tools: ToolSurface[] = [];
  const closeOthers = (current: HTMLDetailsElement): void => {
    for (const tool of tools) if (tool.details !== current) tool.close(false);
  };
  const advancedTool = advanced ? createToolSurface(host, advanced, 'Advanced VE Analyzer Inputs', 've-v50-tool-advanced', closeOthers, canOpen) : undefined;
  if (advancedTool) tools.push(advancedTool);
  const lambdaTool = lambda ? createToolSurface(host, lambda, 'Lambda Delay Table', 've-v50-tool-lambda', closeOthers, canOpen,
    (visible) => veDelayPresentationOwner(root)?.setVisible(visible)) : undefined;
  if (lambdaTool) tools.push(lambdaTool);

  // Keep all Advanced descendants in their original production-owned subtree.
  // v2 caches the readiness tbody and queries role selects inside this details;
  // moving those nodes breaks its rebuild lifecycle.
  const openAdvancedMode = (mode: 'advanced' | 'exclusions' | 'inputs', toggle = true): void => {
    if (!canOpen() || !advancedTool) return;
    const sameVisibleMode = !advancedTool.panel.hidden && advancedTool.panel.dataset.veToolMode === mode;
    advancedTool.panel.dataset.veToolMode = mode;
    const title = mode === 'exclusions' ? 'State Exclusions'
      : mode === 'inputs' ? 'Input Readiness' : 'Advanced VE Analyzer Inputs';
    advancedTool.panel.setAttribute('aria-label', title);
    const heading = advancedTool.panel.querySelector('.ve-v50-tool-surface-head strong');
    if (heading) heading.textContent = title;
    advancedTool.panel.querySelector('.ve-v50-tool-surface-close')?.setAttribute('aria-label', `Close ${title}`);
    if (toggle && sameVisibleMode) advancedTool.close();
    else advancedTool.open();
  };

  const unregisterRevealer = registerVeReadinessTargetRevealer(root, (target) => {
    if (!canOpen()) return undefined;
    if (advancedTool?.details.contains(target)) {
      const exclusions = target.matches('select[data-role="dfco"], select[data-role="fuelCutReason"], select[data-role="aeActive"], select[data-role="decelActive"]');
      openAdvancedMode(exclusions ? 'exclusions' : 'advanced', false);
      return target;
    }
    if (lambdaTool?.details.contains(target)) {
      lambdaTool.open();
      // Discovery can be unavailable until mappings exist; loading a saved
      // table is still an actionable way to resolve the delay prerequisite.
      return target instanceof HTMLButtonElement && target.disabled
        ? lambdaTool.details.querySelector<HTMLButtonElement>('[data-ve-analyzer="load-delay"]') ?? target : target;
    }
    const setup = target.closest<HTMLDetailsElement>('.ve-v50-setup-group');
    if (setup) {
      advancedTool?.close(false); lambdaTool?.close(false);
      for (const group of root.querySelectorAll<HTMLDetailsElement>('.ve-v50-setup-group')) group.open = group === setup;
      return target.matches('select[data-role="scope"]')
        ? setup.querySelector<HTMLButtonElement>('.ve-v50-scope-choice[data-selected="true"]')
          ?? setup.querySelector<HTMLButtonElement>('.ve-v50-scope-choice') ?? target : target;
    }
    return undefined;
  });

  const advancedButton = root.querySelector<HTMLButtonElement>('.ve-v50-advanced-button');
  if (advancedButton && advancedTool) {
    // Replace only the fallback action, retaining the original node/listeners.
    advancedButton.onclick = () => openAdvancedMode('advanced');
  }

  const quickControls = root.querySelector<HTMLElement>('.ve-workbench-quick-controls');
  if (quickControls && advancedTool) {
    const exclusions = document.createElement('button');
    exclusions.type = 'button';
    exclusions.className = 've-v50-advanced-button ve-v50-exclusions-button';
    exclusions.textContent = 'Exclusions';
    exclusions.addEventListener('click', () => openAdvancedMode('exclusions'), { signal: events.signal });
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
  }, { capture: true, signal: events.signal });

  if (lambdaTool) {
    const workflow = root.querySelector<HTMLElement>('.ve-delay-workflow-state');
    if (workflow) {
      workflow.classList.add('ve-v50-lambda-tool-trigger');
      workflow.tabIndex = 0;
      workflow.setAttribute('role', 'button');
      workflow.setAttribute('aria-label', 'Open Lambda Delay Table');
      workflow.addEventListener('click', lambdaTool.toggle, { signal: events.signal });
      workflow.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        lambdaTool.toggle();
      }, { signal: events.signal });
    }
  }

  host.addEventListener('pointerdown', (event) => {
    if (event.target !== host) return;
    advancedTool?.close();
    lambdaTool?.close();
  }, { signal: events.signal });

  root.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.key !== 'Escape' || !canOpen() || tools.every(tool => tool.panel.hidden)) return;
    event.preventDefault();
    advancedTool?.close();
    lambdaTool?.close();
  }, { signal: events.signal });
  return {
    setActive(next) {
      if (disposed) return;
      active = next;
      if (!next) for (const tool of tools) tool.close(false);
    },
    dispose() {
      if (disposed) return;
      active = false; disposed = true;
      for (const tool of tools) tool.close(false);
      events.abort(); unregisterRevealer();
      if (advancedButton) advancedButton.onclick = null;
    },
  };
}
