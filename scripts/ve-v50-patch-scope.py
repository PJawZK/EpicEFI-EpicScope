from pathlib import Path

p = Path('apps/web/src/pages/ve-analyzer-v50-presentation.ts')
s = p.read_text()

def r(old: str, new: str) -> None:
    global s
    if old not in s:
        raise SystemExit('missing pattern: ' + old[:120])
    s = s.replace(old, new, 1)

r(
'''  const setupGroups = new Map<string, SetupGroup>();
  let syncSetupSummaries = (): void => {};
  const scheduleSetupSummaries = (): void => queueMicrotask(syncSetupSummaries);
''',
'''  const setupGroups = new Map<string, SetupGroup>();
  let syncSetupSummaries = (): void => {};
  let syncScopeChoices = (): void => {};
  const scheduleSetupSummaries = (): void => queueMicrotask(() => {
    syncScopeChoices();
    syncSetupSummaries();
  });

  const positionSetupDisclosure = (details: HTMLDetailsElement): void => {
    if (!details.open) return;
    const body = details.querySelector<HTMLElement>('.ve-v50-setup-body');
    const summary = details.querySelector<HTMLElement>(':scope > summary');
    if (!body || !summary) return;
    body.style.left = '0px';
    details.dataset.openDirection = 'down';
    const summaryRect = summary.getBoundingClientRect();
    const groupRect = details.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const pad = 8;
    const gap = 5;
    const roomBelow = window.innerHeight - summaryRect.bottom;
    const roomAbove = summaryRect.top;
    const direction = roomBelow < bodyRect.height + gap && roomAbove > roomBelow ? 'up' : 'down';
    details.dataset.openDirection = direction;
    const desiredViewportLeft = Math.max(pad, Math.min(groupRect.left, window.innerWidth - bodyRect.width - pad));
    body.style.left = `${desiredViewportLeft - groupRect.left}px`;
  };
''')

r(
'''    moveLabel(scopeGroup.body, labelFor(root, 'select[data-role="scope"]'));
''',
'''    const semanticScopeSelect = root.querySelector<HTMLSelectElement>('select[data-role="scope"]');
    const semanticScopeLabel = semanticScopeSelect?.closest<HTMLLabelElement>('label');
    if (semanticScopeLabel) {
      semanticScopeLabel.hidden = true;
      scopeGroup.body.append(semanticScopeLabel);
    }
    const scopeChoices = document.createElement('div');
    scopeChoices.className = 've-v50-scope-choice-list';
    scopeGroup.body.append(scopeChoices);
    syncScopeChoices = (): void => {
      if (!semanticScopeSelect) return;
      const options = [...semanticScopeSelect.options];
      scopeChoices.replaceChildren(...options.map((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 've-v50-scope-choice';
        button.textContent = option.textContent?.trim() || option.value;
        button.dataset.scopeValue = option.value;
        button.dataset.selected = option.value === semanticScopeSelect.value ? 'true' : 'false';
        button.setAttribute('aria-pressed', option.value === semanticScopeSelect.value ? 'true' : 'false');
        button.addEventListener('click', () => {
          if (semanticScopeSelect.value !== option.value) {
            semanticScopeSelect.value = option.value;
            semanticScopeSelect.dispatchEvent(new Event('change', { bubbles: true }));
          }
          syncScopeChoices();
          scopeGroup.details.open = false;
        });
        return button;
      }));
    };
''')

r(
'''    const advanced = root.querySelector<HTMLDetailsElement>('.ve-workbench-advanced');
''',
'''    for (const group of setupGroups.values()) {
      group.details.addEventListener('toggle', () => {
        if (group.details.open) requestAnimationFrame(() => positionSetupDisclosure(group.details));
      });
    }
    window.addEventListener('resize', () => {
      for (const group of setupGroups.values()) if (group.details.open) positionSetupDisclosure(group.details);
    });

    const advanced = root.querySelector<HTMLDetailsElement>('.ve-workbench-advanced');
''')

r(
'''      summary('scope', selectedText(root.querySelector<HTMLSelectElement>('select[data-role="scope"]'), 'Full Log'));
''',
'''      summary('scope', selectedText(root.querySelector<HTMLSelectElement>('select[data-role="scope"]'), 'Full Log'));
      syncScopeChoices();
''')

r(
'''      syncSetupSummaries();
      if (currentContext && event.target instanceof HTMLSelectElement && event.target.matches('select[data-role="scope"]')) renderScope(currentContext);
''',
'''      syncScopeChoices();
      syncSetupSummaries();
      if (currentContext && event.target instanceof HTMLSelectElement && event.target.matches('select[data-role="scope"]')) renderScope(currentContext);
''')

p.write_text(s)

p = Path('apps/web/src/styles/ve-analyzer-v50-port.css')
s = p.read_text()
if '.ve-v50-scope-choice-list' not in s:
    s += '''\n\n/* Scope disclosure is the menu; do not nest a second select/dropdown inside it. */\n.ve-v50-port .ve-v50-setup-group[data-ve-v50-setup='scope'] .ve-v50-setup-body {\n  grid-template-columns: minmax(220px, 1fr);\n  min-width: 250px;\n}\n.ve-v50-port .ve-v50-scope-choice-list {\n  display: grid;\n  gap: 4px;\n}\n.ve-v50-port .ve-v50-scope-choice {\n  min-height: 30px;\n  padding: 0 9px;\n  border: 1px solid #294350;\n  border-radius: 3px;\n  background: #0d1c26;\n  color: #cbd9df;\n  text-align: left;\n  cursor: pointer;\n}\n.ve-v50-port .ve-v50-scope-choice:hover { border-color: #3479ae; background: #102437; }\n.ve-v50-port .ve-v50-scope-choice[data-selected='true'] {\n  border-color: #3c8cc0;\n  background: #12304a;\n  color: #eef8fc;\n}\n\n/* One adaptive placement policy for compact setup disclosures. */\n.ve-v50-port .ve-v50-setup-group[data-open-direction='up'] > .ve-v50-setup-body {\n  top: auto;\n  bottom: calc(100% + 5px);\n}\n.ve-v50-port .ve-v50-setup-group[data-open-direction='down'] > .ve-v50-setup-body {\n  top: calc(100% + 5px);\n  bottom: auto;\n}\n'''
p.write_text(s)
