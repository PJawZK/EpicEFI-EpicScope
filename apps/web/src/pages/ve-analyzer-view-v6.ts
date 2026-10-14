import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { VE_CELL_CHANGE_PRIOR_WEIGHT, type VeCellChangeAuthority } from './ve-analyzer-qualification';
import { veProposalSettingIssues } from './ve-analyzer-readiness';
import {
  createVeAnalyzerView as createVeAnalyzerViewV5,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v5';

interface RunBlocker {
  readonly message: string;
  readonly target?: HTMLElement;
}

const OPTIONAL_BOUND_ROLES = [
  'min-rpm',
  'max-rpm',
  'min-load',
  'max-load',
] as const;

function inputValue(root: HTMLElement, role: string): string {
  return root.querySelector<HTMLInputElement>(`input[data-role="${role}"]`)?.value ?? '';
}

function proposalBlockers(root: HTMLElement): RunBlocker[] {
  const issues = veProposalSettingIssues({
    priorWeight: inputValue(root, 'prior-weight'),
    minimumEvidenceWeight: inputValue(root, 'min-evidence-weight'),
    maximumAbsoluteChange: inputValue(root, 'max-absolute-change'),
    maximumPercentChange: inputValue(root, 'max-percent-change'),
  });
  return issues.map((message) => {
    const role = message.startsWith('Prior weight') ? 'prior-weight'
      : message.startsWith('Minimum evidence weight') ? 'min-evidence-weight'
        : message.startsWith('Max VE change %') ? 'max-percent-change'
          : 'max-absolute-change';
    return { message, target: root.querySelector<HTMLElement>(`input[data-role="${role}"]`) ?? undefined };
  });
}

function targetForReadinessName(root: HTMLElement, name: string): HTMLElement | undefined {
  const roleByName: Readonly<Record<string, string>> = {
    'MSQ VE table': 've-table',
    'VE RPM axis': 'rpm-axis',
    'VE load axis': 'load-axis',
    'MSQ target mixture table': 'target-table',
    'Target RPM axis': 'target-rpm-axis',
    'Target load axis': 'target-load-axis',
    'Mixture scale': 'mixture-scale',
    'Fuel correction compensation': 'stft',
    'RPM': 'rpm',
    'VE-table load': 'load',
    'Actual mixture': 'actual',
  };
  const role = roleByName[name];
  return role ? root.querySelector<HTMLElement>(`[data-role="${role}"]`) ?? undefined : undefined;
}

function readinessBlockers(
  root: HTMLElement,
  delayHost: HTMLElement,
  grabDelay: HTMLButtonElement,
  useDelay: HTMLButtonElement,
): RunBlocker[] {
  const body = root.querySelector<HTMLTableSectionElement>('[data-ve-analyzer="readiness-body"]');
  if (!body) return [];
  const blockers: RunBlocker[] = [];
  for (const row of body.rows) {
    const cells = [...row.cells].map((cell) => cell.textContent?.trim() ?? '');
    const [name, , requirement, source, status] = cells;
    if (requirement !== 'Required' || !name) continue;
    const bad = !source || source === '—' || /missing|mismatch|unavailable|required source unavailable|enter non-negative|discover\/use recommendation|load a saved/i.test(status ?? '');
    if (!bad) continue;
    if (name === 'Proposal settings') {
      blockers.push(...proposalBlockers(root));
      continue;
    }
    if (name === 'Lambda delay table') {
      const recommendationReady = !useDelay.disabled;
      blockers.push(recommendationReady
        ? { message: 'Activate the lambda-delay recommendation with Use recommendation.', target: useDelay }
        : { message: 'Create or load a working lambda-delay table.', target: grabDelay });
      continue;
    }
    const detail = status && status !== 'Missing' ? ` — ${status}` : '';
    blockers.push({ message: `${name}${detail}`, target: targetForReadinessName(root, name) });
  }
  if (delayHost.dataset.mode !== 'working' && blockers.every((blocker) => !/lambda-delay/i.test(blocker.message))) {
    blockers.unshift(!useDelay.disabled
      ? { message: 'Activate the lambda-delay recommendation with Use recommendation.', target: useDelay }
      : { message: 'Create or load a working lambda-delay table.', target: grabDelay });
  }
  return blockers;
}

function focusBlocker(target: HTMLElement | undefined): void {
  if (!target) return;
  const details = target.closest<HTMLDetailsElement>('details');
  if (details) details.open = true;
  target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  queueMicrotask(() => target.focus({ preventScroll: true }));
}

export function createVeAnalyzerView(): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV5();
  const root = inner.element;
  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar')!;
  const runButton = root.querySelector<HTMLButtonElement>('.ve-workbench-run')!;
  const readiness = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness"]')!;
  const delayHost = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]')!;
  const grabDelay = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="grab-delay"]')!;
  const useDelay = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="use-delay"]')!;

  const blockerPanel = document.createElement('div');
  blockerPanel.className = 've-run-blocker-panel';
  blockerPanel.hidden = true;
  actionbar.insertAdjacentElement('afterend', blockerPanel);

  const annotateOptionalBounds = (): void => {
    for (const role of OPTIONAL_BOUND_ROLES) {
      const field = root.querySelector<HTMLInputElement>(`input[data-role="${role}"]`);
      if (!field) continue;
      field.placeholder = 'Full range';
      field.title = 'Optional. Leave blank to use the full available range.';
      field.dataset.veOptionalBound = 'true';
    }
    for (const selector of ['min-clt', 'min-tps', 'max-tps'] as const) {
      const field = root.querySelector<HTMLInputElement>(`input[data-ve-quick="${selector}"]`);
      if (!field) continue;
      field.placeholder = 'Full range';
      field.title = 'Optional. Leave blank to disable this limit and use the full available range.';
      field.dataset.veOptionalBound = 'true';
    }
  };

  const syncPriorAuthority = (): void => {
    const authority = root.querySelector<HTMLSelectElement>('select[data-ve-quick="cell-change"]');
    const prior = root.querySelector<HTMLInputElement>('input[data-role="prior-weight"]');
    if (!authority || !prior) return;
    const mode = authority.value as VeCellChangeAuthority;
    if (mode === 'custom' || prior.value.trim() !== '') return;
    prior.value = String(VE_CELL_CHANGE_PRIOR_WEIGHT[mode]);
    prior.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const renderBlockers = (): void => {
    annotateOptionalBounds();
    syncPriorAuthority();
    if (!runButton.disabled) {
      blockerPanel.hidden = true;
      blockerPanel.replaceChildren();
      return;
    }
    const blockers = readinessBlockers(root, delayHost, grabDelay, useDelay);
    if (blockers.length === 0) {
      blockerPanel.hidden = false;
      blockerPanel.innerHTML = '<strong>Run Analysis is blocked</strong><span>Open Advanced inputs and readiness for the unresolved required input.</span>';
      return;
    }
    blockerPanel.hidden = false;
    blockerPanel.replaceChildren();
    const heading = document.createElement('strong');
    heading.textContent = `Run Analysis needs ${blockers.length} ${blockers.length === 1 ? 'fix' : 'fixes'}`;
    blockerPanel.append(heading);
    for (const blocker of blockers) {
      const item = document.createElement('div');
      item.className = 've-run-blocker-item';
      const text = document.createElement('span');
      text.textContent = blocker.message;
      item.append(text);
      if (blocker.target) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Fix';
        button.onclick = () => focusBlocker(blocker.target);
        item.append(button);
      }
      blockerPanel.append(item);
    }
    readiness.textContent = `Run blocked · ${blockers.length} ${blockers.length === 1 ? 'issue' : 'issues'}`;
    readiness.title = blockers.map((blocker) => blocker.message).join('; ');
  };

  const refocusDelaySelection = (): void => {
    if (delayHost.querySelector('.ve-delay-inline-input')) return;
    const anchor = delayHost.querySelector<HTMLTableCellElement>('td[data-delay-anchor="true"]');
    anchor?.focus({ preventScroll: true });
  };

  delayHost.addEventListener('pointerup', () => queueMicrotask(refocusDelaySelection));
  let hadInlineInput = Boolean(delayHost.querySelector('.ve-delay-inline-input'));
  const observer = new MutationObserver(() => {
    const hasInlineInput = Boolean(delayHost.querySelector('.ve-delay-inline-input'));
    if (hadInlineInput && !hasInlineInput) queueMicrotask(refocusDelaySelection);
    hadInlineInput = hasInlineInput;
    queueMicrotask(renderBlockers);
  });
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'data-mode'] });
  root.addEventListener('change', () => queueMicrotask(renderBlockers));
  root.addEventListener('input', () => queueMicrotask(renderBlockers));

  queueMicrotask(renderBlockers);

  return {
    element: root,
    setContext(context: LoggerAnalysisContext) {
      inner.setContext(context);
      queueMicrotask(renderBlockers);
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      inner.setTuneModel(model, sourceName);
      queueMicrotask(renderBlockers);
    },
    refresh() {
      inner.refresh();
      queueMicrotask(renderBlockers);
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v5';
