# Idle Analyzer — standalone HTML integration workstream

**Branch:** `ui/idle-analyzer-html-integration`  
**Base:** EpicScope `main` at `702c880a29baa28b762ac26f7f7ed55ef01239ef` (2026-10-26)  
**Current scope:** First native recorded-data Stability slice, authorized after the completed readiness assessment; frozen standalone HTML remains the visual/behavioral reference.
**Explicit boundary:** Scoped native TypeScript/CSS integration and focused tests only; no standalone HTML changes, dependencies/framework, release workflows, firmware, ECU writes/Burn or merge to `main`.

## Current implementation checkpoint

[Native Base Airflow recorded context](NATIVE_AIRFLOW_UI_CHECKPOINT.md) enables the second mode through retained traces, scope and qualification, with per-role coverage and descriptive assessment.

[Base Airflow core foundation](NATIVE_AIRFLOW_CORE_CHECKPOINT.md) adds tested aligned logged-request aggregates. Its initially disabled native UI is now integrated in the later checkpoint above.

[Fixture/contract closure checkpoint](NATIVE_CONTRACT_CHECKPOINT.md) inventories current coverage, adds canonical parser-to-Stability regressions and freezes remaining mode prerequisites without changing production behavior.

[Stage completion status](NATIVE_STAGE_STATUS.md) tracks the original seven integration stages and remaining closure work.

[Declared region purposes](NATIVE_PURPOSE_CHECKPOINT.md) adds the five reference test intents, conservative mixed-purpose interpretation and purpose-aware Stability guidance without changing measured values or qualification.

[Managed-region split and merge](NATIVE_REGION_PARTITION_CHECKPOINT.md) adds precise source-time partitions and compatible merges without changing the included sample union, qualification policy or source ownership.

[Selected region qualification](NATIVE_QUALIFICATION_CHECKPOINT.md) adds opt-in, unit-verified coolant and closed-input conditions, explicit manual bypass, source-valid evidence and matching discovery. Full firmware idle qualification remains unestablished.

[Descriptive Stability findings and next tests](NATIVE_STABILITY_FINDINGS_CHECKPOINT.md) projects accepted measurements into evidence-dependent observations, limitations and repeatable next-test guidance. Warm/closed-throttle idle qualification and tuning changes are not inferred.

[Scope authority and discovery feedback](NATIVE_SCOPE_FEEDBACK_CHECKPOINT.md) follows native action-based investigation: explicit metric scope/apply action, graph-focus explanation and visible, truthful candidate outcomes without changing union mathematics.

[Native region manager and combined analysis](NATIVE_REGION_MANAGER_CHECKPOINT.md) adds editable inclusion/exclusion, independent graph focus, source-time region markers and deduplicated union analysis, using existing Logger/source owners.

[Trace fidelity and recorded candidate regions](NATIVE_REGIONS_TRACE_CHECKPOINT.md) adds Logger-style dense/raw trace rendering, a smaller desktop axis margin, and an explicit RPM-only discovery → review → Logger A/B workflow. Full region management and qualification remain deferred.

[Stability layout and reuse checkpoint](NATIVE_STABILITY_PARITY_CHECKPOINT.md) follows the user's comparison with the accepted HTML: a compact native workspace, recorded controller context, canonical target-unit resolution, hover evidence and Logger-authoritative timeline gestures. EpicScope's existing header, theme, navigation and bottom interface remain shared. No standalone application chrome is copied.

[First native Stability vertical slice](NATIVE_STABILITY_CHECKPOINT.md) remains the historical foundation checkpoint. The readiness assessment below describes its pre-implementation baseline; the user's subsequent native-integration instructions superseded its documentation-only boundary. Stop for manual review of this workspace correction before implementing another diagnostic mode.

## Source files

- [Idle Analyzer v3.5.6 reference](Idle_Analyzer_v3_5_6_Reference.html) — accepted compact adaptive workspace, true October 20 embedded MLG evidence, secondary September 30 MLG import, corrected matching-interval finder and chronology warnings.
- [Idle Analyzer v3.5.7 — source navigation](Idle_Analyzer_v3_5_7_Source_Navigation.html) — preserved, offline HTML experiment. Adds two-source timeline navigation and source-labeled detected events without changing the v3.5.6 diagnosis/parser calculations.
- [Idle Analyzer v3.5.8 — A/B region navigation](Idle_Analyzer_v3_5_8_AB_Region_Navigation.html) — preserved experimental snapshot: A can create a real manual region at unmarked timeline positions (Alt+click forces one within existing ranges), and both timeline tracks support Home/End/arrow-key navigation. B manual interval selection and source identity remain preserved.
- [Idle Analyzer v3.5.9 — A/B refinement](Idle_Analyzer_v3_5_9_AB_Region_Refinement.html) — preserved manual A/B movement and keyboard refinement.
- [Idle Analyzer v3.5.10 — comparison session](Idle_Analyzer_v3_5_10_Comparison_Session.html) — **latest experimental snapshot**: sampled-fingerprint-bound, local-only restoration of imported B selection after re-import. A sampled match is not proof of identical file bytes.
- [Previous functional maturity audit](READINESS_AUDIT_v3_5_6.md) — historical status and integration cautions.

