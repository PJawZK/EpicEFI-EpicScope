# MSQ overwrite — checkpoint 3: explicit Save, transactions and external changes

Baseline: checkpoint 2 `724392756e08507de46c9ce4ba2dac7aad553ed4`. Save now overwrites the retained MSQ file handle on an explicit **Save MSQ** action. There is no Save As/download path, Shim write or Burn. No user-supplied MSQ is written by automated validation; native filesystem tests use disposable OPFS files and production UI tests use memory-backed file handles.

## User-visible behavior

Load the matching INI during this session, then load the MSQ through the supported native file picker. Save MSQ is available for committed Working VE, even without a log/run/delay table: manual edits and analysis-generated values have the same review owner. Only the selected VE table's values are written. Axes, other tables, metadata, comments, unknown XML and original encoding stay intact.

Save requests read/write permission directly under the Save click's user activation. Permission denial retains edits and allows an explicit retry. The status row shows preparation/writing/result/errors; rounding to INI storage steps is reported. The application does not claim that retaining a handle means permission has already been granted. File-input-only loads, unavailable Worker support, missing session INI metadata and firmware mismatch keep overwrite unavailable with a reason. Restored channel catalogs lack write metadata, so reload the matching INI after a browser reload.

Save's pointerdown preflight prevents clicking Save from implicitly blurring/committing or discarding an unfinished cell editor. Finish it explicitly with Enter/Tab or cancel with Escape first. Programmatic Save requests and active Brush strokes use the same existing edit-engine guard. Guard feedback is retained across readiness refreshes. No DOM text supplies numerical values.

Saving keeps the session's loaded reference, analysis, working values, pins and history intact. Raw working values can have higher precision than the firmware storage step; the file receives validated quantized values and the message reports rounded cells. Original/reference colors remain relative to the loaded tune until an explicit reload. Newer edits are not marked saved by an older completion. Repeated matching saves skip writing; restoring original values after a previous save writes them back correctly.

## Owners and integration

- `msq-save-session.ts` owns expected disk bytes, save/check status, conflict/uncertain flags and one active transaction. The existing MSQ loader owns the accepted model/document/handle. Loader acceptance is blocked while a save is active; pending loads disable Save. INI replacement/unload is also guarded. Loader disposal now invalidates late picker/read completions and releases source data.
- `AnalyzerPageController` provides explicit committed capture/currency and status/review-change bridges; the existing v2 review owner remains numerical authority. The shared table interaction controller exposes its pending-edit flag rather than a document scan. The run strip owns the Save/status/reload presentation.
- The shell wires explicit save/reload requests to the file transaction. Existing visibility/pageshow lifecycle hooks check for outside edits. One concrete window focus hook also detects returning from TunerStudio; it is removed at the shell's existing disposal boundary. In-flight checks are coalesced, skip hidden/busy states, and reject retired document completions. No polling, MutationObserver, global instrumentation or lifecycle wrapper was added.
- A cross-page, nonmodal notice reports outside changes even in Logger/Histogram, with Review and Dismiss. Dismiss hides only the notice; Save remains blocked. VE retains a conflict message and Reload action. Reload asks whether to keep working edits or reload/discard them; the existing transactional loader replaces tune/review only after the new file validates. A rejected reload retains the prior session.

## Save transaction

1. Capture the committed Working VE and exact tune/entry/axis/revision identities. Check cached INI policy and basic value validity before asking permission.
2. Request read/write permission synchronously from the explicit Save action. Compare actual file contents with the last accepted/readback-verified bytes.
3. Prepare and validate bytes in a dedicated worker. Check current owner/document/catalog generation after the async result. Never fall back to long synchronous preparation when workers are blocked.
4. Read/compare the file again. If bytes already match the plan, mark only the captured current revision saved without opening a writable stream.
5. Open a staging stream with `keepExistingData:false` and browser `mode:'exclusive'`; write the complete verified document. Check currency and compare the still-visible original file again immediately before close. Abort staging on a stale session or conflict.
6. Close to commit, then read back and compare every output byte. Only a verified completion advances expected disk contents. Close/readback failures have uncertain state, block another save and require reload. No automatic rollback can overwrite another application's changes.

The native file API has no compare-and-swap operation against external desktop applications. The final pre-close content check narrows the race but cannot eliminate an outside write occurring between that check and commit. Browser exclusive stream mode coordinates browser writers; it is not claimed to lock TunerStudio. Readback detects mismatched resulting content, but cannot prove no external edit was overwritten in that final race. This is a platform limit, not a CI guarantee.

