import type { TuneModel } from '../../../../core/tune/tune-model';
import type { LoggerAnalysisContext } from './logger-page';
import { veProposalSettingIssues } from './ve-analyzer-readiness';
import {
  createVeAnalyzerView as createVeAnalyzerViewV3,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v3';

function inputValue(root: HTMLElement, role: string): string {
  return root.querySelector<HTMLInputElement>(`input[data-role="${role}"]`)?.value ?? '';
}

function proposalSettingBlockers(root: HTMLElement): string[] {
  return veProposalSettingIssues({
    priorWeight: inputValue(root, 'prior-weight'),
    minimumEvidenceWeight: inputValue(root, 'min-evidence-weight'),
    maximumAbsoluteChange: inputValue(root, 'max-absolute-change'),
    maximumPercentChange: inputValue(root, 'max-percent-change'),
  });
}

function requiredBlockers(root: HTMLElement): string[] {
  const body = root.querySelector<HTMLTableSectionElement>('[data-ve-analyzer="readiness-body"]');
  if (!body) return [];
  const blockers: string[] = [];
  for (const row of body.rows) {
    const cells = [...row.cells].map((cell) => cell.textContent?.trim() ?? '');
    const [name, , requirement, source, status] = cells;
    if (requirement !== 'Required') continue;
    const bad = !source || source === '—' || /missing|mismatch|unavailable|required source unavailable|enter non-negative|discover\/use recommendation|load a saved/i.test(status ?? '');
    if (!bad || !name) continue;
    if (name === 'Proposal settings') {
      const issues = proposalSettingBlockers(root);
      blockers.push(...(issues.length > 0 ? issues : ['Proposal settings contain an invalid value']));
    } else {
      blockers.push(name);
    }
  }
  return blockers;
}

export function createVeAnalyzerView(): VeAnalyzerViewController {
  const inner = createVeAnalyzerViewV3();
  const root = inner.element;
  const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar')!;
  const quick = root.querySelector<HTMLElement>('.ve-workbench-quick-controls')!;
  const runButton = root.querySelector<HTMLButtonElement>('.ve-workbench-run')!;
  const readiness = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness"]')!;
  const delayHost = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-table"]')!;
  const grabDelay = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="grab-delay"]')!;
  const useDelay = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="use-delay"]')!;
  const loadDelay = root.querySelector<HTMLButtonElement>('[data-ve-analyzer="load-delay"]')!;
  const delayResultTitle = root.querySelector<HTMLElement>('[data-ve-analyzer="delay-result-title"]')!;

  const delayDetails = [...root.querySelectorAll<HTMLDetailsElement>('details.specialized-analyzer-options')]
    .find((details) => details.querySelector('summary')?.textContent?.trim() === 'Lambda Delay Table');

  if (delayDetails) {
    delayDetails.classList.add('ve-delay-primary-workflow');
    delayDetails.open = true;
    quick.insertAdjacentElement('afterend', delayDetails);
  }

  const workflowState = document.createElement('div');
  workflowState.className = 've-delay-workflow-state';
  workflowState.innerHTML = `
    <strong data-ve-delay-flow="title">Lambda delay required</strong>
    <span data-ve-delay-flow="detail">Grab delays from this log or load a saved working table before Run Analysis.</span>`;
  actionbar.insertBefore(workflowState, readiness);
  const flowTitle = workflowState.querySelector<HTMLElement>('[data-ve-delay-flow="title"]')!;
  const flowDetail = workflowState.querySelector<HTMLElement>('[data-ve-delay-flow="detail"]')!;

  // v5 owns delay-cell selection/editing. v4 now only owns the lambda-delay
  // workflow status and no longer creates a bulk editor that v5 immediately removes.
  const updateWorkflowState = (): void => {
    const mode = delayHost.dataset.mode ?? 'none';
    const recommendationReady = !useDelay.disabled;
    if (mode === 'working') {
      workflowState.dataset.state = 'ready';
      flowTitle.textContent = 'Lambda delay ready';
      flowDetail.textContent = 'A working delay table is active. Run Analysis can proceed once the remaining required inputs are valid.';
    } else if (recommendationReady) {
      workflowState.dataset.state = 'action';
      flowTitle.textContent = 'Lambda delay recommendation ready';
      flowDetail.textContent = 'Press Use recommendation to make it the working delay table, or load a saved working table.';
    } else {
      workflowState.dataset.state = 'required';
      flowTitle.textContent = 'Lambda delay required';
      flowDetail.textContent = 'Grab delays from this log or load a saved working table before Run Analysis.';
    }

    const blockers = requiredBlockers(root);
    if (runButton.disabled && mode === 'working' && blockers.length > 0) {
      readiness.textContent = `Run blocked: ${blockers.join(' · ')}`;
      readiness.title = `Resolve: ${blockers.join('; ')}`;
    } else if (runButton.disabled && mode !== 'working') {
      readiness.textContent = recommendationReady ? 'Run blocked: activate lambda delay recommendation' : 'Run blocked: lambda delay required';
      readiness.title = flowDetail.textContent ?? '';
    }
  };

  for (const button of [grabDelay, useDelay, loadDelay]) {
    button.addEventListener('click', () => queueMicrotask(updateWorkflowState));
  }

  const observer = new MutationObserver(updateWorkflowState);
  observer.observe(delayHost, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-mode'] });
  observer.observe(useDelay, { attributes: true, attributeFilter: ['disabled'] });
  observer.observe(delayResultTitle, { childList: true, subtree: true, characterData: true });
  const readinessBody = root.querySelector<HTMLElement>('[data-ve-analyzer="readiness-body"]');
  if (readinessBody) observer.observe(readinessBody, { childList: true, subtree: true });

  updateWorkflowState();

  return {
    element: root,
    setContext(context: LoggerAnalysisContext) {
      inner.setContext(context);
      queueMicrotask(updateWorkflowState);
    },
    setTuneModel(model: TuneModel | undefined, sourceName?: string) {
      inner.setTuneModel(model, sourceName);
      queueMicrotask(updateWorkflowState);
    },
    refresh() {
      inner.refresh();
      queueMicrotask(updateWorkflowState);
    },
  };
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v3';
