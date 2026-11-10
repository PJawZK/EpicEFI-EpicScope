# EpicScope — current handoff

Updated 2026-11-10 (development continuation added; production baseline below remains historical). This is the **current continuation index**, not an independent runtime specification. Full prior handoff content was preserved in [the October archive](handoffs/ARCHIVE_THROUGH_2026-10-26.md).

## Authority and change safety

**The code at current `main` takes priority over documentation**, including this file, older source-code branches, proposals, reference HTML, and local/unpublished reports. Verify the actual implementation before interpreting a feature as present or absent. When documents disagree with code, record the discrepancy and update documentation; do **not** modify working runtime code merely to conform to stale documentation. A proposed code correction requires independent reproduction, justification and explicit scope.

Documentation-only maintenance must not alter application source, package dependencies, build/deploy workflows, tests, data, storage, parsing or ECU behavior. Keep known gaps as evidence/policy questions, not unverified bug claims. Historic branches and checkpoint instructions are not continuation authority.

## Active visible-gap / marker reconciliation — 2026-11-10

The [reconciliation checkpoint](LOGGER_GAP_RECONCILIATION_CHECKPOINT.md) continues from `f3ea5ab8c551db730c539be0470febe823dc791d`. Source replay proves the 14.52328→14.58326 s gap was a renderer threshold left active after cadence warnings became Diagnostics-only. Raw/dense now connect valid neighbors on spacing evidence alone. All 19 remaining default-channel boundaries match 18 clock-run ambiguities plus CRC record 19; the committed ledger lists each. Clock icons anchor at the actual new-run boundary; source-backed CRC/NaN notices remain inspectable inside narrow unavailable intervals; isolated NaNs receive blue information. Original observations/analysis remain unchanged. Stored Time values corroborate the local spacing but have not been fully reconciled as independent clock authority. Latest presentation remains pending manual acceptance; Idle stays paused, no main merge.

## Active independent timestamp/false-positive audit — 2026-11-10

The [independent follow-up](MLG_TIMESTAMP_FALSE_POSITIVE_AUDIT_2026-11-10.md) supersedes treating heuristic cadence candidates as graphical source-discontinuity warnings. All three full recordings received raw header/payload-checksum and counter/retry checks, plus 9,000 event-neighborhood rendering/membership cases. Committed compressed ledgers preserve baseline findings. Clock reconstruction remains ambiguous: no independent reader/specification authority was available, and timestamps were not rewritten. The targeted correction retains cadence candidates as informational Diagnostics observations at the existing source owner; CRC/clock markers, numerical analysis and rendering are preserved. Latest CHDL presentation remains unaccepted; stop for manual review, no main merge. See the report for evidence-dependency limits and pending established-reader comparison.

## Active CHDL Logger gap — 2026-11-10

The [CHDL gap checkpoint](CHDL_LOGGER_GAP_CHECKPOINT.md) continues from `0f040a84cdf88b115bbe72d4442de372ac7bb12b`. The complete 69,566-record upload reproduces a false raw-rendering break after the canonical 49→50 clock regression. Rendering now uses preceding source-run cadence only. Canonical timestamps, finite RPM/MAP/TPS/CLT observations, source-index membership and CRC/retry behavior remain unchanged. One post-CRC source projection supplies amber clock/spacing evidence; existing red integrity remains separate; already-loaded CRC-valid channel NaN runs can receive blue channel-specific information. See the checkpoint for raw clock-wrap ambiguity, physical source evidence, validation and manual acceptance. No merge; Idle work remains paused.

## Active nonmonotonic timestamp correctness — 2026-11-09

The [nonmonotonic query checkpoint](NONMONOTONIC_TIMESTAMP_QUERY_CHECKPOINT.md) completes the audited correction from `f02a5b4b38e016953ac94b94c6c89f8db9515fb4`. Original October regressions 40,913 / 41,685 / 91,924 reproduced missing narrow-region samples and now return exact source-order membership. Cached source-run queries plus a many-run auxiliary lookup permutation preserve canonical arrays and prevent repeated full timestamp scans. Source fetch/slice APIs return covers, not compacted/renumbered samples. Cursor ties choose earliest original identity; temporal interpolation uses an explicit original run anchor; unsafe legacy cross-run temporal events report unavailable instead of guessing. AFR/Boost histories stop/reset at backwards boundaries. Accepted Logger layout/zoom/pan behavior passes regressions and native replay. See the report for numerical changes, memory/performance, broad-cover I/O limits and manual acceptance requirements. No push/main merge; Idle development remains paused.

## Active Logger trace/navigation presentation — 2026-11-05

Checkpoint `f02a5b4b38e016953ac94b94c6c89f8db9515fb4` was pushed and passed manual user acceptance before the November 9 query task. That accepted visual/navigation baseline is preserved; the new review gate concerns timestamp-query correctness.

