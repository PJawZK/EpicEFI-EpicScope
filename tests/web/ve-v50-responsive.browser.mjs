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

export async function runVeV50ResponsiveChecks(expectedWidth) {
  const checks = [];
  const analyzer = document.querySelector('.analyzer-page:not([hidden])');
  const root = analyzer?.querySelector('.ve-analyzer-view.ve-v50-port:not([hidden])');
  assert(root, 'Visible application v50 VE Analyzer root missing');
  window.scrollTo(0, 0);
  await settle();

  assert(Math.abs(window.innerWidth - expectedWidth) <= 2, `Viewport width mismatch: expected ${expectedWidth}, got ${window.innerWidth}`);
  const viewport = { left: 0, right: window.innerWidth };
  const rootRect = root.getBoundingClientRect();
  assert(rootRect.width > 0 && rootRect.left >= -2 && rootRect.right <= window.innerWidth + 2,
    `VE root escapes the viewport at ${expectedWidth}px: ${Math.round(rootRect.left)}..${Math.round(rootRect.right)}`);
  checks.push(`VE root fits ${expectedWidth}px viewport`);

  for (const [label, selector] of [
    ['workbench', '.ve-workbench'],
    ['scope navigator', '.ve-analysis-scope-navigator'],
    ['setup row', '.ve-workbench-quick-controls'],
    ['action bar', '.ve-workbench-actionbar'],
    ['secondary tools', '.ve-v50-secondary-tools'],
  ]) {
    const node = root.querySelector(selector);
    assert(node, `${label} missing`);
    const rect = node.getBoundingClientRect();
    assert(inside(rect, rootRect), `${label} escapes VE root at ${expectedWidth}px`);
  }
  checks.push(`primary workbench, scope, setup, action and secondary-tool surfaces stay inside the VE root at ${expectedWidth}px`);

  const secondary = root.querySelector('.ve-v50-secondary-tools');
  const secondaryIds = [...secondary.querySelectorAll('[data-ve-v50-secondary]')].map((button) => button.dataset.veV50Secondary);
  for (const id of ['summary', 'lambda-delay', 'mappings', 'exclusions', 'readiness', 'cell-evidence']) {
    assert(secondaryIds.includes(id), `Frozen v50 secondary tool ${id} is missing`);
  }
  checks.push('frozen v50 production-owned secondary tools are present');

  const lambdaTool = secondary.querySelector('[data-ve-v50-secondary="lambda-delay"]');
  const lambdaDetails = root.querySelector('[data-ve-analyzer="delay-table"]')?.closest('details');
  if (lambdaTool && lambdaDetails && !lambdaTool.disabled) {
    lambdaDetails.open = false;
    lambdaTool.click();
    await settle();
    assert(lambdaDetails.open, 'Lambda Delay secondary tool did not reveal the existing Lambda owner');
  }
  const mappingTool = secondary.querySelector('[data-ve-v50-secondary="mappings"]');
  const advanced = root.querySelector('.ve-workbench-advanced');
  if (mappingTool && advanced && !mappingTool.disabled) {
    advanced.open = false;
    mappingTool.click();
    await settle();
    assert(advanced.open, 'Mappings secondary tool did not reveal the existing Advanced owner');
  }
  window.scrollTo(0, 0);
  await settle();
  checks.push('secondary navigation delegates to existing Lambda and Advanced owners without changing responsive capture position');

  const surface = visibleTableSurface(root);
  assert(surface, 'No visible VE workbench table surface found');
  const { wrapper, table } = surface;
  const wrapperRect = wrapper.getBoundingClientRect();
  assert(inside(wrapperRect, rootRect) && wrapper.clientWidth > 0, 'Table wrapper does not stay inside the work surface');
  assert(wrapper.scrollWidth >= wrapper.clientWidth && table.scrollWidth > 0 && table.getBoundingClientRect().width > 0,
    'Visible table scroll geometry is invalid');
  checks.push(`visible table remains a bounded dominant work surface with internal overflow available at ${expectedWidth}px`);

  const details = [...root.querySelectorAll('.ve-v50-setup-group')];
  for (const detail of details) {
    detail.open = true;
    await settle();
    const body = detail.querySelector('.ve-v50-setup-body');
    if (body) {
      const rect = body.getBoundingClientRect();
      assert(inside(rect, viewport, 8), `Setup disclosure ${detail.dataset.veV50Setup || '?'} escapes viewport at ${expectedWidth}px: ${Math.round(rect.left)}..${Math.round(rect.right)}`);
    }
    detail.open = false;
  }
  checks.push(`all compact setup disclosures remain inside the ${expectedWidth}px viewport`);

  const scopeOpen = root.querySelector('[data-ve-scope-open]');
  assert(scopeOpen && scopeOpen.getBoundingClientRect().right <= window.innerWidth + 2, 'Open in Logger action escapes viewport');
  checks.push(`scope handoff remains visible at ${expectedWidth}px`);

  window.scrollTo(0, 0);
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
      secondaryTools: secondaryIds.length,
    },
  };
}
