import type { LoggerAnalysisContext } from './logger-page';
import type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
import '../styles/ve-analyzer-v50-secondary-tools.css';

interface SecondaryTool {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly available: () => boolean;
  readonly run: () => void;
}

function hiddenByOwner(node: Element | null | undefined): boolean {
  if (!node) return true;
  return Boolean(node.closest('[hidden]'));
}

function revealDetails(details: HTMLDetailsElement | null | undefined, target?: HTMLElement | null): void {
  if (!details) return;
  details.open = true;
  queueMicrotask(() => {
    const destination = target ?? details;
    destination.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLButtonElement) {
      target.focus({ preventScroll: true });
    }
  });
}

/**
 * Presentation-only transfer of the frozen v50 secondary-tool strip.
 *
 * Every action delegates to an already-existing production owner. This layer does
 * not create summary/evidence/readiness/mapping/exclusion/Lambda state of its own.
 */
export function installVeAnalyzerV50SecondaryTools(inner: VeAnalyzerViewController): VeAnalyzerViewController {
  const root = inner.element;
  if (root.querySelector('.ve-v50-secondary-tools')) return inner;

  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar');
  if (!actionbar) return inner;

  const strip = document.createElement('nav');
  strip.className = 've-v50-secondary-tools';
  strip.setAttribute('aria-label', 'VE Analyzer review and secondary tools');

  const caption = document.createElement('span');
  caption.className = 've-v50-secondary-tools-caption';
  caption.textContent = 'Review & tools';
  strip.append(caption);

  const content = () => root.querySelector<HTMLElement>('.specialized-analyzer-content');
  const summary = () => root.querySelector<HTMLElement>('[data-ve-analyzer="summary"]');
  const lambdaDetails = () => root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]')?.closest<HTMLDetailsElement>('details');
  const advancedDetails = () => root.querySelector<HTMLDetailsElement>('.ve-workbench-advanced');
  const readinessSection = () => root.querySelector<HTMLElement>('[data-ve-analyzer="readiness-body"]')?.closest<HTMLElement>('.specialized-analyzer-events');
  const mappingControl = () => root.querySelector<HTMLElement>('[data-ve-analyzer="controls"] select[data-role="rpm"]')
    ?? root.querySelector<HTMLElement>('[data-ve-analyzer="controls"] select');
  const exclusionControl = () => root.querySelector<HTMLElement>('[data-ve-analyzer="controls"] select[data-role="dfco"]')
    ?? root.querySelector<HTMLElement>('[data-ve-analyzer="controls"] select[data-role="fuelCutReason"]')
    ?? root.querySelector<HTMLElement>('[data-ve-analyzer="controls"] select[data-role="aeActive"]')
    ?? root.querySelector<HTMLElement>('[data-ve-analyzer="controls"] select[data-role="decelActive"]');
  const evidenceAction = () => root.querySelector<HTMLButtonElement>('.ve-proposal-shared-toolbar button[aria-label="Cell Evidence"]');

  const tools: readonly SecondaryTool[] = [
    {
      id: 'summary',
      label: 'Summary',
      title: 'Jump to the current VE analysis summary',
      available: () => {
        const node = summary();
        return Boolean(node && !hiddenByOwner(node) && (node.textContent?.trim().length ?? 0) > 0);
      },
      run: () => summary()?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }),
    },
    {
      id: 'lambda-delay',
      label: 'Lambda Delay',
      title: 'Open the working Lambda Delay surface',
      available: () => Boolean(lambdaDetails() && content() && !hiddenByOwner(content())),
      run: () => revealDetails(lambdaDetails()),
    },
    {
      id: 'mappings',
      label: 'Mappings',
      title: 'Open advanced channel mappings',
      available: () => Boolean(advancedDetails() && mappingControl() && content() && !hiddenByOwner(content())),
      run: () => revealDetails(advancedDetails(), mappingControl()),
    },
    {
      id: 'exclusions',
      label: 'Exclusions',
      title: 'Open state-exclusion channel mappings',
      available: () => Boolean(advancedDetails() && exclusionControl() && content() && !hiddenByOwner(content())),
      run: () => revealDetails(advancedDetails(), exclusionControl()),
    },
    {
      id: 'readiness',
      label: 'Readiness',
      title: 'Open detailed VE input readiness',
      available: () => Boolean(advancedDetails() && readinessSection() && content() && !hiddenByOwner(content())),
      run: () => revealDetails(advancedDetails(), readinessSection()),
    },
    {
      id: 'cell-evidence',
      label: 'Cell Evidence',
      title: 'Open evidence for the selected VE cell',
      available: () => {
        const action = evidenceAction();
        return Boolean(action && !action.hidden && !hiddenByOwner(action));
      },
      run: () => evidenceAction()?.click(),
    },
  ];

  const buttons = new Map<string, HTMLButtonElement>();
  for (const tool of tools) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 've-v50-secondary-tool';
    button.dataset.veV50Secondary = tool.id;
    button.textContent = tool.label;
    button.title = tool.title;
    button.addEventListener('click', tool.run);
    buttons.set(tool.id, button);
    strip.append(button);
  }

  actionbar.insertAdjacentElement('afterend', strip);

  const sync = (): void => {
    for (const tool of tools) {
      const button = buttons.get(tool.id);
      if (button) button.disabled = !tool.available();
    }
  };
  const scheduleSync = (): void => queueMicrotask(sync);

  root.addEventListener('change', scheduleSync);
  root.addEventListener('pointerdown', scheduleSync, { capture: true });
  inner.onPrimaryAnalysisChange(scheduleSync);
  scheduleSync();

  return {
    element: root,
    setActive(active) {
      inner.setActive(active);
      if (active) scheduleSync();
    },
    editDelayCells(positions, edit) {
      const changed = inner.editDelayCells(positions, edit);
      scheduleSync();
      return changed;
    },
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    getReadiness() { return inner.getReadiness(); },
    onReadinessChange(listener) { return inner.onReadinessChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      scheduleSync();
      return changed;
    },
    setTuneModel(model, sourceName) {
      const changed = inner.setTuneModel(model, sourceName);
      scheduleSync();
      return changed;
    },
    refresh() {
      inner.refresh();
      scheduleSync();
    },
  };
}
