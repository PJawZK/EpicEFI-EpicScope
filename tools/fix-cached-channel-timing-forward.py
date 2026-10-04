from pathlib import Path

p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()
needle = "        physicalReadCount: result.performance.physicalReadCount,\n        physicalBytesRead: result.performance.physicalBytesRead,\n        physicalReadMs: result.performance.physicalReadMs,\n      });\n      return true;\n"
replace = "        physicalReadCount: result.performance.physicalReadCount,\n        physicalBytesRead: result.performance.physicalBytesRead,\n        physicalReadMs: result.performance.physicalReadMs,\n        persistentLookupMs: result.performance.persistentLookupMs,\n        persistentRangeBuildMs: result.performance.persistentRangeBuildMs,\n        delegatedSourceMs: result.performance.delegatedSourceMs,\n        sidecarManifestMs: result.performance.sidecarManifestMs,\n        sidecarFileOpenMs: result.performance.sidecarFileOpenMs,\n        sidecarBlobReadMs: result.performance.sidecarBlobReadMs,\n        sidecarDecodeMs: result.performance.sidecarDecodeMs,\n        sidecarRangeBuildMs: result.performance.sidecarRangeBuildMs,\n      });\n      return true;\n"
if needle not in s:
    raise SystemExit('activateCachedChannel performance emission needle not found')
s = s.replace(needle, replace, 1)
p.write_text(s)
