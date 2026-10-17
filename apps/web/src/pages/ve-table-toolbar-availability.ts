const installedRoots = new WeakSet<HTMLElement>();

const SELECTION_COMMAND_PREFIXES = [
  'Decrease selected cells',
  'Increase selected cells',
  'Pin or unpin selected cells',
  'Interpolate horizontally',
  'Interpolate vertically',
  'Interpolate both directions',
  'Smooth selected cells',
  'Revert selected cells',
  'Clear selected cells',
] as const;

function isSelectionCommand(button: HTMLButtonElement): boolean {
  const label = button.getAttribute('aria-label') ?? '';
  return SELECTION_COMMAND_PREFIXES.some((prefix) => label.startsWith(prefix));
}

function selectionButtons(toolbar: HTMLElement): HTMLButtonElement[] {
  return [...toolbar.querySelectorAll<HTMLButtonElement>('button')].filter(isSelectionCommand);
}

function proposalTable(root: HTMLElement): HTMLTableElement | null {
  const table = root.querySelector<HTMLTableElement>('[data-ve-analyzer="ve-table-view"] table.ve-workbench-table');
  return table && (!table.dataset.veResultView || table.dataset.veResultView === 'proposal') ? table : null;
}

function delayTable(root: HTMLElement): HTMLTableElement | null {
  return root.querySelector<HTMLTableElement>('[data-ve-analyzer="delay-table"] table.ve-delay-table');
}

function hasSelection(table: HTMLTableElement | null): boolean {
  return Boolean(table?.querySelector('td[data-table-selected="true"]'));
}

function setSelectionAvailability(toolbar: HTMLElement | null): void {
  if (!toolbar) return;
  // v50 commands stay accessible so users can open right-click configuration
  // before choosing cells. Applying an edit still requires semantic selection,
  // enforced by TableInteractionSession. Undo/Redo retain history gating.
  for (const button of selectionButtons(toolbar)) {
    button.setAttribute('aria-disabled', 'false');
    button.dataset.commandAvailable = 'true';
  }
}

/**
 * Presentation/input guard for v50 selection-dependent table commands.
 *
 * Selection remains owned by TableInteractionSession; this installer consumes the
 * session's existing DOM projection only to keep command affordance in sync. It
 * intentionally does not infer tune/domain state, and it leaves Undo/Redo to the
 * semantic history owner instead of inventing history availability here.
 *
 * aria-disabled is used instead of the native disabled property so right-click
 * tool configuration remains reachable on configurable commands. A command click
 * re-checks the current selection synchronously because programmatic/native input
 * can select and invoke a command in the same task, before MutationObserver paint
 * synchronization has run.
 */
export function installVeTableToolbarSelectionAvailability(root: HTMLElement): void {
  if (installedRoots.has(root)) return;
  installedRoots.add(root);

  const sync = (): void => {
    setSelectionAvailability(root.querySelector<HTMLElement>('.ve-proposal-shared-toolbar'));
    setSelectionAvailability(root.querySelector<HTMLElement>('.ve-delay-shared-toolbar'));
  };

  root.addEventListener('click', (event) => {
    const button = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>('.ve-table-edit-toolbar > button')
      : null;
    if (!button || !root.contains(button)) return;

    if (isSelectionCommand(button)) return;
    if (button.getAttribute('aria-disabled') !== 'true') return;

    event.preventDefault();
    event.stopImmediatePropagation();
  }, { capture: true });

  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === 'childList' || record.attributeName === 'data-table-selected')) sync();
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['data-table-selected'],
  });
  sync();
}
