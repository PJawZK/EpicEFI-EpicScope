from pathlib import Path


def replace(path: str, old: str, new: str, count: int = 1) -> None:
    p = Path(path)
    s = p.read_text()
    actual = s.count(old)
    if actual < count:
        raise SystemExit(f'{path}: expected {count} occurrence(s), found {actual}: {old[:120]!r}')
    p.write_text(s.replace(old, new, count))

# Lambda Delete now means clear/none; Revert is the explicit recommendation restore.
replace(
    'tests/web/ve-delay-editing.browser.mjs',
    '''    key(s.cells()[0], 'Delete'); await settle();
    assert(all(s, 100) && s.view.sessionRevision === stable + 1 && s.cells().every((cell) => cell.dataset.delayProvenance === 'measured-recommendation'), 'Delete did not revert the selected recommendation in one operation');
    checks.push('Delete reverts the whole selection to evidence recommendation/provenance');

    const cancelRevision = s.view.sessionRevision;
''',
    '''    key(s.cells()[0], 'Delete'); await settle();
    assert(all(s, '') && s.view.sessionRevision === stable + 1 && s.cells().every((cell) => cell.dataset.delayRecommended === '100' && cell.dataset.delayProvenance === 'user-edited'), 'Delete did not clear the selected working values in one operation');
    const revertAfterDelete = [...s.root.querySelectorAll('.ve-delay-shared-toolbar button')].find((candidate) => candidate.title.startsWith('Revert selected cells'));
    assert(revertAfterDelete, 'Revert tool missing after Delete');
    revertAfterDelete.click(); await settle();
    assert(all(s, 100) && s.cells().every((cell) => cell.dataset.delayProvenance === 'measured-recommendation'), 'Explicit Revert did not restore retained recommendations');
    checks.push('Delete clears working values; explicit Revert restores retained recommendation/provenance');

    const cancelRevision = s.view.sessionRevision;
''')

replace(
    'tests/web/ve-delay-editing.browser.mjs',
    '''    type(s, ''); await settle();
    assert(all(s, '') && s.cells().every((cell) => cell.dataset.delayRecommended === '100' && cell.dataset.delayProvenance === 'user-edited'), 'Blank edit erased recommendation evidence');
    key(s.cells()[0], 'Delete'); await settle();
    assert(all(s, 100), 'Delete did not restore explicitly cleared values');
    checks.push('blank commit clears working values only; Delete restores retained evidence');
''',
    '''    type(s, ''); await settle();
    assert(all(s, '') && s.cells().every((cell) => cell.dataset.delayRecommended === '100' && cell.dataset.delayProvenance === 'user-edited'), 'Blank edit erased recommendation evidence');
    const blankRevision = s.view.sessionRevision;
    key(s.cells()[0], 'Delete'); await settle();
    assert(all(s, '') && s.view.sessionRevision === blankRevision, 'Delete changed an already empty working selection');
    const revertBlank = [...s.root.querySelectorAll('.ve-delay-shared-toolbar button')].find((candidate) => candidate.title.startsWith('Revert selected cells'));
    assert(revertBlank, 'Revert tool missing for explicitly cleared values');
    revertBlank.click(); await settle();
    assert(all(s, 100), 'Explicit Revert did not restore retained evidence after a blank edit');
    checks.push('blank commit and Delete preserve none; explicit Revert restores retained evidence');
''')

# Evidence is now an explicit tool action. Normal VE cell clicks belong to shared table selection/editing.
replace(
    'tests/web/ve-delay-editing.browser.mjs',
    '''    const measured = [...s.root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find((cell) => cell.title.startsWith('Measured proposal'));
    assert(measured, 'Expected measured evidence cell'); measured.click(); await settle();
    assert(!s.host.querySelector('.ve-cell-detail-popover').hidden, 'Evidence did not open');
''',
    '''    const measured = [...s.root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find((cell) => cell.title.startsWith('Measured proposal'));
    assert(measured, 'Expected measured evidence cell');
    measured.setPointerCapture = () => {};
    measured.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 31, pointerType: 'mouse', bubbles: true, cancelable: true }));
    measured.dispatchEvent(new PointerEvent('pointerup', { pointerId: 31, pointerType: 'mouse', bubbles: true, cancelable: true }));
    assert(s.host.querySelector('.ve-cell-detail-popover').hidden, 'Normal VE selection unexpectedly opened Cell Evidence');
    const evidenceButton = [...s.root.querySelectorAll('.ve-proposal-shared-toolbar button')].find((candidate) => candidate.title === 'Cell Evidence');
    assert(evidenceButton, 'Cell Evidence tool missing from VE Proposal toolbar');
    evidenceButton.click(); await settle();
    assert(!s.host.querySelector('.ve-cell-detail-popover').hidden, 'Explicit Cell Evidence tool did not open retained evidence');
''')

