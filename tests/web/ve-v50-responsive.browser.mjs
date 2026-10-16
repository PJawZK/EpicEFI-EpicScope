const assert = (ok, message) => { if (!ok) throw Error(message); };
const settle = async () => {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
};

function inside(inner, outer, tolerance = 2) {
  return inner.left >= outer.left - tolerance && inner.right <= outer.right + tolerance;
}

export async function runVeV50ResponsiveChecks(expectedWidth) {
  const checks = [];
  const analyzer = document.querySelector('.analyzer-page:not([hidden])');
  const root = analyzer?.querySelector('.ve-analyzer-view.ve-v50-port:not([hidden])');
  assert(root, 'Visible application v50 VE Analyzer root missing');
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
  ]) {
    const node = root.querySelector(selector);
    assert(node, `${label} missing`);
    const rect = node.getBoundingClientRect();
    assert(inside(rect, rootRect), `${label} escapes VE root at ${expectedWidth}px`);
  }
  checks.push(`primary workbench, scope, setup and action surfaces stay inside the VE root at ${expectedWidth}px`);

  const wrapper = root.querySelector('.ve-workbench-table-wrap');
  const table = root.querySelector('.ve-workbench-table');
  assert(wrapper && table, 'VE workbench table surface missing');
  const wrapperRect = wrapper.getBoundingClientRect();
  assert(inside(wrapperRect, rootRect) && wrapper.clientWidth > 0, 'Table wrapper does not stay inside the work surface');
  assert(wrapper.scrollWidth >= wrapper.clientWidth && table.scrollWidth > 0, 'Table scroll geometry is invalid');
  checks.push(`table remains a bounded dominant work surface with internal overflow available at ${expectedWidth}px`);

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

  return {
    passed: checks.length,
    checks,
    observed: {
      viewportWidth: window.innerWidth,
      rootWidth: Math.round(rootRect.width),
      tableClientWidth: wrapper.clientWidth,
      tableScrollWidth: wrapper.scrollWidth,
      setupGroups: details.length,
    },
  };
}
