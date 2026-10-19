const assert = (ok, message) => { if (!ok) throw Error(message); };

// Validate the visible projection against the owner's structured event, never
// use presentation text as the source of numerical/analytical authority.
export function assertVeCompletion(root, view, rows) {
  const stage = root.querySelector('[data-ve-analyzer="stage"]');
  const dialog = root.querySelector('.ve-v50-completion-dialog');
  assert(stage.dataset.state === 'success', 'Analysis has not reached successful completion');
  assert(dialog && !dialog.hidden && dialog.getBoundingClientRect().height > 0,
    'Successful analysis did not expose its completion summary');
  const rendered = [...dialog.querySelectorAll('.ve-v50-completion-rows > div')]
    .map(row => [row.firstElementChild.textContent, row.lastElementChild.textContent]);
  assert(rendered.length > 0 && !root.querySelector('.ve-v50-summary-action').hidden,
    'Successful analysis has no summary rows or reopening action');
  if (rows) assert(JSON.stringify(rendered) === JSON.stringify(rows), 'Summary diverged from owner-published completion rows');
  if (view) {
    assert(view.getPrimaryAnalysis() && view.getReadiness().ready && !view.getReadiness().pending,
      'Completion summary has no current completed analysis authority');
  }
}

export async function runVeShellCompletionChecks() {
  const root = document.querySelector('.analyzer-page:not([hidden]) .ve-analyzer-view:not([hidden])');
  assert(root, 'Active VE owner missing');
  let rows;
  const receive = event => { rows = event.detail.rows; };
  root.addEventListener('ve-analysis-complete', receive);
  try {
    root.querySelector('.ve-workbench-run').click();
    const deadline = performance.now() + 30000;
    while (!rows) {
      assert(performance.now() < deadline, 'Analysis did not publish completion');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assertVeCompletion(root, undefined, rows);
    root.querySelector('.ve-v50-completion-x').click();
    assert(root.querySelector('.ve-v50-completion-dialog').hidden, 'Summary Close failed');
    root.querySelector('.ve-v50-summary-action').click();
    assertVeCompletion(root, undefined, rows);
    root.querySelector('.ve-v50-completion-x').click();
    return { passed: 1, checks: ['Native shell analysis publishes the visible authoritative summary and supports Close/reopen'] };
  } finally { root.removeEventListener('ve-analysis-complete', receive); }
}