The HTML files are **preserved versioned standalone snapshots**. The user has now authorized the bounded native Stability slice. Additional modes, broad optimization or main integration require subsequent review.

## v3.5.7 changes and observations

1. Compare mode replaces the ordinary single timeline visualization with **A/B source timelines**, each in its own original recording time domain. File identity and relative scale are displayed separately. The main plot still uses normalized relative display time according to the chosen alignment.
2. Clicking within a **second-recording timeline** selects a same-duration **manual B interval** centered on the clicked source time; the A reference remains untouched. Clicking A selects an already defined reference region. Both selections remain user-reviewable; neither implies a tuning improvement.
3. **Detected events & operating windows** displays A/B source-labeled region cards and up to five detected sag events per source. Clicking a card zooms the **shared plot viewport** to the corresponding time. The zoom remains display-only; the actual analysis windows are unchanged by zoom.
4. If the second MLG is unavailable after reopening the standalone file, the second-source timeline identifies that state and offers **Compare sources**. There is no stale or synthetic comparison evidence.
5. The previous automatic comparative candidate-region finder, chrono warnings, graph zoom and peak-preserving rendering remain present.

**Validated in browser (2026-10-26):**
- Chromium with HTML content loaded into an isolated page; no JS errors during same-recording comparison and event-click-to-zoom.
- Full independent `2026-09-30_12.09.28.mlg` imported successfully, revealing nine auto windows; two source timelines rendered correctly.
- Clicking B source at 93% of the track moved B selection to 733.39–745.79 seconds, retaining the original A baseline.
- 390 px width: no document-level horizontal overflow during the same two-log comparison.

**Important:** This is interaction testing, not mathematical approval of every diagnostic mode, user-configurable watch threshold, or derived conclusion. The file still includes independently implemented MLG parsing and illustrative tuning content that must **not** become production authority.

## Complete integration-readiness pass (2026-10-26)

Audited prototype commit: `1717d28305b52a921db09141de37aca5d02e462e`; production baseline remains main `702c880a29baa28b762ac26f7f7ed55ef01239ef`.

- [Integration-readiness audit](INTEGRATION_READINESS_AUDIT.md) — evidence, confirmed defects, numerical reference cases, priorities and validation limits.
- [Functional coverage matrix](FUNCTIONAL_COVERAGE_MATRIX.md) — all major modes, controls, function families and workflows classified; tested versus source-reviewed behavior identified.
- [Source-authority reconciliation](SOURCE_AUTHORITY_RECONCILIATION.md) — actual production owners, reuse decisions and proposed source/quality/role/selection/comparison/provenance/result/graph/persistence contracts.
- [Integration implementation plan](INTEGRATION_IMPLEMENTATION_PLAN.md) — seven bounded stages with regression requirements, blockers and review stops.

**Assessment:** suitable for a staged native integration specification, not a direct production port or analytical sign-off. Preserve the accepted interface and use current production authority. No new HTML version was needed; all five snapshots remain unchanged. No production/test/dependency/workflow change or main merge was made.

Fresh isolated Chromium checks covered all eight modes and their three assessment tabs, A/B source navigation, independent-source prefix import, session refusal/matching/mismatching re-import, settings/panels, read-only tune references, Help, plan round-trip and desktop/narrow rendering. A 2,000-record real October25 prefix agrees with production on 1,995 trusted samples, but production also retains/classifies five recovered retries. Existing relevant production tests: **36 passed across five files**. These results do not establish a full-size B performance baseline or causal tuning improvement.

Confirmed blockers include stale replacement completion, destructive failed B replacement, missing-role percentages appearing as zero, unused Stationary/Fan/minimum-evidence settings in the real path, duplicate events across overlapping regions, inconsistent retained/live result invalidation, moved built-in A bounds lost on reload, non-round-trippable plans, and a 320,001-sample metric spread failure. Mathematical contracts also differ from production for σ, DC error sign and recovery timing. See the audit for precise paths and distinctions.