The [Logger trace/navigation checkpoint](LOGGER_TRACE_NAVIGATION_CHECKPOINT.md) records the bounded follow-up from `91b5ef31ed758b5dcf249734c78ffe627483a521`: replace pixel-distance trace breaks with recorded continuity, use bounded source-local cadence instead of visible-window cadence, and reserve stable Cursor/Visible/elapsed readout widths so changing time values do not move controls. Existing graph cache retains continuity flags; CRC/retry/source validity and numerical behavior are unchanged. Real-browser geometry/canvas checks and production November-file replay preserve genuine CRC, cadence and Hybrid NaN gaps. Review the checkpoint's partial-range/subpixel limitations and validate the user's exact EpicScope channel/zoom case. No push/main merge; Idle work remains paused.

## Active MLG integrity audit — 2026-11-03

The [focused Hybrid-channel investigation](MLG_NOV01_HYBRID_AVAILABILITY_AUDIT.md) continues from `8574f85f1eca22090886d2334046044501a32257`. The six Hybrid channels have identical seven-run NaN masks: 88,981 nonfinite CRC-valid / 4,535 finite / 243 CRC-excluded attempts each. NaNs match Hybrid validity/cache flags being zero exactly; selected/candidate corrections equal the finite legacy correction throughout. The dominant observed interval is 83,623.95–1,431,168.19 ms, indices 5,379–92,560. Raw stored F32 `7fc00000` is confirmed; matching firmware/reason enums are unavailable, so exact upstream cause remains unproven. The reproduced fallback missing-CRC-count status is corrected through the existing app-shell owner shared with staged completion; parsing, source validity, CRC/retry, numerical and marker behavior are unchanged. Per-channel availability UI remains a proposal for review. See the [reconstruction/source-wide audit](MLG_NOV01_RECORDING_AUDIT.md) for original-file identity. The separate October timestamp-regression/binary-lookup issue is not this recording's demonstrated cause. Idle/VE work stays paused; stop for review, no main merge.

## Active development continuation — 2026-11-03

On `ui/idle-analyzer-html-integration`, the [Logger layout/starter checkpoint](LOGGER_LAYOUT_STARTERS_CHECKPOINT.md) records the current bounded task: six source-resolved starter groups, four-channel defaults, preserved saved/eight-channel workspaces, shared centered/corner presentation, rows-first new Freeform layouts and bounded narrow resizing. This is a **local branch checkpoint**, not a change to the production baseline below. Stop for manual UI acceptance; no main merge or automatic Idle continuation. Existing saved assignments opt in through **Layout → Reset starter channels**. Idle stage status remains as documented in [the native stage index](reference/idle-analyzer/NATIVE_STAGE_STATUS.md).

## Production baseline

