# EpicScope LOG-MLG Plan

## Purpose

`LOG-MLG` establishes EpicScope's first real log-import path.

The task must prove three things together:

1. MLG source files can be decoded safely and correctly;
2. decoded content normalizes into source-format-independent log/channel/time contracts;
3. the Web application can inspect a local `.mlg` without uploading the file or requiring the full file to be copied into a large per-record object graph.

This plan is the detailed task/file authority for the initial MLG implementation batch.

## Format authority and current support scope

Primary format authority:

- EFI Analytics `MLG_Binary_LogFormat_1.0.pdf`
- EFI Analytics `MLG_Binary_LogFormat_2.0.pdf`

Useful independent implementation references include rusEFI's MLG writer/reader and existing open-source MLG parsers, but they do not supersede the EFI Analytics specification.

Initial guaranteed parser target:

- MLVLG version 1;
- MLVLG version 2;
- standard data blocks;
- marker blocks;
- scalar field types defined by those specifications;
- bit-field descriptors defined by those specifications;
- big-endian v1/v2 decoding;
- scale/transform conversion using `displayValue = (rawValue + transform) * scale`.

TunerStudio has since introduced an MLVLG version 3 reader/spec generation with F64 and little-endian field variants. Exact version-3 layout/type ordinals are not yet an approved implementation authority in this repository. Until verified from authoritative specification or validated real-file evidence, version 3 must be detected and reported as unsupported rather than guessed.

The parser architecture must use version dispatch so adding v3 later does not require rewriting v1/v2 parsing.

## Important v1/v2 structure

The parser must not infer these values from file size alone.

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
- logger-field descriptors begin at offset 22;
- logger-field descriptor length: 55 bytes.

### Version 2 header

- timestamp: offset 8, 4 bytes;
- info-data start: offset 12, 4 bytes;
- data-begin index: offset 16, 4 bytes;
- record length: offset 20, 2 bytes;
- logger-field count: offset 22, 2 bytes;
- logger-field descriptors begin at offset 24;
- logger-field descriptor length: 89 bytes;
- v2 adds the category/group field.

### Data blocks

The v1/v2 record stream contains typed blocks.

Standard logger record:

- block type;
- rolling counter;
- 16-bit timestamp;
- packed logger-field record;
- one-byte record checksum/CRC value described by the specification.

Marker record:

- block type;
- rolling counter;
- timestamp;
- fixed-length marker/comment payload.

Timestamp wrap must be handled explicitly when constructing a monotonic normalized timebase. A raw 16-bit record timestamp cannot be treated as an absolute session timestamp by itself.

## Security and corruption rules

MLG files are untrusted input under D-028.

Before reading or allocating from file-provided metadata, validate at minimum:

- magic and supported version;
- header length required for that version;
- logger-field count against remaining file size;
- descriptor-array end against file size;
- `infoDataStart` and `dataBeginIndex` ordering and bounds;
- declared record length against the sum of known field widths;
- bit-field name offsets before dereferencing;
- every block read against remaining bytes;
- marker length against remaining bytes;
- arithmetic overflow when calculating offsets/counts;
- unsupported/unknown field and block types.

Truncated/corrupt data must produce structured parser diagnostics. It must not silently turn missing bytes into zero values.

CRC/counter mismatches should be surfaced as diagnostics/evidence. The first parser implementation should not silently discard the entire log merely because one recoverable record is bad, but recovery must never guess record boundaries when they are not trustworthy.

## Memory and source-access rule

The MLG parser must not require `ArrayBuffer(file.size)` as its public contract.

The approved source contract is asynchronous bounded byte access so browser `File`/`Blob` slicing and later native random-access/memory-mapped implementations can use the same parser semantics.

Conceptually:

```ts
interface RandomAccessByteSource {
  readonly size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}
```

Exact TypeScript naming may be refined during implementation, but the responsibility is fixed: the parser requests bounded ranges from a source instead of requiring the caller to materialize the entire log first.

Small test fixtures may use an in-memory implementation of the same contract.

## Normalized output boundary

Format-specific MLG structures stay under `core/parsers/mlg/`.

Consumers receive normalized concepts from `core/log-model/`.

The initial normalized contracts need enough information for Phase 1 without prematurely defining the entire final model:

- source identity/provenance;
- duration/time range when known;
- channel definitions preserving exact source names;
- units/category/display precision hints;
- value data type/validity metadata;
- parser diagnostics;
- markers;
- bounded sample/time queries or an implementation path that does not force per-sample JS objects.

The parser must not expose MLG descriptor offsets/block ordinals as UI contracts.

## Automated test strategy

Adopt **Vitest 5.x** for TypeScript parser/core tests.

Reasoning:

- it integrates directly with the existing Vite/TypeScript toolchain;
- TypeScript tests run without introducing a second transpilation pipeline;
- it is development/CI-only and adds no browser runtime dependency;
- current EpicScope GitHub Actions already uses Node 22.12.0, matching the current Vitest requirement;
- it provides straightforward fixture, malformed-input, and regression tests before parser code grows.

`web-ci.yml` must run the parser/core test suite in addition to type-check and build once Vitest is introduced.

Browser-only behavior should remain separately testable; LOG-MLG core tests must not require a DOM.