# Lifecycle helper for explicit Cell Evidence opening.
replace(
    'tests/web/ve-analyzer-lifecycle.browser.mjs',
    '''function summary(root) { return root.querySelector('[data-ve-analyzer="summary"]').textContent; }
function measured(root) { return [...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find((cell) => cell.title.startsWith('Measured proposal')); }

async function completed(s) {
''',
    '''function summary(root) { return root.querySelector('[data-ve-analyzer="summary"]').textContent; }
function measured(root) { return [...root.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find((cell) => cell.title.startsWith('Measured proposal')); }
function openEvidence(s, cell) {
  assert(cell, 'Missing VE cell for Cell Evidence');
  cell.setPointerCapture = () => {};
  cell.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 41, pointerType: 'mouse', bubbles: true, cancelable: true }));
  cell.dispatchEvent(new PointerEvent('pointerup', { pointerId: 41, pointerType: 'mouse', bubbles: true, cancelable: true }));
  const button = [...s.root.querySelectorAll('.ve-proposal-shared-toolbar button')].find((candidate) => candidate.title === 'Cell Evidence');
  assert(button, 'Cell Evidence tool missing');
  button.click();
}

async function completed(s) {
''')

# Known lifecycle evidence-open paths.
replace('tests/web/ve-analyzer-lifecycle.browser.mjs', '      cell.click(); await settle();\n', '      openEvidence(s, cell); await settle();\n')
replace(
    'tests/web/ve-analyzer-lifecycle.browser.mjs',
    '''    s.root.querySelector('[data-ve-analyzer="ve-table-view"] td').click(); await settle();
''',
    '''    openEvidence(s, s.root.querySelector('[data-ve-analyzer="ve-table-view"] td')); await settle();
''')

# Replace any remaining simple measured-cell evidence opens in lifecycle checks.
p = Path('tests/web/ve-analyzer-lifecycle.browser.mjs')
s = p.read_text()
s = s.replace('measured(s.root).click(); await settle();', 'openEvidence(s, measured(s.root)); await settle();')
s = s.replace('measured.click(); await settle();', 'openEvidence(s, measured); await settle();')
p.write_text(s)

# MSQ replacement checks also use the explicit evidence tool.
replace(
    'tests/web/msq-replacement.browser.mjs',
    '''const button=()=>document.querySelector('.load-msq');
const snapshot=()=>({summary:document.querySelector('[data-ve-analyzer="summary"]').textContent,delay:document.querySelector('[data-delay-row="0"][data-delay-col="0"]').dataset.delayValue,titles:[...document.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].map(c=>c.title)});
''',
    '''const button=()=>document.querySelector('.load-msq');
const snapshot=()=>({summary:document.querySelector('[data-ve-analyzer="summary"]').textContent,delay:document.querySelector('[data-delay-row="0"][data-delay-col="0"]').dataset.delayValue,titles:[...document.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].map(c=>c.title)});
const openEvidence=(cell)=>{assert(cell,'Missing measured VE cell');cell.setPointerCapture=()=>{};cell.dispatchEvent(new PointerEvent('pointerdown',{pointerId:51,pointerType:'mouse',bubbles:true,cancelable:true}));cell.dispatchEvent(new PointerEvent('pointerup',{pointerId:51,pointerType:'mouse',bubbles:true,cancelable:true}));const tool=[...document.querySelectorAll('.ve-proposal-shared-toolbar button')].find(candidate=>candidate.title==='Cell Evidence');assert(tool,'Cell Evidence tool missing');tool.click();};
''')

p = Path('tests/web/msq-replacement.browser.mjs')
s = p.read_text()
old = '''[...document.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find(c=>c.title.startsWith('Measured proposal')).click();await settle();'''
if old not in s:
    raise SystemExit('msq replacement measured evidence-open pattern missing')
s = s.replace(old, '''openEvidence([...document.querySelectorAll('[data-ve-analyzer="ve-table-view"] td')].find(c=>c.title.startsWith('Measured proposal')));await settle();''')
p.write_text(s)
