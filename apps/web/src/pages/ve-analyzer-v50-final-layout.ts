import './ve-analyzer-v50-final-layout.css';

const installedRoots = new WeakSet<HTMLElement>();

/**
 * Final presentation-order reconciliation against the frozen v50 workbench.
 *
 * Existing production nodes keep their listeners/state owners. This layer only
 * restores the visual workflow order: setup -> readiness/status -> primary Run,
 * with blockers immediately adjacent to the status row and secondary review
 * tools following the blocker surface.
 */
export function installVeAnalyzerV50FinalLayout(root: HTMLElement): void {
  if (installedRoots.has(root)) return;
  installedRoots.add(root);

  const sync = (): void => {
    const actionbar = root.querySelector<HTMLElement>('.ve-workbench-actionbar');
    if (!actionbar) return;

    const run = actionbar.querySelector<HTMLButtonElement>('.ve-workbench-run');
    if (run && actionbar.lastElementChild !== run) actionbar.append(run);

    const blocker = root.querySelector<HTMLElement>('.ve-run-blocker-panel');
    if (blocker && actionbar.nextElementSibling !== blocker) {
      actionbar.insertAdjacentElement('afterend', blocker);
    }

    const secondary = root.querySelector<HTMLElement>('.ve-v50-secondary-tools');
    if (secondary) {
      const anchor = blocker ?? actionbar;
      if (anchor.nextElementSibling !== secondary) anchor.insertAdjacentElement('afterend', secondary);
    }
  };

  // v50 presentation and secondary-tool installers have already run before this
  // adapter is installed. Keep one microtask resync for controller-driven rebuilds
  // that may replace readiness/blocker presentation in the same turn.
  sync();
  queueMicrotask(sync);
  root.addEventListener('ve-proposal-table-rendered', sync);
}
