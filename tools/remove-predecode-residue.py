from pathlib import Path

p = Path('apps/web/src/pages/logger-page.ts')
s = p.read_text()
old = """const MAX_ACTIVE_WEB_TRACES = 8;\nconst OPPORTUNISTIC_PREDECODE_OPTIONS = new Set([32, 64, 128]);\n\nfunction opportunisticPredecodeTarget(): number {\n  const raw = new URLSearchParams(globalThis.location?.search ?? '').get('predecode');\n  const parsed = Number(raw);\n  return OPPORTUNISTIC_PREDECODE_OPTIONS.has(parsed) ? parsed : 0;\n}\nconst GRAPH_PANE_IDS = ['pane-1', 'pane-2', 'pane-3', 'pane-4', 'pane-5', 'pane-6'] as const;\n"""
new = """const MAX_ACTIVE_WEB_TRACES = 8;\nconst GRAPH_PANE_IDS = ['pane-1', 'pane-2', 'pane-3', 'pane-4', 'pane-5', 'pane-6'] as const;\n"""
if old not in s:
    raise SystemExit('predecode residue block not found')
p.write_text(s.replace(old, new, 1))
