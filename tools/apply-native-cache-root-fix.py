from pathlib import Path

p = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
s = p.read_text()
s = s.replace("const SIDECAR_ROOT = 'epicscope-mlg-sidecars-v1';\n", "const SIDECAR_ROOT = 'epicscope-mlg-sidecars-v1';\nconst NATIVE_ROOT = 'epicscope-mlg-native-columns-v1';\n", 1)
needle = "async function resetLogDirectory(logKey: string): Promise<OpfsDirectoryHandle | undefined> {"
insert = """async function openNativeLogDirectory(\n  logKey: string,\n  create: boolean,\n): Promise<OpfsDirectoryHandle | undefined> {\n  const storage = storageManager();\n  if (!storage?.getDirectory) return undefined;\n  const root = await storage.getDirectory();\n  const nativeColumns = await root.getDirectoryHandle(NATIVE_ROOT, { create });\n  return nativeColumns.getDirectoryHandle(sidecarStorageKey(logKey), { create });\n}\n\n"""
if needle not in s:
    raise SystemExit('resetLogDirectory anchor missing')
s = s.replace(needle, insert + needle, 1)
s = s.replace("const directory = await openLogDirectory(logKey, false);\n    if (!directory) return undefined;\n    const file = await (await directory.getFileHandle(NATIVE_INDEX_FILE)).getFile();", "const directory = await openNativeLogDirectory(logKey, false);\n    if (!directory) return undefined;\n    const file = await (await directory.getFileHandle(NATIVE_INDEX_FILE)).getFile();", 1)
s = s.replace("const directory = await openLogDirectory(this.logKey, false);\n      if (!directory) return undefined;\n      const file = await (await directory.getFileHandle(nativeColumnFileName(field.fieldIndex))).getFile();", "const directory = await openNativeLogDirectory(this.logKey, false);\n      if (!directory) return undefined;\n      const file = await (await directory.getFileHandle(nativeColumnFileName(field.fieldIndex))).getFile();", 1)
s = s.replace("const directory = await openLogDirectory(this.logKey, true);\n      if (!directory) return;\n      const stream = await (await directory.getFileHandle(nativeColumnFileName(field.fieldIndex), { create: true }))", "const directory = await openNativeLogDirectory(this.logKey, true);\n      if (!directory) return;\n      const stream = await (await directory.getFileHandle(nativeColumnFileName(field.fieldIndex), { create: true }))", 1)
p.write_text(s)

p = Path('apps/web/src/adapters/mlg-column-sidecar-storage.ts')
s = p.read_text()
s = s.replace("const SIDECAR_ROOT = 'epicscope-mlg-sidecars-v1';\n", "const SIDECAR_ROOT = 'epicscope-mlg-sidecars-v1';\nconst NATIVE_ROOT = 'epicscope-mlg-native-columns-v1';\n", 1)
old = """export async function clearMlgColumnSidecars(): Promise<void> {\n  const storage = storageManager();\n  if (!storage?.getDirectory) return;\n  try {\n    const root = await storage.getDirectory();\n    await root.removeEntry(SIDECAR_ROOT, { recursive: true });\n  } catch {\n    // Missing OPFS sidecar storage is already equivalent to a cleared cache.\n  }\n}\n"""
new = """export async function clearMlgColumnSidecars(): Promise<void> {\n  const storage = storageManager();\n  if (!storage?.getDirectory) return;\n  const root = await storage.getDirectory();\n  for (const storageRoot of [SIDECAR_ROOT, NATIVE_ROOT]) {\n    try {\n      await root.removeEntry(storageRoot, { recursive: true });\n    } catch {\n      // Missing OPFS cache storage is already equivalent to a cleared cache.\n    }\n  }\n}\n"""
if old not in s:
    raise SystemExit('clearMlgColumnSidecars block missing')
s = s.replace(old, new, 1)
p.write_text(s)