Healthy behavior to retain: missing B blocks evidence; raw imported logs are not persisted in localStorage; matching/mismatching sampled fingerprints govern B interval restoration; source axes remain independent; normalized graphs are explicitly shape-only; interval suggestions are ranked by operating conditions rather than favorable RMSE; fixture tables and Logger placeholder are clearly labeled.

## Readiness recommendation at the assessment checkpoint (historical)

Review and authorize **implementation Stage1: source fixtures and numerical contracts** separately. Continue one bounded stage at a time with local commit/handoff and review stops. Reuse canonical parser/workers/data sources, existing Idle/DC analysis, role resolution, Logger callbacks and persistence patterns. Correct most remaining prototype faults once at native owners rather than creating another standalone parser/state system or polishing additional illustrative features.

Original September30 MLG, exact October MSQ/INI/firmware provenance, full-scale independent B replay and manual native acceptance remain open. t63/frequency/gain recommendations may stay visibly unavailable. No Idle ECU write/Burn work is included. Stop after this readiness pass; do not merge this experimental branch because browser checks pass.

## Historical local acceptance suggestion (v3.5.7)

In v3.5.7, open **Compare → Operating conditions** to see independent A/B event cards. Then use **Compare → Before / after tuning** and import September 30. Try clicking the imported B timeline: the B interval should move, the blue reference trace should stay on October 20, and the comparison assessment should remain cautious about calibration provenance.

## v3.5.8 development checkpoint (2026-10-26)

- Built from the exact v3.5.7 Git blob SHA `a57452448e25eff1b42561440bae2b8f134ca93b` on this branch. The accepted display and core calculations have not deliberately been changed.
- A timeline clicking empty space creates an actual manual reference region based on the selected interval duration; Alt+click forces manual A creation. B's imported-source interval is independently movable, retaining its own duration where already manual.
- Timeline keyboard controls: Left/Right move by a quarter of the selected window, Home/End move to source boundaries, Enter/Space select the current center. A's new reference selection is persisted through the existing real-source preference path.
- This is **source-level verification only**. Browser interaction, numeric diagnostics and responsive UI checks remain **pending** for v3.5.8. Do not merge, port to production or represent the new snapshot as accepted until tested.
- Next: browser-test both modes with the September 30 recording, check A/B independence, re-open restore, event navigation, keyboard access, and 390px responsiveness. Then advance source/channel authority, comparison-session persistence and incomplete placeholders.

## v3.5.9 follow-up checkpoint (2026-10-26)

- v3.5.8 static inspection exposed two interaction defects: arrow-key movement in A could merely reselect the old region or multiply manual regions; manual B placement within an existing same-source region could silently select the region rather than move a manual interval.
- New v3.5.9 uses editable manual intervals, keeps A and B independent, and retains each recording's original time axis. Directional keyboard movement explicitly requests interval repositioning.
- This change only touches the HTML reference snapshot and README, not production application code.
- **Validation gate remains open:** no automated Chromium/Playwright access or local copy of the real September 30 MLG was available in this session; source inspection and GitHub commit verification are not substitutes for real-log browser replay. Test A/B region motion, compare modal syncing, restore after re-open, chronology warnings, keyboard focus, and 390px layout before declaring accepted.
- The next data-contract work should preserve missing-source refusal, sample validity, source identity and explicit non-improvement classification without importing prototype MLG parser logic into production.

## v3.5.10 checkpoint (2026-10-26)

- User manually reported v3.5.9 behaving as before; treated as permission to progress, not as comprehensive mathematical/browser validation.
- Comparison session saves reference identity, second-source sampled fingerprint/name, baseline region ID, candidate ID or bounded manual start/end/purpose, graph alignment and trace selection. The MLG bytes are **not** stored.
- On re-import, restored B selection is only eligible if the sampled fingerprint agrees; mismatched recordings use the normal selection path and explicitly identify the mismatch. The re-import remains a required user action.
- File fingerprints sample three bounded segments and do not constitute cryptographic proof of full-byte equality; do not treat source identity as ECU tune provenance.
- Manual restore is in-memory until the source is re-imported. The UI remains intentionally read-only. No production code or ECU write boundary changed.
- **Validation pending:** actual Chromium import/reopen replay, matching and mismatching recording tests, A/B modal/state synchronization, mode-switch persistence, and responsive layout checks.

## Validation status after the readiness pass

The earlier v3.5.8–10 “pending” notes above are historical checkpoints. The latest v3.5.10 navigation, matching/mismatching B re-import, missing-source refusal and narrow-layout behavior now have bounded Chromium evidence recorded in the new audit. This does not retroactively validate every old snapshot or the unavailable original September recording. The audit explicitly lists remaining source, analytical, accessibility and full-log gates; it also records defects found by the new checks.
