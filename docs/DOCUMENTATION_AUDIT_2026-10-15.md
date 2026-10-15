# Documentation reconciliation audit — 2026-10-15

> Historical audit record. Current authority remains `HANDOFF.md` + `DOCUMENTATION_MAP.md` + current `main`.

## Scope

Repository documentation was reviewed after the remote-branch cleanup and PR #449 VE rollback so present-tense documents no longer contradict the actual project state.

The audit specifically checked for:

- VE Analyzer still described as planned/not implemented;
- scalar/RPM-curve lambda-delay models incorrectly presented as current options;
- pre-rollback PR #445–#447 continuity/render work described as current runtime authority;
- stale Fuel / Injector vs VE development sequencing;
- starter-catalog tasks described as still open after close-out;
- historical `ts_shim` capture lifecycle described as current behavior;
- live acquisition described as future despite the real-ECU validated Shim path;
- branch cleanup described as incomplete;
- current and historical research/decision docs lacking an authority distinction;
- duplicate/unclear architecture, data-state and file-ownership descriptions.

## Updated present-tense authorities

The reconciliation updated or created:

- `README.md`
- `docs/HANDOFF.md`
- `docs/DOCUMENTATION_MAP.md`
- `docs/PRODUCT.md`
- `docs/ROADMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/FILE_ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/WORKFLOW.md`
- `docs/UI_REFERENCE.md`
- `docs/ANALYZER.md`
- `docs/FUELING_ANALYZER.md`
- `docs/HISTOGRAM.md`
- `docs/VE_ANALYZER.md`
- `docs/VE_ANALYZER_WORKBENCH.md`
- `docs/PREPOPULATED_WORKSPACES.md`
- `docs/STARTER_SYSTEM_VALIDATION.md`
- `docs/SPECIALIZED_WORKSPACE_COVERAGE.md`
- `docs/TS_SHIM_STATUS.md`
- `docs/BRANCH_CLEANUP_2026-10-15.md`
- `docs/research/README.md`
- `docs/research/STATUS.md`
- `docs/research/VE_ANALYZER_MLV_EMUPRO_IMPLEMENTATION_AUDIT.md`
- `docs/research/VE_ANALYZER_STATE_OWNERSHIP_AUDIT.md`
- `docs/decisions/README.md`
- `docs/decisions/2026-10-15-ve-runtime-and-delay-authority.md`

## Reviewed and retained without substantive rewrite

These were already aligned with their intended role or are deliberately stable technical/reference documents:

- `docs/PERFORMANCE.md`
- `docs/LOG_MLG_PLAN.md`
- `docs/TS_SHIM_INTEGRATION.md`
- `docs/TS_SHIM_DEVELOPMENT_PROXY.md`
- `docs/DECISIONS.md` through D-055 (later D-056/D-057 are indexed under `docs/decisions/`)
- `docs/WEB_BOOT_PLAN.md` — already explicitly historical bootstrap authority
- historical raw research:
  - `docs/research/MLV_BEHAVIORAL_RESEARCH.md`
  - `docs/research/MLV_VE_ANALYZE_WORKFLOW_PASS.md`
  - `docs/research/VE_AUTOTUNE_REFERENCE_RESEARCH.md`
  - `docs/research/MLG_V3_RESEARCH.md`
- dated 2026-10-14 decision records, retained as historical/refining decisions.

`docs/PLATFORMS.md` was lightly refreshed to replace “early development” wording with the current Web-reference/Linux-future/Android-later policy and to record VE browser acceptance requirements.

## Historical document corrected for supersession

`docs/SHIM7_CAPTURE_BINDING.md` previously read like current source behavior even though its explicit **Open Capture** lifecycle was superseded. It now clearly identifies itself as a historical SHIM-7 slice and points to `TS_SHIM_STATUS.md` / `TS_SHIM_INTEGRATION.md` for current behavior.

## Current locked facts after reconciliation

- `main` is the sole remote branch authority.
- Logger is a mature functional reference.
- generic Histogram research parity is closed for the approved scope.
- Fueling/non-knock Ignition are mature experimental checkpoints; Boost is strong.
- Fuel / Injector and Trigger / Sync retain targeted maturity gaps rather than being the primary active track.
- VE Analyzer is implemented, real-log/browser validated and is the highest-value active maturity target.
- browser-known-good VE runtime is the #441-era composition restored by PR #449.
- VE lambda-delay working model is **RPM × load table only**.
- Result View fallback/precision and Logger → Analyzer result/session persistence are the next VE defects to address before broader ownership refactoring.
- cell evidence is useful/field-tested but currently duplicates primary analysis and should later consume retained authoritative state.
- MLG v3 remains researched but not implemented.
- `ts_shim` read-only live/capture integration and source round-trip are implemented/real-ECU validated.
- starter catalog is closed at 12 generic + 12 capability-gated EpicEFI starters unless field evidence justifies reopening.
- Linux production implementation remains future work after Web maturity review.
- EpicScope never automatically writes/Burns a VE proposal to the ECU.

## Research/history preservation decision

The audit deliberately did **not** rewrite raw third-party research to make historical observations sound current. Research notes may still say that a capability was “planned” at the time of observation. `research/STATUS.md` and `DOCUMENTATION_MAP.md` now make the historical/current distinction explicit.

Likewise, old decision rationale remains available even when later decisions refine it.

## Maintenance rule

Future feature changes should update only the smallest affected authority set rather than copying a new current-state paragraph into every document. This is intended to prevent the documentation drift that this audit corrected.
