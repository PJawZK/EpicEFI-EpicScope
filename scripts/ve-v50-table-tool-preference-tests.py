from pathlib import Path
path = Path('tests/web/ve-shared-table-interaction.browser.mjs')
text = path.read_text()
text = text.replace(
"assert(values()[0] === 110 && values()[1] === 110 && view.sessionRevision === initial + 1, 'Shared +/- edit did not publish one semantic change');",
"assert(values()[0] === 105 && values()[1] === 105 && view.sessionRevision === initial + 1, 'Shared +/- edit did not publish one semantic change');",
1)
text = text.replace(
"assert(values()[0] === 110 && values()[1] === 110, 'Redo did not restore shared edit');",
"assert(values()[0] === 105 && values()[1] === 105, 'Redo did not restore shared edit');",
1)
anchor = """    checks.push('shared owner-backed undo/redo works');

    selectCell(cells()[0]);
"""
addition = """    checks.push('shared owner-backed undo/redo works');

    const decrementButton = button(root, 'Decrease selected cells');
    decrementButton.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    const stepDialog = root.querySelector('.ve-table-tool-options');
    const stepInput = stepDialog?.querySelector('input[type="number"]');
    assert(stepDialog && stepInput && stepDialog.getAttribute('aria-label') === 'Increment step', 'Right-click did not open increment-step configuration');
    stepInput.value = '7';
    stepInput.dispatchEvent(new Event('change', { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(button(root, 'Increase selected cells').title.includes('by 7'), 'Configured increment step did not refresh toolbar presentation');
    const storedTools = JSON.parse(localStorage.getItem('epicscope.veAnalyzer.tableTools.v1') || '{}');
    assert(storedTools.delay?.adjustmentStep === 7, 'Configured table step was not persisted by the production preference owner');
    assert(button(root, 'Interpolate horizontally') && button(root, 'Interpolate vertically') && button(root, 'Interpolate both directions'), 'Explicit H/V/2D interpolation tools are missing');
    checks.push('right-click tool configuration persists and explicit H/V/2D interpolation controls are present');

    selectCell(cells()[0]);
"""
if anchor not in text:
    raise SystemExit('undo/redo insertion anchor missing')
text = text.replace(anchor, addition, 1)
text = text.replace(
"assert(values()[0] === pinnedBefore && values()[1] === 100, 'Pinned cell was changed by destructive bulk adjustment');",
"assert(values()[0] === pinnedBefore && values()[1] === 98, 'Pinned cell was changed by destructive bulk adjustment');",
1)
path.write_text(text)
