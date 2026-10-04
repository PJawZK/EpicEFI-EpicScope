from pathlib import Path

path = Path('apps/web/src/components/performance-diagnostics.ts')
source = path.read_text()

old_decode_import = """import {\n  clearChannelDecodePerformance,\n  latestChannelDecodePerformance,\n} from '../../../../core/parsers/mlg/channel-decode-performance';\n"""
new_decode_import = """import {\n  clearChannelDecodePerformance,\n} from '../../../../core/parsers/mlg/channel-decode-performance';\n"""
if old_decode_import not in source:
    raise SystemExit('channel decode import block not found')
source = source.replace(old_decode_import, new_decode_import, 1)

old_blob_import = """import {\n  latestBlobByteSourceRuntimeDiagnostics,\n  type BlobByteSourceRuntimeDiagnostics,\n} from '../adapters/blob-byte-source';\n"""
new_blob_import = """import type { BlobByteSourceRuntimeDiagnostics } from '../adapters/blob-byte-source';\nimport { buildPerformanceDiagnosticsReport } from './performance-diagnostics-report';\n"""
if old_blob_import not in source:
    raise SystemExit('blob diagnostics import block not found')
source = source.replace(old_blob_import, new_blob_import, 1)

old_decode_helper = """function decodeMeasuredMs(snapshot: ReturnType<typeof latestChannelDecodePerformance>): number {\n  if (!snapshot) return 0;\n  return snapshot.cacheResolveMs\n    + snapshot.batchPlanMs\n    + snapshot.sourceReadAwaitMs\n    + snapshot.decodeTransformMs\n    + snapshot.resultAssemblyMs\n    + snapshot.cacheStoreMs;\n}\n\n"""
if old_decode_helper not in source:
    raise SystemExit('decodeMeasuredMs helper not found')
source = source.replace(old_decode_helper, '', 1)

start_marker = "  const reportText = (): string => {\n"
end_marker = "  const render = (): void => {\n"
start = source.find(start_marker)
end = source.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('reportText/render anchors not found')
chunk = source[start:end]
if not chunk.endswith("  };\n\n"):
    raise SystemExit('reportText block ending changed')
body = chunk[len(start_marker):-len("  };\n\n")]
wrapper = """  const reportText = (): string => buildPerformanceDiagnosticsReport(\n    loadRuns,\n    iniLoadRuns,\n    bindingRuns,\n    workspaceRestoreRuns,\n    channelRuns,\n  );\n\n"""
source = source[:start] + wrapper + source[end:]
path.write_text(source)

report_path = Path('apps/web/src/components/performance-diagnostics-report.ts')
report_path.write_text("""import { latestChannelDecodePerformance } from '../../../../core/parsers/mlg/channel-decode-performance';\nimport { latestBlobByteSourceRuntimeDiagnostics } from '../adapters/blob-byte-source';\nimport type {\n  ChannelBindingPerformanceRun,\n  ChannelPerformanceRun,\n  IniLoadPerformanceRun,\n  LoadPerformanceRun,\n  WorkspaceRestorePerformanceRun,\n} from './performance-diagnostics';\n\nfunction decodeMeasuredMs(snapshot: ReturnType<typeof latestChannelDecodePerformance>): number {\n  if (!snapshot) return 0;\n  return snapshot.cacheResolveMs\n    + snapshot.batchPlanMs\n    + snapshot.sourceReadAwaitMs\n    + snapshot.decodeTransformMs\n    + snapshot.resultAssemblyMs\n    + snapshot.cacheStoreMs;\n}\n\nexport function buildPerformanceDiagnosticsReport(\n  loadRuns: readonly LoadPerformanceRun[],\n  iniLoadRuns: readonly IniLoadPerformanceRun[],\n  bindingRuns: readonly ChannelBindingPerformanceRun[],\n  workspaceRestoreRuns: readonly WorkspaceRestorePerformanceRun[],\n  channelRuns: readonly ChannelPerformanceRun[],\n): string {\n""" + body + "}\n")
