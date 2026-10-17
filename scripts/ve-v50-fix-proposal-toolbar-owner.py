from pathlib import Path
p = Path('apps/web/src/pages/ve-analyzer-proposal-table-interaction.ts')
s = p.read_text()
old = '''  const header = veHost.closest<HTMLElement>('.ve-workbench-panel')?.querySelector<HTMLElement>('.ve-table-header-controls')
    ?? veHost.closest<HTMLElement>('.ve-workbench-panel')?.querySelector<HTMLElement>('header');
  header?.append(dom.toolbar);
'''
new = '''  // v7 owns .ve-table-header-controls and intentionally replaceChildren()s it
  // whenever layout/table selectors are resynchronised. The edit toolbar is a
  // separate owner and must therefore be a stable sibling in the panel header,
  // not a child of v7's replaceable control host.
  const panelHeader = veHost.closest<HTMLElement>('.ve-workbench-panel')?.querySelector<HTMLElement>('header')
    ?? root.querySelector<HTMLElement>('.ve-workbench-panel header');
  panelHeader?.append(dom.toolbar);
'''
if old not in s:
    raise SystemExit('proposal toolbar host pattern not found')
p.write_text(s.replace(old, new, 1))