- Repository: `PJawZK/EpicEFI-EpicScope`; production branch: `main`.
- Latest **runtime checkpoint verified before this documentation-only refresh**: `f6bdbf78643754d1bf3398980bcad3583201fef9` (PR #467, incomplete MLG tail and worker-error fix, 2026-10-26). Check `main` HEAD again before work; documentation commits after this checkpoint do not themselves validate runtime changes.
- GitHub Pages: https://pjawzk.github.io/EpicEFI-EpicScope/ ; workflow builds the current `main` checkout, not the older hard-pinned VE preview.
- At checkpoint `f6bdbf7`: hosted Web CI and Pages deployment both succeeded. Reported final validation: 1,010 unit tests, 1,463 browser checks, 55 production checks. These counts are checkpoint evidence, not a fresh run after documentation edits.
- PR #466 incorporated reviewed VE v50 and MSQ work; PR #467 incorporated MLG incomplete-tail recovery. Older PR #462 remains historical origin for earlier Analyzer correctness work.
- Browser acceptance on user machines is separate from automated CI, even when CI is green. No automatic ECU/Shim write or Burn.

## Current implemented areas and boundaries

**Logger / MLG:** Recorded MLG v1/v2, source integrity, navigation, scoped ranges, workspaces, and validated staged-worker/fallback importing. The import adapters can retain a structurally complete record prefix when a recognized final block is incomplete, with explicit warning; strict general scanner remains default. The unchanged verified log of 1,102,856,192 bytes yields 159,022 complete records, retains 28 unrecovered CRC exclusions and excludes its incomplete final block. "Ready" with a warning is expected; do not equate retained records with valid/trusted samples. See [recovery contract](MLG_INCOMPLETE_TAIL_RECOVERY.md). MLG v3 remains research, not supported production behavior.

**VE Analyzer:** v50 workbench, original/generated/working values, Result View and structured Cell Evidence, pin-protected proposals, numeric interpolation/strength behavior, Lambda Delay discovery and explicit use, and Logger-owned Full Log/A–B/saved range integration are incorporated. Source tune, generated suggestion and user review edits remain distinct. Confirm detailed numerical policies in the current core/analysis and VE owners, not frozen standalone prototype code. Older October 18 gap inventories are historical and may not describe the integrated runtime.

**MSQ:** Current implementation includes reviewed same-file Save and access-only attachment workflow subject to native browser capability and file permissions. Validate current app code and `docs/VE_V50_MAIN_INTEGRATION.md` before claiming availability or safe concurrent editing. Manual Brave native permission and TunerStudio reopening are still acceptance work; the browser does not provide an atomic file lock against an external editor.

**Other analyzers:** Fueling and non-knock Ignition are comparatively mature experimental checkpoints; Boost strong experimental; Idle, AE/MAP Predict, Fuel Pressure/Injector and Trigger/Sync have targeted maturity opportunities. Histogram has Table Generator, Distribution, Scatter and Math foundations. These status descriptions are not proof of all real-world diagnostic quality.

**Diagnostics / observability:** The unified bounded local observability system and diagnostics/report projections have substantial implemented work. The older "D-058 not started" wording in roadmap/research materials is stale. Confirm installed owner/persistence/report behavior from code and `OBSERVABILITY.md`, and distinguish implemented capabilities from optional unstarted baseline intelligence and outstanding hardware acceptance.

**Live path:** Existing read-only `ts_shim` telemetry with Pi Zero 2 W/Mega144H7 validation; it is not an authorization for live ECU changes. Linux production app and later Android/EpicHub reuse remain future stages.

## Acceptance and priorities

[Pass D technical acceptance matrix and evidence-based priorities](TECHNICAL_ACCEPTANCE_AND_PRIORITIES_2026-10-26.md) separates real-file acceptance, reproducible defects, numerical policy decisions and future product scope. It does not authorize runtime changes or declare acceptance complete.

## Open findings / explicit acceptance work

1. User-machine acceptance of original large MLG, performance, memory, responsiveness, diagnostics export and Logger/Analyzer/Histogram round trip. The exact-file import was tested, but no universal hardware performance claim follows.
2. Brave native MSQ permission and same-file Save/reopen with TunerStudio; preserve source file integrity, reviewed working state and external concurrent-edit limitations.
3. Recheck the formerly reported VE dropdown-closes-on-click behavior in the user's browser; the previous correction effort could not reproduce it. Do not claim fixed or broken without a reproduction.
4. Verify Brush smoothness on real 32×32 tables, custom completion dialog background pointer/accessibility behavior and real display scaling.
5. Explicit VE numerical policy review: exclusion time authority (B02), OLS stability/timestamp gaps (R28/R29), and single-refinement Lambda Delay. These are **policy/validation questions**, not established numerical regressions.
6. Documentation mismatch: several current-facing docs still contain October 16/18 status snapshots. Pass A refreshes this handoff, Documentation Map and README only. Subsystem and roadmap corrections belong to later Pass B after comparing with implementation.
7. Branch inventory and patch equivalence (13 remote branches at review, zero open PRs) belong to a separate governance pass. Do not delete historical divergent branches without a unique-commit audit.
8. Passive diagnostic/correction analyzers are documented as research/proposal only; no implementation authorization should be inferred.

## Safe continuation

1. For each proposed change, inspect current `main` owners and tests first, compare against current user-observed behavior, and add a reproducible finding before adjusting runtime code.
2. For docs, fix incorrect status/authority claims, keep history in the archive, and avoid turning plans into implementation facts.
3. Next documentation pass: reconcile [Roadmap](ROADMAP.md), [Product](PRODUCT.md), [VE Analyzer](VE_ANALYZER.md), [VE Workbench](VE_ANALYZER_WORKBENCH.md), [Analyzer](ANALYZER.md), [MLG plan](LOG_MLG_PLAN.md), [Observability](OBSERVABILITY.md) and [research status](research/STATUS.md) with current code.
4. Further engineering priorities require explicit selection; preferred near-term acceptance is the user's real MLG/MSQ workflow before new broad functionality.
5. Any runtime change requires focused tests, build/typecheck, staged/fallback browser checks and appropriate real-browser acceptance. No release decision may be inferred from docs-only edits.

## References

- [Documentation authority and maintenance](DOCUMENTATION_MAP.md)
- [Historical handoff archive](handoffs/ARCHIVE_THROUGH_2026-10-26.md)
- [VE v50 main integration evidence](VE_V50_MAIN_INTEGRATION.md)
- [VE v50 follow-up Group 2–6 files](VE_V50_FOLLOWUP_GROUP6_CELL_EVIDENCE.md)
- [MLG incomplete-tail recovery](MLG_INCOMPLETE_TAIL_RECOVERY.md)
- [Browser acceptance instructions](BROWSER_TESTS.md)
