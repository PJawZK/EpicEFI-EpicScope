# Native Idle Analyzer — Stage 5, independent B ownership checkpoint

Branch: `ui/idle-analyzer-html-integration`. Parent: `f55687b0ca5a1bb9f57f01ceb8b173c8ee2c229f`. This bounded stage implements retained independent recording B, transactional replacement, source-specific bounds/roles and a read-only B Stability preview. Comparison calculations, comparison verdicts and plot alignment remain disabled. No push or main merge included.

## Working native boundary

The native toolbar's **Recording B** dialog loads a second MLG without replacing primary Logger or creating another Logger instance. B has its own canonical source identity, original time extent, amber range axis, RPM/target selectors, accepted range and preview result. No primary INI mapping, MSQ association, A–B selection or saved range is borrowed. Logger's A–B still means two bounds inside the primary recording.

The existing MLG adapters perform parsing/indexing, CRC/retry validation, channel decoding, workers and storage. A temporary worker candidate is not accepted at its indexed phase: `validated` must complete first. The fallback uses the existing canonical main-thread importer. Invalid source type, empty records or absent/nonfinite/reversed canonical extent rejects replacement; no default/fabricated range is created.

A valid accepted B remains authoritative while replacement prepares. Failed replacement preserves its object, selected range, roles and accepted preview. New accepted B resets its controls to that new source's actual extent/catalog. Hidden/cancelled/disposed or older replacement completions cannot overwrite a newer B. Primary replacement/navigation preserves accepted B; release affects B only. No raw recording, File object or result is stored in localStorage.

## Current owners and cancellation

- `idle-comparison-source.ts`: B-only import job and transactional generation/revision. Existing MLG importers are reused; no generic session/lifecycle framework.
- `idle-comparison-source-view.ts`: B dialog, range drafts/acceptance, source-local role selectors, range axis and retained preview. Invalid range drafts leave the prior accepted range intact.
- Existing Idle owner: parent activity/disposal and primary identity display. Existing Logger remains the sole owner of primary bytes, A–B/saved ranges and handoff callbacks.
- Existing `analyzeIdleStability`: B preview arithmetic on B's own original index grid. Exact target alignment and canonical validity remain authoritative; missing target gives unavailable target metrics. Preview is not idle qualification, discovery, comparative improvement or tune attribution.

Closing B or leaving Idle retires pending import/preview publication while preserving accepted B. Worker cancellation terminates that candidate worker. **Fallback parsing and channel reads have no physical abort API**: obsolete completion is rejected, but this checkpoint does not pretend that already-started I/O/CPU stops immediately. Existing bounded source prefetch can also finish after its candidate is retired. No new worker protocol/chunking is introduced. Pending previews are deduplicated and disabled until completion; unchanged accepted preview keys reuse their retained result. Real range/mapping/source changes withdraw stale preview authority. Source identity, request token, activity and dialog-open guards reject late preview publication.

Release/disposal drops retained source/result references, including the view's accepted-state alias. Garbage collection and existing cache eviction are separate lifetimes; immediate heap reclamation is not claimed. Shared persistent stores are not globally deleted, because primary or other accepted sources can still use them.

## Reproduced file-metadata cache collision and focused correction

Before finalizing source ownership, browser actions loaded two different valid B payloads with identical filename, byte size and modified time. The second payload's valid RPM values were increased by100. Expected mean changed from1020 to1120RPM, but the regression failed because reused cached payloads could still supply the previous recording. This was observed through the actual canonical importer/data-source path, not inferred from CI.

The shared staged and fallback import adapters now accept an optional explicit `LogSourceIdentity`. Existing callers retain their previous default behavior. B supplies a new opaque `idle-b:<UUID>` identity for each import lifetime and passes it through the existing worker/data-source/cache boundary. File metadata is not promoted to a content fingerprint. Both worker and fallback browser tests now produce1020 →1120 as expected.

This isolates B from primary/other-B cache payloads without clearing caches, bypassing CRC, disabling storage or changing global eviction policy. Within one accepted B, range/preview/channel cache reuse remains healthy. Cross-import disk/sidecar reuse for B is deliberately not assumed until defensible content/source-rebind policy exists. It can trade additional import/storage work for correctness. This checkpoint does not claim a general migration of existing primary-source identity policy; the optional adapter argument leaves those callers unchanged.

