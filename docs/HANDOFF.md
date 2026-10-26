# EpicScope — current handoff

Updated 2026-10-26. This is the **current continuation index**, not an independent runtime specification. Full prior handoff content was preserved in [the October archive](handoffs/ARCHIVE_THROUGH_2026-10-26.md).

## Authority and change safety

**The code at current `main` takes priority over documentation**, including this file, older source-code branches, proposals, reference HTML, and local/unpublished reports. Verify the actual implementation before interpreting a feature as present or absent. When documents disagree with code, record the discrepancy and update documentation; do **not** modify working runtime code merely to conform to stale documentation. A proposed code correction requires independent reproduction, justification and explicit scope.

Documentation-only maintenance must not alter application source, package dependencies, build/deploy workflows, tests, data, storage, parsing or ECU behavior. Keep known gaps as evidence/policy questions, not unverified bug claims. Historic branches and checkpoint instructions are not continuation authority.

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
