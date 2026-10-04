from pathlib import Path

path = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
text = path.read_text()

insert_after = '''async function openLogDirectory(\n  logKey: string,\n  create: boolean,\n): Promise<OpfsDirectoryHandle | undefined> {\n  const storage = storageManager();\n  if (!storage?.getDirectory) return undefined;\n  const root = await storage.getDirectory();\n  const sidecars = await root.getDirectoryHandle(SIDECAR_ROOT, { create });\n  return sidecars.getDirectoryHandle(sidecarStorageKey(logKey), { create });\n}\n'''
reset_fn = '''\nasync function resetLogDirectory(logKey: string): Promise<OpfsDirectoryHandle | undefined> {\n  const storage = storageManager();\n  if (!storage?.getDirectory) return undefined;\n  const root = await storage.getDirectory();\n  const sidecars = await root.getDirectoryHandle(SIDECAR_ROOT, { create: true });\n  try {\n    await sidecars.removeEntry(sidecarStorageKey(logKey), { recursive: true });\n  } catch {\n    // Missing or incomplete prior sidecar storage needs no cleanup.\n  }\n  return sidecars.getDirectoryHandle(sidecarStorageKey(logKey), { create: true });\n}\n'''
if reset_fn.strip() not in text:
    if insert_after not in text:
        raise SystemExit('openLogDirectory pattern missing')
    text = text.replace(insert_after, insert_after + reset_fn, 1)

old = '''  const estimatedBytes = plan.fieldPayloadBytes * recordIndex.offsets.length;\n  try {\n    const estimate = await storage.estimate();\n    if (\n      estimate.quota !== undefined\n      && estimate.usage !== undefined\n      && estimatedBytes > Math.max(0, estimate.quota - estimate.usage) * 0.95\n    ) {\n      return undefined;\n    }\n  } catch {\n    // Quota estimates are advisory only.\n  }\n\n  let directory: OpfsDirectoryHandle;\n  try {\n    const opened = await openLogDirectory(logKey, true);\n    if (!opened) return undefined;\n    directory = opened;\n    await removeManifest(directory);\n  } catch {\n    return undefined;\n  }\n'''
new = '''  const estimatedBytes = plan.fieldPayloadBytes * recordIndex.offsets.length;\n\n  let directory: OpfsDirectoryHandle;\n  try {\n    const opened = await resetLogDirectory(logKey);\n    if (!opened) return undefined;\n    directory = opened;\n  } catch {\n    return undefined;\n  }\n\n  try {\n    const estimate = await storage.estimate();\n    if (\n      estimate.quota !== undefined\n      && estimate.usage !== undefined\n      && estimatedBytes > Math.max(0, estimate.quota - estimate.usage) * 0.95\n    ) {\n      return undefined;\n    }\n  } catch {\n    // Quota estimates are advisory only.\n  }\n'''
if old not in text:
    raise SystemExit('builder quota/setup pattern missing')
text = text.replace(old, new, 1)
path.write_text(text)
