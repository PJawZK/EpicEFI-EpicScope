<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Research-to-product disposition is tracked in `docs/research/STATUS.md`.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope LOG-MLG Plan

## Status

**MLVLG v1/v2 implementation complete; MLG v3 compatibility researched but not yet implemented.**

This document remains the parser/support policy for MLG import. The detailed v3 investigation is preserved in `docs/research/MLG_V3_RESEARCH.md`.

## Current production support

Guaranteed parser target:

- MLVLG version 1;
- MLVLG version 2;
- standard data blocks;
- marker blocks;
- scalar field types defined by the v1/v2 specifications;
- bit-field descriptors defined by those specifications;
- big-endian v1/v2 decoding;
- scale/transform conversion using `displayValue = (rawValue + transform) * scale`;
- bounded/random-access source reads;
- source diagnostics for malformed/truncated/corrupt data;
- timestamp rollover/counter-wrap handling;
- staged/large-log validation and browser-local import.

Unsupported versions must fail clearly rather than being guessed.

## Current MLG v3 position — 2026-10-14

TunerStudio/MLV v3 was investigated using:

- TunerStudioMS 3.6.00.06 Beta;
- MegaLogViewer HD 4.6.14;
- a real beta-generated bench log;
- controlled synthetic v3 fixtures.

Confirmed conclusions are preserved in `docs/research/MLG_V3_RESEARCH.md`.

### Confirmed architecture conclusion

MLG v3 is not a separate parser architecture. It follows the broad v2-style container path with expanded field-type/endianness semantics.

Therefore future support should **extend the existing parser** rather than fork a new v3 reader.

### Confirmed scalar descriptor IDs

The tested v3 LoggerField path confirms:

| ID | Meaning | Width | Byte order |
|---:|---|---:|---|
| 0 | U08 | 1 | n/a |
| 1 | S08 | 1 | n/a |
| 2 | U16 | 2 | big-endian |
| 3 | S16 | 2 | big-endian |
| 4 | U32 | 4 | big-endian |
| 5 | S32 | 4 | big-endian |
| 6 | S64 | 8 | big-endian |
| 7 | F32 | 4 | big-endian |
| 9 | U16 | 2 | little-endian |
| 10 | S16 | 2 | little-endian |
| 11 | U32 | 4 | little-endian |
| 12 | S32 | 4 | little-endian |
| 13 | S64 | 8 | little-endian |
| 14 | F32 | 4 | little-endian |

Descriptor IDs **8 and 15 were rejected** by the tested LoggerField path and must not be guessed as F64 merely because unrelated internal type infrastructure contains double-width concepts.

Exact on-disk F64 mapping remains unresolved for the tested generation.

The extended v3 bitfield namespace also remains intentionally unresolved until fixture-validated.

### Current compatibility impact

A v3-capable TunerStudio does not automatically emit v3 files. The real EpicEFI beta bench log remained version 2 because its channel set used legacy encodings.

Therefore:

- v3 support is a compatibility expansion rather than a current EpicEFI blocker;
- current production support remains v1/v2;
- version 3 should continue to be detected/reported as unsupported until the confirmed extension is implemented and regression-tested.

## Future v3 parser direction

Represent decoded field types explicitly rather than accumulating special-case switches:

```text
widthBytes
numericKind = unsigned | signed | float | bitfield
endianness = big | little
```

Future implementation should:

- accept version 3;
- retain v2-style outer-layout handling;
- represent per-field byte order explicitly;
- support confirmed LE scalar IDs 9..14;
- validate/extend the v3 bitfield family;
- reject unknown/reserved IDs explicitly;
- preserve identical v1/v2 behavior.

## Important v1/v2 structure

### Common identity

- magic: `MLVLG\0`;
- format version: 16-bit value at offset 6;
- values are big-endian for v1/v2.

### Version 1 header

- timestamp: offset 8, 4 bytes;
- info-data start: offset 12, 2 bytes;
- data-begin index: offset 14, 4 bytes;
- record length: offset 18, 2 bytes;
- logger-field count: offset 20, 2 bytes;
- descriptors begin at offset 22;
- descriptor length: 55 bytes.

