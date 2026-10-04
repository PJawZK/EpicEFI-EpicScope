from pathlib import Path

p = Path('apps/web/src/app/app-shell.ts')
s = p.read_text()
anchor = 'performanceDiagnostics.recordChannel({'
start = s.find(anchor)
if start < 0:
    raise SystemExit('recordChannel block not found')
end = s.find('});', start)
if end < 0:
    raise SystemExit('recordChannel block end not found')
block = s[start:end]
needle = '      physicalReadMs: run.physicalReadMs,\n'
if needle not in block:
    raise SystemExit('physicalReadMs forwarding line not found in recordChannel block')
addition = '''      persistentLookupMs: run.persistentLookupMs,
      persistentRangeBuildMs: run.persistentRangeBuildMs,
      delegatedSourceMs: run.delegatedSourceMs,
      sidecarManifestMs: run.sidecarManifestMs,
      sidecarFileOpenAggregateMs: run.sidecarFileOpenAggregateMs,
      sidecarBlobReadAggregateMs: run.sidecarBlobReadAggregateMs,
      sidecarDecodeAggregateMs: run.sidecarDecodeAggregateMs,
      sidecarRangeBuildMs: run.sidecarRangeBuildMs,
'''
block = block.replace(needle, needle + addition, 1)
s = s[:start] + block + s[end:]
p.write_text(s)
