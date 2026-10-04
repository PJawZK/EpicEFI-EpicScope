from pathlib import Path

fields = [
    'persistentLookupMs',
    'persistentRangeBuildMs',
    'delegatedSourceMs',
    'sidecarManifestMs',
    'sidecarFileOpenMs',
    'sidecarBlobReadMs',
    'sidecarDecodeMs',
    'sidecarRangeBuildMs',
]

p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()
for field in fields:
    s = s.replace(f'  readonly {field}?: number;\n', f'  readonly {field}?: number | undefined;\n', 1)
p.write_text(s)

p = Path('apps/web/src/components/performance-diagnostics.ts')
s = p.read_text()
needle = "export interface ChannelPerformanceRun {\n  readonly channelName: string;\n"
if needle not in s:
    raise SystemExit('ChannelPerformanceRun needle not found')
addition = ''.join(f'  readonly {field}?: number | undefined;\n' for field in fields)
s = s.replace(needle, needle + addition, 1)
p.write_text(s)