## Fixture strategy

Repository fixtures must remain small.

Required initial fixture categories:

1. synthetic valid MLVLG v1;
2. synthetic valid MLVLG v2;
3. v2 fixture containing category metadata;
4. marker-containing fixture;
5. timestamp-wrap fixture;
6. truncated-header fixture;
7. impossible offset/count fixture;
8. truncated-record fixture;
9. unsupported-version fixture;
10. unknown field/block-type fixture.

Synthetic fixtures should be deterministic and small enough for normal Git history.

At least one real EpicEFI/TunerStudio-generated `.mlg` must be validated before LOG-MLG is considered complete. A representative real file does not need to be committed if it is large; expected metadata/channel/sample facts can be preserved as a compact regression oracle where appropriate.

## Approved task split

### LOG-MLG-001 — Format/support contract

Goal:

- establish v1/v2 format authority, version dispatch, unsupported-version behavior, corruption policy, and fixture matrix.

Files:

- `docs/LOG_MLG_PLAN.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/HANDOFF.md`

Completion:

- format/version scope is explicit;
- no parser implementation relies on undocumented guesses.

### TEST-CORE-001 — Parser/core test runner

Goal:

- add Vitest as the approved TypeScript core test runner;
- wire tests into GitHub Web CI.

Expected files:

- `package.json`
- `package-lock.json`
- `.github/workflows/web-ci.yml`
- test configuration only if a real configuration need exists.

Completion:

- a minimal core test runs successfully in CI;
- production Web bundle remains unaffected by the test dependency.

### LOG-MODEL-001 — Minimal normalized log contracts

Goal:

- create only the normalized contracts required by MLG import and Phase 1 UI integration.

Location:

- `core/log-model/`

Expected responsibilities:

- source metadata/provenance;
- channel definitions;
- time/sample validity concepts;
- parser diagnostics/marker-facing normalized concepts where appropriate.

Do not define tune/analyzer/session persistence structures here merely because they may exist later.

### LOG-SOURCE-001 — Bounded random-access byte source

Goal:

- define a parser-facing bounded byte-source contract;
- provide an in-memory test implementation;
- provide the Web `Blob`/`File` adapter when UI integration begins.

Expected locations:

- `core/parsers/` for source-access contract;
- `apps/web/src/adapters/` for browser `Blob`/`File` implementation;
- test location appropriate to each implementation.

The core contract must not depend on DOM or browser APIs.

### LOG-MLG-002 — Header and field descriptor parser

Goal:

- detect MLVLG;
- dispatch v1/v2;
- parse and validate header;
- parse scalar/bit-field descriptors;
- expose source metadata and normalized channel definitions.

Location:

- `core/parsers/mlg/`

Expected implementation files should separate public parser orchestration from low-level format definitions/errors where that improves testability. Do not create generic utility folders.

Validation:

- synthetic v1/v2 fixtures;
- malformed offset/count/header cases;
- scale/transform metadata;
- category behavior.

### LOG-MLG-003 — Record/marker scan and timebase

Goal:

- scan standard records and markers safely;
- validate record boundaries;
- unwrap timestamp rollover into monotonic session time;
- report counter/CRC diagnostics;
- expose values without requiring per-record object expansion as the only storage model.

Location:

- `core/parsers/mlg/` with normalized contracts in `core/log-model/` as required.

Validation:

- valid data records;
- markers;
- rollover;
- truncation;
- corrupt/unknown block cases.

### LOG-MLG-004 — Web local-file integration

Goal:

- allow a local `.mlg` to be selected from the hosted Pages app;
- keep bytes client-side;
- populate loaded-log identity and Full Sensor List from normalized parser output;
- present useful parse errors/warnings without crashing the shell.

Expected locations:

- `apps/web/src/adapters/` for browser source/import adaptation;
- existing Web page/panel/state areas for presentation/orchestration only.

The Web UI must not decode MLG binary structures directly.

Completion:

- Pages-hosted EpicScope opens a real supported MLG locally;
- filename/metadata/channels appear;
- no upload/network path is used;
- parser failure is visible and recoverable.

### LOG-MLG-005 — Real-log validation and first performance baseline

Goal:

- validate against at least one real EpicEFI/TunerStudio MLG;
- record actual format version and representative channel facts;
- capture first Web parse/index timing and peak-memory observations for regression comparison.

The initial benchmark is diagnostic, not a promise that Web already satisfies the final Linux 1 GiB/2 GiB requirement.

## Explicitly deferred

LOG-MLG does not authorize:

- graph rendering library selection;
- histogram/scatter/analyzer logic;
- tune/INI/MSQ parsing;
- CSV parsing;
- cloud upload/share;
- full session persistence;
- live ECU acquisition;
- speculative MLG v3 decoding without verified format authority.

## Completion criteria

LOG-MLG is complete when:

- v1/v2 support is tested and documented;
- unsupported versions fail clearly;
- malformed input is bounded and tested;
- exact source channel names/metadata normalize correctly;
- marker/timestamp behavior is validated;
- GitHub CI runs parser/core tests;
- the Pages-hosted app can open a representative real MLG locally and populate log identity/channel metadata;
- the project owner does not need a local development environment;
- handoff/roadmap reflect the validated result.