Changes made while close is already committing cannot reliably cancel that commit. The captured values may have been written, but newer working/session changes are explicitly not marked saved. Source acceptance is locked during the transaction. Changing/hiding the VE owner before the commit guard cancels/rejects obsolete work.

## Preserving earlier saves and immutable analysis reference

Expected disk bytes are separate from the original session bytes. Worker preparation patches the last readback-verified disk base, remapping the captured table identities by their accepted entry positions. Earlier saves to another VE table therefore survive a later selected-table save. The session's original TuneModel is never mutated/replaced just to mark a save complete. Only explicit reload establishes a new loaded reference.

No-op decisions compare planned bytes with expected disk contents, not changed-cell counts relative to the original loaded tune. Tests cover saving changes, restoring the original VE, repeated no-ops, and saving a second VE table without reverting the first. Outside modifications are never silently merged into an old analysis/session.

## Responsiveness and XML validation

INI write metadata is parsed once at INI import, reusing existing tokenizers; only signatures and array-related definitions are retained, not the entire raw INI. Save resolves literal policy from this catalog without rescanning the 5.7 MB source. Conditional disagreement, unsupported formulas/types, bounds, signature and geometry checks remain conservative.

`msq-write.worker.ts` owns one requested preparation job; the client terminates it on completion, failure or abort. Input is structured-cloned without transferring/detaching accepted original bytes or the file handle. Only newly prepared output bytes are transferred back. Model/entry shared references survive the single clone graph. No log samples are copied and no log decoding, analysis or evidence computation is performed. MSQ byte decoding and validation remain part of preparation.

Dedicated workers do not provide DOMParser. The accepted XML is still validated using DOMParser when loaded. Preparation now uses the quote-aware full structural locator and semantic MSQ parser/normalizer in the worker; it rejects unsupported DTD/complex selected payloads, checks source coherence, substitutes ASCII numerical tokens only, then structurally and semantically reparses the result. This preserves well-formedness by construction from a validated original, rather than serializing arbitrary XML. Native DOMParser independently validates emitted XML in browser tests and reference readback tests. General accepted-import syntax limitations remain unchanged.

The prior 0.33–0.63 s preparation was cached-data CPU work, not file I/O. It is no longer executed on the UI thread during Save. Actual-worker reference tests match all 1024 TunerStudio values while a main-thread heartbeat advances. Source-worker elapsed timings include worker startup/dev-module loading and are not speedup or Brave/hardware benchmarks. Save's several filesystem reads are deliberate content conflict/readback checks (~0.77 MB each for the supplied file), separate from worker CPU and unrelated to MLG caches.

## Validation and manual acceptance

Automated tests cover unit transaction failures/stale state/permission/conflict/uncertain close, cache policy and numerical rules; real Chromium UI/draft guards and worker cancellation; native disposable filesystem stream commit/readback; and full built-production workflows. Production UI mocks permission/file handles to test trusted mouse gestures and the compiled worker without overwriting the uploaded user files. Actual Brave desktop file permission UI and TunerStudio reopening the overwritten file still require manual acceptance. The supplied MSQ/INI files remain external fixtures and are not committed.

Exact results, SHA, logs, screenshots, checksums and handoff: `/workspace/epicscope-msq-checkpoint3/`. Stop for manual UI acceptance after validation/local commit. No push, main merge or deployment-pin change is included. The large 1.2 GB MLG/hardware scenario was not rerun and no claim is made about it.

## Final automated results (2026-10-25)

- `npm run typecheck` and `npm run build`: passed. Build retains the existing large-chunk warning.
- `npm test`: 998 tests passed across 141 files.
- `npm run test:browser`: 1,438 checks passed across 162 staged/fallback groups, exit 0. Intentional observability error/recovery fixtures log errors as part of successful assertions.
- Built-production native-input/UI workflows: 49 checks passed, including compiled worker Save, pending-editor veto, exact original-value restoration, cross-page external-change notice and explicit reload confirmation. Final screenshots inspected.
- Focused supplied-file reference: all 1,024 values match the TunerStudio ALT file; unrelated bytes remain unchanged. Actual worker preparation advances the main-thread heartbeat; no timing speedup is claimed.

Local commit SHA is recorded after commit in the external `STATE.json` and `HANDOFF.md`; this document is included in that commit. No push or main merge. Manual Brave/TunerStudio acceptance remains pending.
