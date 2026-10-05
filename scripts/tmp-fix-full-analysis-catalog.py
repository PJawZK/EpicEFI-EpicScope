from pathlib import Path

paths = [
    'apps/web/src/pages/analyzer-page.ts',
    'apps/web/src/pages/boost-analyzer-view.ts',
    'apps/web/src/pages/specialized-analyzer-suite-view.ts',
    'apps/web/src/pages/tune-table-view.ts',
]

for path in paths:
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    marker = 'function channelLabel('
    start = s.find(marker)
    if start >= 0:
        brace = s.find('{', start)
        depth = 0
        end = None
        for i in range(brace, len(s)):
            if s[i] == '{': depth += 1
            elif s[i] == '}':
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if end is None:
            raise SystemExit(f'unclosed channelLabel in {path}')
        while end < len(s) and s[end] in '\r\n': end += 1
        s = s[:start] + s[end:]
    if path.endswith('analyzer-page.ts') or path.endswith('tune-table-view.ts'):
        s = s.replace(', LoggerAnalysisTraceContext', '')
    p.write_text(s, encoding='utf-8')
