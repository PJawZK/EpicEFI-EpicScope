from pathlib import Path

p = Path('apps/web/src/pages/logger-page.ts')
s = p.read_text()
s = s.replace("  ParserDiagnostic,\n  ParserDiagnosticSeverity,\n", "  ParserDiagnostic,\n", 1)
anchor = "import { createTimelineShell, type TimelineViewportIntent } from '../components/timeline-shell';\n"
if anchor not in s:
    raise SystemExit('timeline import anchor missing')
s = s.replace(anchor, anchor + "import { createParserDiagnosticsIndicator } from '../components/parser-diagnostics-indicator';\n", 1)
start = s.find('interface DiagnosticsIndicatorController {')
end = s.find('interface GraphWorkspaceSummary {', start)
if start < 0 or end < 0:
    raise SystemExit('diagnostics block anchors missing')
s = s[:start] + s[end:]
s = s.replace('const diagnostics = createDiagnosticsIndicator();', 'const diagnostics = createParserDiagnosticsIndicator();', 1)
p.write_text(s)
