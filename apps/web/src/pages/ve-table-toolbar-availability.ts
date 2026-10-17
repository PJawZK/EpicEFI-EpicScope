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

/** Table-command availability is presentation-only: semantic edits still require a
 * selection, but command configuration must stay accessible before selection.
 * Undo/Redo remain driven by the table surface's history stacks.
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
