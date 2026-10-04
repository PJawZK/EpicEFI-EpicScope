from pathlib import Path

controller = Path('apps/web/src/components/performance-diagnostics.ts')
s = controller.read_text()
s = s.replace(
    "import {\n  clearChannelDecodePerformance,\n} from '../../../../core/parsers/mlg/channel-decode-performance';\n",
    "import {\n  clearChannelDecodePerformance,\n  latestChannelDecodePerformance,\n} from '../../../../core/parsers/mlg/channel-decode-performance';\n",
    1,
)
s = s.replace(
    "import { buildPerformanceDiagnosticsReport } from './performance-diagnostics-report';\n",
    "import {\n  buildPerformanceDiagnosticsReport,\n  decodeMeasuredMs,\n} from './performance-diagnostics-report';\n",
    1,
)
controller.write_text(s)

report = Path('apps/web/src/components/performance-diagnostics-report.ts')
r = report.read_text()
r = r.replace(
    'function decodeMeasuredMs(snapshot: ReturnType<typeof latestChannelDecodePerformance>): number {',
    'export function decodeMeasuredMs(snapshot: ReturnType<typeof latestChannelDecodePerformance>): number {',
    1,
)
report.write_text(r)