Pre-fix browser evidence is preserved at `/workspace/epicscope-idle-independent-b/metadata-collision-before-fix.json`. The corrected regression remains in the browser suite.

## Independent acceptance cases

Five focused owner tests cover pending/failed replacement retention, slow A → fast B → late A rejection even if physical cancellation cannot stop the old job, hide/release/disposal rejection, invalid canonical extents/empty sources, hidden import deferral and same-name independent source lifetimes. The transaction owner itself never reads numeric channels.

Worker/fallback browser checks cover canonical retry/CRC/wrap/tail handling, original-index preview, missing target, invalid B ranges, failed replacement, primary replacement, retained B after navigation, release, pending-preview deduplication, distinct-payload metadata collisions and390px dialog bounds. A generated seven-record source retains five valid/two invalid RPM records and σ130.38RPM. No invalid attempts are densely removed from the source grid.

The first combined shell replay also exposed an automation-selector collision: an existing broad primary `.mlg` input selector found the newly added B chooser. B's scoped chooser uses its own data attribute and binary MIME/MLG extension list; existing primary-prefix selectors continue to address the primary input. Production load buttons already use their own retained input owners. Final combined browser/production replay validates both entry points.

## Real supplied-file replay

Final production replay passed15 native action checkpoints with the private INI and canonical2,000-record prefix. A public navigation fixture exercised primary and B replacement separately.

| B selection | Valid / invalid RPM | Original selected indices | Mean RPM | Sample σ RPM | Target RMSE RPM |
| --- | ---: | --- | ---: | ---: | ---: |
| Full prefix0–25.365s | 1,995 /5 | 0–1,999 | 898.57 | 18.72 | 18.76 |
| Independent B15–20s | 434 /2 | 1,149–1,584 | 901.09 | 13.96 | 14.00 |

B uses its raw recorded `RPM [RPM]` and `Idle: Target RPM` roles. Invalid original attempts remain in the selected source grid, not densely removed. Primary remained on its own Full Log evidence while only B's range changed. Invalid B range and malformed replacement retained the accepted15–20s B range/preview. Replacing primary with `navigation.mlg` retained B's prefix and scoped facts. Successfully replacing B reset only B's extent; releasing B left primary unchanged. Reloading B restored the real prefix as a new lifetime, not a persisted identity guess. Native screenshots at1680px and390px show the independent amber axis and one shared header/footer, with no page overflow or browser exceptions. Private bytes are not committed. Source comparisons are not inferred merely because both slots can load the same filename.

Import cost still includes actual indexing/CRC I/O and decoding, even when another slot has loaded a file with similar metadata. B preview uses existing batch channel reads (scoped by canonical sample range where available), then selected Stability calculation. Repeated unchanged preview returns retained facts; this distinction is not a claim that every logical read performs physical file I/O. Large-scale performance, full1GB/hardware behavior, fallback responsiveness and retained-heap profiling remain unverified here.

## Validation

- Focused transactional owner tests: 5 passed.
- Full unit suite: 1,132 tests /157 files passed.
- Targeted staged/fallback browser suite: 284 checks /14 groups passed after metadata-identity correction.
- Production build: passed, with existing >500kB bundle advisory.
- Native production replay:15 action checkpoints passed.
- Full browser gate: 1,635 checks /168 result groups passed in staged and fallback configurations.

Artifacts: `/workspace/epicscope-idle-independent-b/`; logs: `/workspace/epicscope-idle-independent-b-*.log`.

## Remaining stage boundary

This is **Stage5 foundation**, not completed comparison or full HTML parity. Next is comparison contract/core preparation: source-local selected regions/qualification, explicit baseline/candidate authority, conditions and missing-role comparability, descriptive differences, then real elapsed/normalized/event display transforms. Do not produce an improvement verdict, event alignment or timing/firmware association from the current B preview. B region collections/suggestions, comparison tune references/diffs and versioned session source rebinding remain later work.

[Stage status](NATIVE_STAGE_STATUS.md) and [parity inventory](NATIVE_PARITY_INVENTORY.md) preserve the open scope. Persistence/plans, justified layout refinement, shared help/tutorial and final manual/hardware acceptance remain open. Stop for review; no automatic next stage or main merge.
