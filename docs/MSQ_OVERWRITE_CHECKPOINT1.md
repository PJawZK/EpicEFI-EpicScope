# MSQ overwrite — checkpoint 1: accepted document and file-handle loading

Baseline: `7845c6d2405afbfe7cdcbe177fe5786aa989835d`. This checkpoint changes loading only. Save MSQ/Shim remains disabled. No write permission request, writable stream, overwrite, external-file watcher, ECU write or Burn is implemented.

## Established reference

The user runs Brave1.97.59 / Chromium155.0.8059.85 on localhost and TunerStudio3.3.01. Their two supplied MSQs have matching firmware signatures,6559 recognized entries, and a32×32 page0 `veTable`. Only that table and bibliography writeDate differ semantically: all1024 VE cells were multiplied by1.25 and rounded to hundredths. Both files declare ISO-8859-1 and contain non-UTF-8 bytes. The matching INI defines VE scale0.01 and range0–650, while the MSQ display digits are1. These are reference facts for checkpoint2, not a hard-coded global VE policy. User files are external validation inputs and are not committed to the repository.

## Owners and behavior

- `msq-document-source.ts` decodes supported UTF-8 and actual ISO-8859-1, retains every original byte, decoded text, declared/canonical encoding and UTF-8 BOM information. ISO decoding avoids WHATWG's Windows-1252 alias mapping. UTF-8 is strict rather than silently replacing invalid bytes. UTF-16, other declarations, conflicting BOMs and unsupported/oversized declarations reject actionably; they are not silently re-encoded. This checkpoint does not add a serializer.
- `msq-document-loader.ts` is the session-local accepted-document owner. Original bytes/text/encoding, validated TuneModel, filename/size/modification time, generation and optional native handle are accepted together. Rejected or stale candidates leave the whole prior document intact. No handle or MSQ content is persisted to browser storage or added to diagnostics.
- `app-shell.ts` still owns application publication and its active tune references. The loader calls the shell only for a valid, accepted candidate. Existing `prepareMsqCandidate` validation, display-failure handling and active-domain routing remain. There is one load-generation owner, replacing the shell's old standalone counter rather than layering another load invalidation system onto it.
- The Load MSQ button directly invokes `showOpenFilePicker` under user activation when available in a secure context. It retains the selected native file handle but does not ask for write permission. A retained handle is future capability, not proof that writing is authorized. The loaded-file tooltip states “file handle retained; saving not yet available.”
- Unsupported/insecure environments retain the normal file-input path, explicitly identified as a read-only load. A denied native picker reports an error rather than silently changing access mode or opening another picker.
- Chooser ordering and read ordering are separate: an old chooser cannot replace a later selection, while cancelling a chooser does not cancel an already-running valid read. Selection-time native getFile, byte reads, decoding and validation are generation guarded. An empty selection/cancel leaves accepted tune and load feedback unchanged.
- File-input byte reads start immediately, matching the prior read-start semantics; native handles await getFile. Old errors are consumed without changing new status. Failed acceptance never changes model/handle pairing. A post-acceptance presentation failure remains an accepted document, not a rollback.

No changes to VE numerical calculations, Working VE/review/pins/history, evidence toggle, timeline or full-log caches are included. Only MSQ bytes are decoded; no MLG passes are added. The original file remains untouched.

## Regression validation

Unit tests cover true Latin-1 (including bytes Windows-1252 would remap), UTF-8 Unicode/BOM, strict failures, unsupported declarations and a document-sized source without unbounded spreads. Browser tests exercise retained model/handle/metadata, cancellation, denied/read/parse failure, stale byte reads, stale getFile, older choosers, immediate obsolete rejection and cancellation during another load. The existing transactional MSQ replacement suite now supplies bytes instead of fake text-only files; all original authority/cache assertions remain.

Production-bundle validation additionally loads both real supplied MSQs through native file input and compares every one of their1024 semantic VE values, preserving hundredths despite digits1. Controlled picker responses under native Load clicks exercise the actual production wiring, retained-handle status, cancellation, denial and disabled Save. These controlled responses do not prove Brave's desktop chooser or future write permission UI; manual Brave selection remains required. Original user files are read only.

Exact results, screenshots, SHA256SUMS and handoff: `/workspace/epicscope-msq-checkpoint1/`. Earlier failed-run artifacts are retained. No existing assertion is skipped, no timeout relaxed and no global listener/observer/instrumentation is added.

## Stop and next checkpoints

Stop after validation and local commit. No push, merge, deployment change or checkpoint2 implementation is authorized by this checkpoint request. The earlier interaction follow-up commit also remains local until explicitly published.

Checkpoint2: document-preserving VE-only writer using Working VE authority and exact tune/page/entry identity, precision/blank/range policies and numerical reference tests. Checkpoint3: explicit overwrite transaction, permission/conflict/readback handling and activation checks for TunerStudio external changes. Decide saved-versus-session baseline behavior there; do not mutate the active model in place merely to mark loading or saving complete.

Final gates: build/typecheck passed;964 unit tests/139files passed;1,420 Chromium checks/158 result groups passed (710 per mode);44 built-production checks passed. Both supplied MSQs were loaded in each mode and all1024 semantic VE values per file matched the source exactly. Production picker bridging, cancellation, denied selection, read-only capability feedback and disabled Save passed. Existing UI screenshots were inspected. Initial full-run failure exposed an added async boundary before file-input reads in the controlled stale-rejection fixture; direct File reads now start synchronously and a dedicated immediate-supersession rejection regression passes with no unhandled browser exceptions. Existing bundle-size warning remains. No large-MLG/hardware timings or actual Brave desktop picker/write-permission validation are claimed.
