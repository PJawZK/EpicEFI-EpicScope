from pathlib import Path

files = [
    Path('core/log-model/log-types.ts'),
    Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts'),
    Path('apps/web/src/adapters/persistent-channel-cache.ts'),
    Path('apps/web/src/components/graph-viewport.ts'),
    Path('apps/web/src/components/performance-diagnostics.ts'),
]
replacements = {
    'sidecarFileOpenMs': 'sidecarFileOpenAggregateMs',
    'sidecarBlobReadMs': 'sidecarBlobReadAggregateMs',
    'sidecarDecodeMs': 'sidecarDecodeAggregateMs',
    'sidecarFileOpen=': 'sidecarFileOpenAggregate=',
    'sidecarBlobRead=': 'sidecarBlobReadAggregate=',
    'sidecarDecode=': 'sidecarDecodeAggregate=',
}
for p in files:
    s = p.read_text()
    for old, new in replacements.items():
        s = s.replace(old, new)
    p.write_text(s)
