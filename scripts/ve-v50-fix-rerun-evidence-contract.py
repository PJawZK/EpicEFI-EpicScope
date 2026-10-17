from pathlib import Path
p = Path('tests/web/ve-analyzer-lifecycle.browser.mjs')
s = p.read_text()
old = '''    s.root.querySelector('[data-ve-analyzer="ve-table-view"] td').click(); await settle();
    assert(s.host.querySelector('.ve-evidence-detail-loading')?.textContent.includes('valid VE analysis'), 'Old popup evidence used during rerun');
'''
new = '''    openEvidence(s, s.root.querySelector('[data-ve-analyzer="ve-table-view"] td')); await settle();
    assert(s.host.querySelector('.ve-evidence-detail-loading')?.textContent.includes('valid VE analysis'), 'Old popup evidence used during rerun');
'''
if old not in s:
    raise SystemExit('pending rerun evidence-open pattern not found')
p.write_text(s.replace(old, new, 1))
