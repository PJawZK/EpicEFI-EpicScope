from pathlib import Path

p = Path('apps/web/src/pages/logger-page.ts')
s = p.read_text()
old = """import type {\n  GraphWorkspaceSnapshot,\n  LoggerWorkspaceState,\n} from '../state/workspace-state';\n"""
new = """import type {\n  GraphPaneGeometry,\n  GraphPaneSnapshot,\n  GraphWorkspaceLayout,\n  GraphWorkspaceSnapshot,\n  LoggerWorkspaceState,\n} from '../state/workspace-state';\n"""
if old not in s:
    raise SystemExit('workspace-state import block not found')
p.write_text(s.replace(old, new, 1))
