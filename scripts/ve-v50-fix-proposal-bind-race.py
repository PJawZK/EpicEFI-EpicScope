from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    p = Path(path)
    s = p.read_text()
    if old not in s:
        raise SystemExit(f'{path}: missing pattern: {old[:140]!r}')
    p.write_text(s.replace(old, new, 1))

replace(
    'apps/web/src/pages/ve-analyzer-view-v2.ts',
    '''    renderTable(veHost, ve, axisValues(tuneModel, select('rpm-axis')?.value ?? ''), axisValues(tuneModel, select('load-axis')?.value ?? ''), result, proposal, review?.values);
    renderTable(targetHost, target, axisValues(tuneModel, select('target-rpm-axis')?.value ?? ''), axisValues(tuneModel, select('target-load-axis')?.value ?? ''));
''',
    '''    renderTable(veHost, ve, axisValues(tuneModel, select('rpm-axis')?.value ?? ''), axisValues(tuneModel, select('load-axis')?.value ?? ''), result, proposal, review?.values);
    // Shared table interaction is a separate presentation/input owner. Publish a
    // synchronous render boundary so it can bind the newly replaced VE table
    // before any same-turn pointer interaction; MutationObserver remains fallback.
    root.dispatchEvent(new CustomEvent('ve-proposal-table-rendered'));
    renderTable(targetHost, target, axisValues(tuneModel, select('target-rpm-axis')?.value ?? ''), axisValues(tuneModel, select('target-load-axis')?.value ?? ''));
''')

replace(
    'apps/web/src/pages/ve-analyzer-proposal-table-interaction.ts',
    '''  const observer = new MutationObserver(bind);
  const observe = (): void => observer.observe(veHost, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ve-result-view'] });
  observe();
  bind();
''',
    '''  const observer = new MutationObserver(bind);
  const observe = (): void => observer.observe(veHost, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ve-result-view'] });
  root.addEventListener('ve-proposal-table-rendered', bind);
  observe();
  bind();
''')
