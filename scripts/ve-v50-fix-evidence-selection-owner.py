from pathlib import Path
p = Path('apps/web/src/pages/ve-analyzer-proposal-table-interaction.ts')
s = p.read_text()

def r(old: str, new: str) -> None:
    global s
    if old not in s:
        raise SystemExit('missing pattern: ' + old[:160])
    s = s.replace(old, new, 1)

r(
'''  dom.toolbar.classList.add('ve-proposal-shared-toolbar');
  const evidence = document.createElement('button');
''',
'''  dom.toolbar.classList.add('ve-proposal-shared-toolbar');
  let evidencePosition: TableCellPosition | undefined;
  const rememberEvidencePosition = (event: PointerEvent): void => {
    const cell = event.target instanceof Element
      ? event.target.closest<HTMLTableCellElement>('td[data-ve-row][data-ve-col]')
      : null;
    if (!cell || !veHost.contains(cell)) return;
    const row = Number(cell.dataset.veRow);
    const col = Number(cell.dataset.veCol);
    if (Number.isInteger(row) && Number.isInteger(col)) evidencePosition = { row, col };
  };
  // Evidence selection is semantic and independent from editability. Alternate
  // Result Views remain read-only, but clicking a VE node still selects the node
  // that the explicit Cell Evidence action will inspect.
  veHost.addEventListener('pointerdown', rememberEvidencePosition, { capture: true });

  const evidence = document.createElement('button');
''')

r(
'''  evidence.addEventListener('click', () => {
    const position = session.selectedPositions()[0];
    if (!position) return;
    const cell = veHost.querySelector<HTMLTableCellElement>(`td[data-table-row="${position.row}"][data-table-col="${position.col}"]`);
    if (!cell) return;
    root.dispatchEvent(new CustomEvent('ve-cell-evidence-open', { bubbles: false, detail: { cell } }));
  });
''',
'''  evidence.addEventListener('click', () => {
    const position = evidencePosition ?? session.selectedPositions()[0];
    if (!position) return;
    const cell = veHost.querySelector<HTMLTableCellElement>(`td[data-ve-row="${position.row}"][data-ve-col="${position.col}"]`)
      ?? veHost.querySelector<HTMLTableCellElement>(`td[data-table-row="${position.row}"][data-table-col="${position.col}"]`);
    if (!cell) return;
    root.dispatchEvent(new CustomEvent('ve-cell-evidence-open', { bubbles: false, detail: { cell } }));
  });
''')

r(
'''  const bind = (): void => {
    const table = currentProposalTable(veHost);
    dom.toolbar.hidden = !table;
    dom.bindTable(table);
  };
''',
'''  const bind = (): void => {
    const renderedTable = veHost.querySelector<HTMLTableElement>('table.ve-workbench-table') ?? undefined;
    const table = currentProposalTable(veHost);
    dom.bindTable(table);
    // Keep the explicit Evidence action available for alternate read-only result
    // views while hiding edit commands that would mutate proposal review values.
    for (const button of [...dom.toolbar.querySelectorAll<HTMLButtonElement>('button')]) {
      if (button !== evidence) button.hidden = !table;
    }
    evidence.hidden = !renderedTable;
    dom.toolbar.hidden = !renderedTable;
  };
''')

r(
'''    session.clearPins();
    surface.resetHistory();
  };
''',
'''    session.clearPins();
    surface.resetHistory();
    evidencePosition = undefined;
  };
''')

p.write_text(s)
