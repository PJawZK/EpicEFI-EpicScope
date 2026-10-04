from pathlib import Path

# 1) Protocol: schema v2, one data file, positioned stripe offsets.
path = Path('apps/web/src/workers/mlg-worker-protocol.ts')
text = path.read_text()
text = text.replace(
"export interface MlgColumnSidecarStripeManifest {\n  readonly index: number;\n  readonly fileName: string;\n  readonly startByte: number;\n  readonly widthBytes: number;\n  readonly firstFieldIndex: number;\n  readonly lastFieldIndexExclusive: number;\n}\n\nexport interface MlgColumnSidecarManifest {\n  readonly schemaVersion: 1;\n  readonly logKey: string;\n  readonly storageKey: string;\n",
"export interface MlgColumnSidecarStripeManifest {\n  readonly index: number;\n  readonly startByte: number;\n  readonly widthBytes: number;\n  readonly firstFieldIndex: number;\n  readonly lastFieldIndexExclusive: number;\n  readonly storageOffset: number;\n}\n\nexport interface MlgColumnSidecarManifest {\n  readonly schemaVersion: 2;\n  readonly logKey: string;\n  readonly storageKey: string;\n  readonly dataFileName: string;\n",
1)
path.write_text(text)

# 2) Complete-sidecar verification: one data file and v2 schema.
path = Path('apps/web/src/adapters/mlg-column-sidecar-storage.ts')
text = path.read_text()
text = text.replace("      manifest.schemaVersion !== 1", "      manifest.schemaVersion !== 2", 1)
old = """    for (const stripe of manifest.stripes) {\n      const file = await (await directory.getFileHandle(stripe.fileName)).getFile();\n      if (file.size !== sampleCount * stripe.widthBytes) return undefined;\n    }\n    return manifest;\n"""
new = """    const dataFile = await (await directory.getFileHandle(manifest.dataFileName)).getFile();\n    if (dataFile.size !== manifest.totalBytes) return undefined;\n    for (const stripe of manifest.stripes) {\n      if (stripe.storageOffset < 0) return undefined;\n      if (stripe.storageOffset + sampleCount * stripe.widthBytes > dataFile.size) return undefined;\n    }\n    return manifest;\n"""
if old not in text:
    raise SystemExit('storage verifier pattern missing')
text = text.replace(old, new, 1)
path.write_text(text)

# 3) Builder/reader conversion.
path = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
text = path.read_text()
text = text.replace("const TARGET_STRIPE_BYTES = 256;", "const TARGET_STRIPE_BYTES = 64;\nconst DATA_FILE = 'columns.bin';", 1)

text = text.replace(
"""interface OpfsFileHandle {\n  getFile(): Promise<File>;\n  createWritable(options?: { readonly keepExistingData?: boolean }): Promise<OpfsWritable>;\n}\n""",
"""interface OpfsSyncAccessHandle {\n  write(data: BufferSource, options?: { readonly at?: number }): number;\n  truncate(size: number): void;\n  flush(): void;\n  close(): void;\n}\n\ninterface OpfsFileHandle {\n  getFile(): Promise<File>;\n  createWritable(options?: { readonly keepExistingData?: boolean }): Promise<OpfsWritable>;\n  createSyncAccessHandle?: () => Promise<OpfsSyncAccessHandle>;\n}\n""",
1)

text = text.replace(
"""    stripes.push({\n      index,\n      fileName: `stripe-${String(index).padStart(4, '0')}.bin`,\n      startByte: stripeStartByte,\n      widthBytes: stripeWidth,\n      firstFieldIndex: stripeFirstField,\n      lastFieldIndexExclusive,\n    });\n""",
"""    stripes.push({\n      index,\n      startByte: stripeStartByte,\n      widthBytes: stripeWidth,\n      firstFieldIndex: stripeFirstField,\n      lastFieldIndexExclusive,\n      storageOffset: 0,\n    });\n""",
1)

