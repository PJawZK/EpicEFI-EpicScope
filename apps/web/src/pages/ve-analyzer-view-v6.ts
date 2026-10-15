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

function blocker(message: string, target?: HTMLElement): RunBlocker {
  return target ? { message, target } : { message };
}

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
    return blocker(message, root.querySelector<HTMLElement>(`input[data-role="${role}"]`) ?? undefined);
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
    'Prior weight': 'prior-weight',
    'Minimum evidence weight': 'min-evidence-weight',
    'Max VE change': 'max-absolute-change',
    'Max VE change %': 'max-percent-change',
  };
  const role = roleByName[name];
  return role ? root.querySelector<HTMLElement>(`[data-role="${role}"]`) ?? undefined : undefined;
}

function settingState(raw: string, location: string): { source: string; status: string; valid: boolean } {
  const text = raw.trim();
  if (!text) return { source: '—', status: `Missing value · ${location}`, valid: false };
  const value = Number(text);
  if (!Number.isFinite(value)) return { source: text, status: `Invalid number · ${location}`, valid: false };
  if (value < 0) return { source: text, status: `Must be 0 or greater · ${location}`, valid: false };
  return { source: text, status: `Resolved · ${location}`, valid: true };
}

function replaceProposalSettingsRow(root: HTMLElement, body: HTMLElement): void {
  const tableBody = body as HTMLTableSectionElement;
  const generic = [...tableBody.rows].find((row) => row.cells[0]?.textContent?.trim() === 'Proposal settings');
  if (!generic) return;

  const definitions = [
    ['Prior weight', 'Proposal authority', 'prior-weight', 'Cell Change preset or Advanced → Prior weight'],
    ['Minimum evidence weight', 'Evidence threshold', 'min-evidence-weight', 'VE controls → Min evidence weight'],
    ['Max VE change', 'Absolute safety limit', 'max-absolute-change', 'VE controls → Max VE change'],
    ['Max VE change %', 'Relative safety limit', 'max-percent-change', 'VE controls → Max VE change %'],
  ] as const;

  const rows = definitions.map(([name, purpose, role, location]) => {
    const state = settingState(inputValue(root, role), location);
    const row = document.createElement('tr');
    const values = [name, purpose, 'Required', state.source, state.status];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    }
    row.dataset.veProposalSetting = role;
    row.dataset.valid = state.valid ? 'true' : 'false';
    return row;
  });
  generic.replaceWith(...rows);
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
    const bad = !source || source === '—' || /missing|invalid|mismatch|unavailable|required source unavailable|must be 0 or greater|enter non-negative|discover\/use recommendation|load a saved/i.test(status ?? '');
    if (!bad) continue;
    if (name === 'Proposal settings') {
      blockers.push(...proposalBlockers(root));
      continue;
    }
    if (name === 'Lambda delay table') {
      const recommendationReady = !useDelay.disabled;
      blockers.push(recommendationReady
        ? blocker('Activate the lambda-delay recommendation with Use recommendation.', useDelay)
        : blocker('Create or load a working lambda-delay table.', grabDelay));
      continue;
    }
    const detail = status && status !== 'Missing' ? ` — ${status}` : '';
    blockers.push(blocker(`${name}${detail}`, targetForReadinessName(root, name)));
  }
  if (delayHost.dataset.mode !== 'working' && blockers.every((entry) => !/lambda-delay/i.test(entry.message))) {
    blockers.unshift(!useDelay.disabled
      ? blocker('Activate the lambda-delay recommendation with Use recommendation.', useDelay)
      : blocker('Create or load a working lambda-delay table.', grabDelay));
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
  const readinessBody = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness-body"]')!;
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

  let renderQueued = false;
  const scheduleRenderBlockers = (): void => {
    if (renderQueued) return;
    renderQueued = true;
    queueMicrotask(() => {
      renderQueued = false;
      renderBlockers();
    });
  };

  const renderBlockers = (): void => {
    annotateOptionalBounds();
    syncPriorAuthority();
    replaceProposalSettingsRow(root, readinessBody);
    if (!runButton.disabled) {
      blockerPanel.hidden = true;
      if (blockerPanel.childNodes.length > 0) blockerPanel.replaceChildren();
      return;
    }
    const blockers = readinessBlockers(root, delayHost, grabDelay, useDelay);
    if (blockers.length === 0) {
      blockerPanel.hidden = false;
      const fallback = 'Run Analysis is blocked\nOpen Advanced inputs and readiness for the unresolved required input.';
      if (blockerPanel.dataset.renderKey !== fallback) {
        blockerPanel.dataset.renderKey = fallback;
        blockerPanel.innerHTML = '<strong>Run Analysis is blocked</strong><span>Open Advanced inputs and readiness for the unresolved required input.</span>';
      }
      return;
    }
    const renderKey = blockers.map((entry) => entry.message).join('\n');
    blockerPanel.hidden = false;
    if (blockerPanel.dataset.renderKey !== renderKey) {
      blockerPanel.dataset.renderKey = renderKey;
      blockerPanel.replaceChildren();
      const heading = document.createElement('strong');
      heading.textContent = `Run Analysis needs ${blockers.length} ${blockers.length === 1 ? 'fix' : 'fixes'}`;
      blockerPanel.append(heading);
      for (const entry of blockers) {
        const item = document.createElement('div');
        item.className = 've-run-blocker-item';
        const text = document.createElement('span');
        text.textContent = entry.message;
        item.append(text);
        if (entry.target) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = 'Fix';
          button.onclick = () => focusBlocker(entry.target);
          item.append(button);
        }
        blockerPanel.append(item);
      }
    }
    readiness.textContent = `Run blocked · ${blockers.length} ${blockers.length === 1 ? 'issue' : 'issues'}`;
    readiness.title = blockers.map((entry) => entry.message).join('; ');
  };

  const readinessObserver = new MutationObserver(scheduleRenderBlockers);
  readinessObserver.observe(readinessBody, { childList: true, subtree: true });
  readinessObserver.observe(delayHost, { attributes: true, attributeFilter: ['data-mode'] });
  readinessObserver.observe(runButton, { attributes: true, attributeFilter: ['disabled'] });
  readinessObserver.observe(useDelay, { attributes: true, attributeFilter: ['disabled'] });

  root.addEventListener('change', scheduleRenderBlockers);
  root.addEventListener('input', (event) => {
    const target = event.target;
    // v5 owns live in-cell editing/focus. Do not recompute the whole Run blocker
    // UI on every delay digit; the committed table change updates readiness.
    if (target instanceof Element && target.closest('.ve-delay-inline-input')) return;
    scheduleRenderBlockers();
  });

  scheduleRenderBlockers();

  return {
    element: root,
    get sessionRevision() { return inner.sessionRevision; },
    getPrimaryAnalysis() { return inner.getPrimaryAnalysis(); },
    onPrimaryAnalysisChange(listener) { return inner.onPrimaryAnalysisChange(listener); },
    setContext(context: LoggerAnalysisContext) {
      const changed = inner.setContext(context);
      if (!changed) return false;
      scheduleRenderBlockers();
      return true;
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      const changed = inner.setTuneModel(model, sourceName);
      if (!changed) return false;
      scheduleRenderBlockers();
      return true;
    },
    refresh() {
      inner.refresh();
      scheduleRenderBlockers();
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v5';