### Version 2 header

- timestamp: offset 8, 4 bytes;
- info-data start: offset 12, 4 bytes;
- data-begin index: offset 16, 4 bytes;
- record length: offset 20, 2 bytes;
- logger-field count: offset 22, 2 bytes;
- descriptors begin at offset 24;
- descriptor length: 89 bytes;
- v2 adds category/group metadata.

### Record stream

Standard record structure:

```text
block type
rolling counter
16-bit timestamp
packed field payload
one-byte payload checksum
```

Marker records use the same block/counter/timestamp framing with marker/comment payload.

Timestamp wrap must be unwrapped into a monotonic normalized timebase.

## Security and corruption rules

MLG files are untrusted input.

Before reading or allocating from file-provided metadata, validate:

- magic and supported version;
- version-specific header length;
- field count against remaining file size;
- descriptor-array bounds;
- info/data offsets and ordering;
- declared record length against field widths;
- bit-field offsets before dereferencing;
- every block read against remaining bytes;
- arithmetic overflow in offset/count calculations;
- unsupported/unknown field and block types.

Truncated/corrupt data must produce structured diagnostics. Missing bytes must not silently become zero values.

CRC/counter problems remain source evidence. Recovery must never invent trustworthy record boundaries without sufficient evidence.

EpicScope's handling of EpicEFI retry runs is intentionally stronger than simple compatibility behavior: invalid attempts may remain visible as source diagnostics while trusted samples use the valid attempt.

## Memory/source-access invariant

The parser must not require `ArrayBuffer(file.size)` as its public contract.

The parser-facing model remains bounded asynchronous random access, conceptually:

```ts
interface RandomAccessByteSource {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}
```

Browser `File`/`Blob` slicing and later native random-access/memory-mapped sources should preserve the same parser semantics.

## Normalized output boundary

MLG-specific structures stay under `core/parsers/mlg/`.

Consumers receive normalized concepts from `core/log-model/`, including:

- source identity/provenance;
- normalized time range;
- channel definitions preserving exact source names;
- units/category/display hints;
- validity metadata;
- parser diagnostics;
- markers;
- bounded sample/time queries.

MLG descriptor offsets/block ordinals must not become UI contracts.

## Regression requirements

Core parser tests remain Node-only and must not require a DOM.

Existing v1/v2 regression areas include:

- valid v1/v2 headers;
- category metadata;
- markers;
- timestamp wrap;
- counter wrap;
- truncated headers/records;
- impossible offsets/counts;
- unknown field/block types;
- retry/corruption recovery;
- real-log metadata/channel facts.

When v3 support is implemented, add at minimum:

- v3 header acceptance;
- LE U16/S16/U32/S32/S64/F32;
- mixed legacy + v3 fields in one record;
- exact mixed-width offset accumulation;
- unchanged record checksum behavior;
- explicit rejection of reserved/unknown IDs;
- v3 bitfields once mapping is fixture-validated;
- proof that real v2 logs continue decoding identically.

## Large-log performance policy

The representative regression workload remains approximately 1.19 GB with 320,458 records and 1,389 channels.

Broad Web performance optimization is paused because the current architecture is sufficient for the functional reference.

Do not alter checksum/retry/correctness semantics as a performance shortcut. Resume performance work only for a measured regression or a clearly defined low-spec target.

## Privacy

MLG import remains local-first. Opening/analyzing a local log must not require upload or silently transmit log contents, filenames or derived values.

## Current completion boundary

LOG-MLG v1/v2 is complete when maintained behavior continues to satisfy:

- supported versions decode correctly;
- unsupported versions fail clearly;
- malformed input is bounded and tested;
- exact source channel names/metadata normalize correctly;
- marker/timestamp behavior is valid;
- CI runs parser/core tests;
- the Web app opens representative real MLG files locally;
- source diagnostics remain visible and trustworthy.

MLG v3 is a separate compatibility extension governed by the preserved research and future regression work.