# Replace the multi-stream builder setup through return block up to decodeRawValue.
start = text.index("  const streams: OpfsWritable[] = [];")
end = text.index("\nfunction decodeRawValue", start)
replacement = r'''  let dataFileHandle: OpfsFileHandle;
  let access: OpfsSyncAccessHandle;
  try {
    dataFileHandle = await directory.getFileHandle(DATA_FILE, { create: true });
    if (!dataFileHandle.createSyncAccessHandle) return undefined;
    access = await dataFileHandle.createSyncAccessHandle();
    access.truncate(estimatedBytes);
  } catch {
    return undefined;
  }

  const laidOutStripes = plan.stripes.map((stripe, index) => {
    let storageOffset = 0;
    for (let prior = 0; prior < index; prior += 1) {
      const previous = plan.stripes[prior];
      if (previous) storageOffset += previous.widthBytes * recordIndex.offsets.length;
    }
    return { ...stripe, storageOffset };
  });

  const buildStarted = now();
  let transposeMs = 0;
  let writeMs = 0;
  let bytesWritten = 0;
  let completedSamples = 0;
  let aborted = false;
  let closed = false;

  const closeAccess = (): void => {
    if (closed) return;
    closed = true;
    access.close();
  };

  const abort = async (): Promise<void> => {
    if (aborted) return;
    aborted = true;
    closeAccess();
    await removeManifest(directory);
    try {
      await directory.removeEntry(DATA_FILE);
    } catch {
      // Missing partial data file is already equivalent to an aborted sidecar.
    }
  };

  return {
    append: async (batch) => {
      if (aborted) return;
      const sampleCount = batch.lastIndex - batch.firstIndex + 1;
      if (sampleCount <= 0) return;

      const transposeStarted = now();
      const outputs = laidOutStripes.map(
        (stripe) => new Uint8Array(sampleCount * stripe.widthBytes),
      );
      for (let index = batch.firstIndex; index <= batch.lastIndex; index += 1) {
        const absoluteOffset = recordIndex.offsets[index];
        if (absoluteOffset === undefined) {
          throw new RangeError(`Missing MLG record offset for sidecar sample ${index}.`);
        }
        const relativeRecordOffset = absoluteOffset - batch.firstOffset;
        const outputSampleIndex = index - batch.firstIndex;
        for (const stripe of laidOutStripes) {
          const sourceStart = relativeRecordOffset + BLOCK_HEADER_LENGTH + stripe.startByte;
          const sourceEnd = sourceStart + stripe.widthBytes;
          const outputStart = outputSampleIndex * stripe.widthBytes;
          outputs[stripe.index]!.set(batch.bytes.subarray(sourceStart, sourceEnd), outputStart);
        }
      }
      transposeMs += now() - transposeStarted;

      const writeStarted = now();
      for (let index = 0; index < outputs.length; index += 1) {
        const stripe = laidOutStripes[index];
        const output = outputs[index];
        if (!stripe || !output) continue;
        const at = stripe.storageOffset + batch.firstIndex * stripe.widthBytes;
        const written = access.write(output, { at });
        if (written != output.byteLength) {
          throw new RangeError(
            `MLG sidecar stripe ${stripe.index} wrote ${written} bytes, expected ${output.byteLength}.`,
          );
        }
      }
      writeMs += now() - writeStarted;
      bytesWritten += outputs.reduce((sum, output) => sum + output.byteLength, 0);
      completedSamples += sampleCount;
    },
    finish: async () => {
      if (aborted) throw new Error('MLG sidecar build was aborted.');
      if (completedSamples !== recordIndex.offsets.length) {
        await abort();
        throw new Error(
          `MLG sidecar expected ${recordIndex.offsets.length} samples, wrote ${completedSamples}.`,
        );
      }
      access.flush();
      closeAccess();

      const manifest: MlgColumnSidecarManifest = {
        schemaVersion: 2,
        logKey,
        storageKey: sidecarStorageKey(logKey),
        dataFileName: DATA_FILE,
        sampleCount: recordIndex.offsets.length,
        fieldCount: fields.length,
        recordLength,
        fieldPayloadBytes: plan.fieldPayloadBytes,
        targetStripeBytes: TARGET_STRIPE_BYTES,
        totalBytes: bytesWritten,
        stripes: laidOutStripes,
        createdAt: Date.now(),
      };
      const stream = await (await directory.getFileHandle(MANIFEST_FILE, { create: true }))
        .createWritable({ keepExistingData: false });
      await stream.write(JSON.stringify(manifest));
      await stream.close();

      return {
        manifest,
        performance: {
          totalMs: now() - buildStarted,
          transposeMs,
          writeMs,
          bytesWritten,
        },
      };
    },
    abort,
  };
}
'''
text = text[:start] + replacement + text[end:]

text = text.replace("  private readonly stripeFiles = new Map<number, File>();", "  private dataFile: File | undefined;", 1)
text = text.replace("      manifest.schemaVersion !== 1", "      manifest.schemaVersion !== 2", 1)
text = text.replace("    this.stripeFiles.clear();", "    this.dataFile = undefined;", 2)

old = r'''  private async stripeFile(stripe: MlgColumnSidecarStripeManifest): Promise<File> {
    const cached = this.stripeFiles.get(stripe.index);
    if (cached) return cached;
    const directory = await openLogDirectory(this.logKey, false);
    if (!directory) throw new Error('MLG sidecar OPFS directory is unavailable.');
    const file = await (await directory.getFileHandle(stripe.fileName)).getFile();
    this.stripeFiles.set(stripe.index, file);
    return file;
  }
'''
new = r'''  private async sidecarDataFile(manifest: MlgColumnSidecarManifest): Promise<File> {
    if (this.dataFile) return this.dataFile;
    const directory = await openLogDirectory(this.logKey, false);
    if (!directory) throw new Error('MLG sidecar OPFS directory is unavailable.');
    const file = await (await directory.getFileHandle(manifest.dataFileName)).getFile();
    this.dataFile = file;
    return file;
  }
'''
if old not in text:
    raise SystemExit('stripeFile method pattern missing')
text = text.replace(old, new, 1)

text = text.replace(
"""        const file = await this.stripeFile(stripe);\n        const byteStart = startSampleIndex * stripe.widthBytes;\n        const byteLength = sampleCount * stripe.widthBytes;\n""",
"""        const file = await this.sidecarDataFile(manifest);\n        const byteStart = stripe.storageOffset + startSampleIndex * stripe.widthBytes;\n        const byteLength = sampleCount * stripe.widthBytes;\n""",
1)

# Strengthen activation layout validation for storage offsets.
needle = """        || actual.lastFieldIndexExclusive !== expected.lastFieldIndexExclusive\n      ) {\n"""
replacement2 = """        || actual.lastFieldIndexExclusive !== expected.lastFieldIndexExclusive\n        || actual.storageOffset < 0\n      ) {\n"""
if needle not in text:
    raise SystemExit('activation pattern missing')
text = text.replace(needle, replacement2, 1)

path.write_text(text)
