const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

function inside(inner, outer, tolerance = 2) {
  return inner.left >= outer.left - tolerance && inner.right <= outer.right + tolerance;
}

function visibleTableSurface(root) {
  for (const wrapper of root.querySelectorAll('.ve-workbench-table-wrap')) {
    const table = wrapper.querySelector('.ve-workbench-table');
    if (!table) continue;
    const wrapperRect = wrapper.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    if (wrapperRect.width > 0 && wrapperRect.height > 0 && tableRect.width > 0 && tableRect.height > 0) {
      return { wrapper, table };
    }
  }
  return undefined;
}

function resetCaptureScroll(analyzer) {
  window.scrollTo(0, 0);
  analyzer.scrollTop = 0;
  analyzer.scrollLeft = 0;
}

function selectionCommandButtons(toolbar) {
  const prefixes = [
    'Decrease selected cells',
    'Increase selected cells',
    'Pin or unpin selected cells',
    'Interpolate horizontally',
    'Interpolate vertically',
    'Interpolate both directions',
    'Smooth selected cells',
    'Revert selected cells',
    'Clear selected cells',
  ];
  return [...toolbar.querySelectorAll('button')].filter((button) => {
    const label = button.getAttribute('aria-label') || '';
    return prefixes.some((prefix) => label.startsWith(prefix));
  });
}

