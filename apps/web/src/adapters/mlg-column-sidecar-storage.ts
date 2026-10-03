import type { MlgColumnSidecarManifest } from '../workers/mlg-worker-protocol';

const SIDECAR_ROOT = 'epicscope-mlg-sidecars-v1';
const MANIFEST_FILE = 'manifest.json';

interface OpfsFileHandle {
  getFile(): Promise<File>;
}

interface OpfsDirectoryHandle {
  getDirectoryHandle(name: string, options?: { readonly create?: boolean }): Promise<OpfsDirectoryHandle>;
  getFileHandle(name: string, options?: { readonly create?: boolean }): Promise<OpfsFileHandle>;
  removeEntry(name: string, options?: { readonly recursive?: boolean }): Promise<void>;
}

interface OpfsStorageLike {
  getDirectory?: () => Promise<OpfsDirectoryHandle>;
}

function storageManager(): OpfsStorageLike | undefined {
  return globalThis.navigator?.storage as unknown as OpfsStorageLike | undefined;
}

function sidecarStorageKey(logKey: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < logKey.length; index += 1) {
    hash ^= logKey.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `log-${hash.toString(16).padStart(8, '0')}`;
}

export async function findCompleteMlgColumnSidecar(
  logKey: string,
  sampleCount: number,
  fieldCount: number,
  fieldPayloadBytes: number,
): Promise<MlgColumnSidecarManifest | undefined> {
  const storage = storageManager();
  if (!storage?.getDirectory) return undefined;

  try {
    const root = await storage.getDirectory();
    const sidecars = await root.getDirectoryHandle(SIDECAR_ROOT);
    const directory = await sidecars.getDirectoryHandle(sidecarStorageKey(logKey));
    const manifestFile = await (await directory.getFileHandle(MANIFEST_FILE)).getFile();
    const manifest = JSON.parse(await manifestFile.text()) as MlgColumnSidecarManifest;
    if (
      manifest.schemaVersion !== 1
      || manifest.logKey !== logKey
      || manifest.sampleCount !== sampleCount
      || manifest.fieldCount !== fieldCount
      || manifest.fieldPayloadBytes !== fieldPayloadBytes
    ) {
      return undefined;
    }

    for (const stripe of manifest.stripes) {
      const file = await (await directory.getFileHandle(stripe.fileName)).getFile();
      if (file.size !== sampleCount * stripe.widthBytes) return undefined;
    }
    return manifest;
  } catch {
    return undefined;
  }
}

export async function clearMlgColumnSidecars(): Promise<void> {
  const storage = storageManager();
  if (!storage?.getDirectory) return;
  try {
    const root = await storage.getDirectory();
    await root.removeEntry(SIDECAR_ROOT, { recursive: true });
  } catch {
    // Missing OPFS sidecar storage is already equivalent to a cleared cache.
  }
}
