from pathlib import Path
p = Path('apps/web/src/pages/ve-analyzer-view-v6.ts')
s = p.read_text()
old = '''import {
  createVeAnalyzerView as createVeAnalyzerViewV5,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v5';
'''
new = '''import {
  createVeAnalyzerView as createVeAnalyzerViewV4,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v4';
'''
if old not in s:
    raise SystemExit('v6 legacy v5 import not found')
s = s.replace(old, new, 1)
s = s.replace('  const inner = createVeAnalyzerViewV5(observability);', '''  // v5 was the transitional Lambda Delay gesture/editor owner. The shared
  // table-interaction adapter now has browser parity and is the sole production
  // input owner, so do not install the superseded v5 listeners/observer here.
  const inner = createVeAnalyzerViewV4(observability);''', 1)
s = s.replace("export type { VeAnalyzerViewController } from './ve-analyzer-view-v5';", "export type { VeAnalyzerViewController } from './ve-analyzer-view-v4';", 1)
p.write_text(s)