export async function runVeV50ResponsiveChecks(expectedWidth) {
  const checks = [];
  const analyzer = document.querySelector('.analyzer-page:not([hidden])');
  const root = analyzer?.querySelector('.ve-analyzer-view.ve-v50-port:not([hidden])');
  assert(root, 'Visible application v50 VE Analyzer root missing');
  resetCaptureScroll(analyzer);
  await settle();

  assert(Math.abs(window.innerWidth - expectedWidth) <= 2, `Viewport width mismatch: expected ${expectedWidth}, got ${window.innerWidth}`);
  const viewport = { left: 0, right: window.innerWidth };
  const rootRect = root.getBoundingClientRect();
  assert(rootRect.width > 0 && rootRect.left >= -2 && rootRect.right <= window.innerWidth + 2,
    `VE root escapes the viewport at ${expectedWidth}px: ${Math.round(rootRect.left)}..${Math.round(rootRect.right)}`);
  checks.push(`VE root fits ${expectedWidth}px viewport`);
  const analyzerBounds = analyzer.getBoundingClientRect();
  assert(rootRect.bottom <= analyzerBounds.bottom + 3,
    `VE workbench extends below Analyzer viewport at ${expectedWidth}px: ${Math.round(rootRect.bottom)} > ${Math.round(analyzerBounds.bottom)}`);
  assert(analyzer.scrollHeight <= analyzer.clientHeight + 3,
    `VE mode still requires Analyzer page scrolling at ${expectedWidth}px: ${analyzer.scrollHeight} > ${analyzer.clientHeight}`);
  checks.push(`VE mode fits its available Analyzer viewport without page scrolling at ${expectedWidth}px`);

  for (const [label, selector] of [
    ['workbench', '.ve-workbench'],
    ['scope navigator', '.ve-analysis-scope-navigator'],
    ['setup row', '.ve-workbench-quick-controls'],
    ['action bar', '.ve-workbench-actionbar'],
  ]) {
    const node = root.querySelector(selector);
    assert(node, `${label} missing`);
    const rect = node.getBoundingClientRect();
    assert(inside(rect, rootRect), `${label} escapes VE root at ${expectedWidth}px`);
  }
  const compactActions = root.querySelector('.ve-v50-table-actions');
  assert(compactActions?.querySelector('button[aria-label="Cell Evidence"]')
    && compactActions.querySelector('button[aria-label="Toggle VE and Target split view"]')
    && compactActions.querySelector('.ve-v50-target-host select[data-role="target-table"]'),
    'v50 header actions were not attached or lost semantic controls');
  assert(root.querySelectorAll('.ve-v50-table-actions').length === 1,
    'v50 header action host duplicated');
  checks.push('compact table header retains Target, Split and Cell Evidence actions');
  assert(!root.querySelector('.ve-v50-secondary-tools'), 'Temporary Review & tools strip is still present');
  checks.push(`primary workbench, scope, setup and action surfaces stay inside the VE root at ${expectedWidth}px`);

  const advancedButton = root.querySelector('.ve-v50-advanced-button:not(.ve-v50-exclusions-button)');
  const exclusionsButton = root.querySelector('.ve-v50-exclusions-button');
  const toolHost = root.querySelector('.ve-v50-tool-host');
  const advanced = root.querySelector('.ve-workbench-advanced');
  const lambdaDetails = root.querySelector('[data-ve-analyzer="delay-table"]')?.closest('details');
  assert(advancedButton && exclusionsButton && toolHost && advanced && lambdaDetails,
    'Compact v50 Advanced/Exclusions/Lambda tool surfaces are incomplete');
  assert(toolHost.contains(advanced) && toolHost.contains(lambdaDetails),
    'Advanced or Lambda owner is still mounted in the permanent page flow');

  advancedButton.click();
  await settle();
  const advancedPanel = advanced.closest('.ve-v50-tool-surface');
  assert(advanced.open && advancedPanel && !advancedPanel.hidden,
    'Advanced button did not open the existing Advanced owner as a tool surface');
  advancedPanel.querySelector('.ve-v50-tool-surface-close')?.click();
  await settle();
  assert(!advanced.open && advancedPanel.hidden, 'Advanced tool surface did not close cleanly');

  const lambdaTrigger = root.querySelector('.ve-v50-lambda-tool-trigger');
  assert(lambdaTrigger, 'Lambda Delay workflow trigger missing');
  lambdaTrigger.click();
  await settle();
  const lambdaPanel = lambdaDetails.closest('.ve-v50-tool-surface');
  assert(lambdaDetails.open && lambdaPanel && !lambdaPanel.hidden,
    'Lambda Delay trigger did not open the existing Lambda owner as a tool surface');
  lambdaPanel.querySelector('.ve-v50-tool-surface-close')?.click();
  await settle();
  checks.push('Advanced and Lambda owners open as secondary tool surfaces instead of inline page sections');

  const surface = visibleTableSurface(root);
  assert(surface, 'No visible VE workbench table surface found');
  const { wrapper, table } = surface;
  const wrapperRect = wrapper.getBoundingClientRect();
  assert(inside(wrapperRect, rootRect) && wrapper.clientWidth > 0, 'Table wrapper does not stay inside the work surface');
  assert(wrapper.scrollWidth >= wrapper.clientWidth && table.scrollWidth > 0 && table.getBoundingClientRect().width > 0,
    'Visible table scroll geometry is invalid');
  checks.push(`visible table remains a bounded dominant work surface with internal overflow available at ${expectedWidth}px`);
  const dataRows = table.tBodies[0]?.rows.length ?? 0;
  const fittedMinimum = dataRows * 16 + 20;
  if (dataRows > 0 && wrapper.clientHeight >= fittedMinimum + 2) {
    const tableBottom = table.getBoundingClientRect().bottom;
    const unusedSpace = wrapper.getBoundingClientRect().bottom - tableBottom;
    assert(unusedSpace <= 14,
      `VE table left unused workbench height at ${expectedWidth}px: ${Math.round(unusedSpace)}px below ${dataRows} rows`);
    checks.push(`VE table rows fill available workbench height at ${expectedWidth}px`);
  }

  const proposalToolbar = root.querySelector('.ve-proposal-shared-toolbar');
  if (proposalToolbar && !proposalToolbar.hidden) {
    const hasSelection = Boolean(table.querySelector('td[data-table-selected="true"]'));
    const expectedAvailability = hasSelection ? 'false' : 'true';
    const commandButtons = selectionCommandButtons(proposalToolbar);
    assert(commandButtons.length >= 6, 'Selection-dependent VE table commands missing from toolbar');
    assert(commandButtons.every((button) => button.getAttribute('aria-disabled') === expectedAvailability),
      'VE table command availability does not match the shared selection state');
  }
  checks.push('selection-dependent table command availability follows shared selection state');

  const details = [...root.querySelectorAll('.ve-v50-setup-group')];
  if (details.length >= 2) {
    details[0].open = true;
    await settle();
    details[1].open = true;
    await settle();
    assert(!details[0].open && details[1].open, 'Opening a v50 setup group did not close the previous setup disclosure');
    details[1].open = false;
    checks.push('compact setup row keeps one active disclosure at a time');
  }
  for (const detail of details) {
    detail.open = true;
    await settle();
    const body = detail.querySelector('.ve-v50-setup-body');
    if (body) {
      const rect = body.getBoundingClientRect();
      assert(inside(rect, viewport, 8), `Setup disclosure ${detail.dataset.veV50Setup || '?'} escapes viewport at ${expectedWidth}px: ${Math.round(rect.left)}..${Math.round(rect.right)}`);
      assert(rect.top >= 0 && rect.bottom <= window.innerHeight + 8,
        `Setup disclosure ${detail.dataset.veV50Setup || '?'} escapes vertical viewport at ${expectedWidth}px: ${Math.round(rect.top)}..${Math.round(rect.bottom)}`);
    }
    detail.open = false;
  }
  checks.push(`all compact setup disclosures remain inside the ${expectedWidth}px viewport`);

  const scopeOpen = root.querySelector('[data-ve-scope-open]');
  assert(scopeOpen && scopeOpen.getBoundingClientRect().right <= window.innerWidth + 2, 'Open in Logger action escapes viewport');
  checks.push(`scope handoff remains visible at ${expectedWidth}px`);

  resetCaptureScroll(analyzer);
  await settle();

  return {
    passed: checks.length,
    checks,
    observed: {
      viewportWidth: window.innerWidth,
      rootWidth: Math.round(rootRect.width),
      tableClientWidth: wrapper.clientWidth,
      tableScrollWidth: wrapper.scrollWidth,
      tableWidth: Math.round(table.getBoundingClientRect().width),
      setupGroups: details.length,
      toolSurfaces: toolHost.querySelectorAll('.ve-v50-tool-surface').length,
    },
  };
}
