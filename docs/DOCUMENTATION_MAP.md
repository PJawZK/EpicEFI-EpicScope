# EpicScope documentation authority map

Date: 2026-10-15

This file defines how repository documentation should be interpreted so historical plans/research do not override current product state.

## Present-tense authority

Use these documents for current project state and continuation:

1. `HANDOFF.md` — present-tense continuation authority.
2. current `main` implementation and current browser/runtime evidence.
3. `PRODUCT.md` — current product contract.
4. `ROADMAP.md` — current sequencing and phase status.
5. `ANALYZER.md`, `HISTOGRAM.md`, `VE_ANALYZER.md`, `VE_ANALYZER_WORKBENCH.md`, `PREPOPULATED_WORKSPACES.md`, `TS_SHIM_STATUS.md`, `LOG_MLG_PLAN.md` — subsystem authorities.
6. `OBSERVABILITY.md` — approved diagnostics/performance/report consolidation architecture and implementation plan.
7. `research/STATUS.md` — living mapping from preserved external research to current EpicScope implementation state.
8. approved architectural/product decisions in `DECISIONS.md` and accepted later decision records under `decisions/`.

If two current-facing documents disagree, `HANDOFF.md` and the actual current `main` runtime win until the contradiction is corrected. An explicit later accepted decision may refine an older decision while preserving the older record for traceability.

## Historical/reference documents

The following classes intentionally preserve older observations or design stages and are not present-tense implementation authorities by themselves:

- `research/MLV_BEHAVIORAL_RESEARCH.md`
- `research/MLV_VE_ANALYZE_WORKFLOW_PASS.md`
- `research/VE_AUTOTUNE_REFERENCE_RESEARCH.md`
- `research/MLG_V3_RESEARCH.md`
- dated implementation/audit notes under `research/`
- superseded/historical dated decision records under `decisions/`
- `WEB_BOOT_PLAN.md`
- `SHIM7_CAPTURE_BINDING.md`
- superseded/historical sections inside `DECISIONS.md`
- `BRANCH_CLEANUP_2026-10-15.md`
- `DOCUMENTATION_AUDIT_2026-10-15.md`

Historical documents may correctly use wording such as “planned”, “not yet implemented” or describe an older architecture because that was true at the time. Do not edit those observations merely to make them read like current state. Instead, keep current disposition in `research/STATUS.md`, the relevant subsystem authority, `HANDOFF.md`, or an explicit later decision.

## Current accepted post-D-055 decisions

`decisions/2026-10-15-ve-runtime-and-delay-authority.md` records:

- **D-056** — VE lambda-delay working model is **RPM × load table only**; scalar/single and RPM-curve modes are historical/rejected options unless a new decision explicitly reopens them.
- **D-057** — VE lifecycle/render/state/input changes require browser acceptance evidence in addition to normal automated CI, and structural work proceeds one change at a time from the PR #449 browser-known-good boundary.

`decisions/2026-10-15-unified-observability-authority.md` records:

- **D-058** — diagnostics, performance history, runtime errors and report assembly converge on one versioned, bounded observability/session architecture. Existing useful probes stay in their natural owners, reports become projections over the shared record stream, and redundant collectors/builders are removed after migration parity.

These are current accepted decisions even though they are stored in dated decision records rather than duplicated into the older monolithic decision log. `decisions/README.md` indexes dated decision records and their current/historical disposition.

## Current project snapshot

As of 2026-10-15:

- remote branch authority is `main` only;
- Logger is a mature functional reference;
- generic Histogram research parity is closed for the approved scope;
- Fueling and non-knock Ignition are mature experimental Analyzer checkpoints;
- Boost is a strong experimental foundation;
- Fuel / Injector and Trigger / Sync retain targeted maturity gaps;
- VE Analyzer is implemented, real-log/browser validated and is the highest-value active maturity target;
- PR #449 restored VE runtime to the browser-known-good #441-era composition after later continuity/render wrappers froze Analyzer entry;
- MLG v3 remains researched but not implemented;
- a unified bounded observability architecture is approved but not yet implemented;
- Linux remains a future production implementation after Web maturity/cleanup.

## VE Analyzer authority rules

- `VE_ANALYZER.md` is the current algorithm/evidence/product contract.
- `VE_ANALYZER_WORKBENCH.md` is the current UI/workflow contract.
- `research/VE_ANALYZER_STATE_OWNERSHIP_AUDIT.md` records architectural debt discovered around PRs #442–#447 plus the PR #449 rollback disposition; it is supporting audit evidence, not a replacement product spec.
- browser behavior is acceptance authority for VE runtime changes; green CI alone is insufficient.
- the accepted lambda-delay working model is **RPM × load table only**. Scalar and RPM-curve modes are historical/rejected options and must not be reintroduced as current product direction.
- original VE, analysis evidence/proposal, and user-reviewed/application state remain distinct.
- EpicScope must never automatically write/Burn VE changes to the ECU.

## Observability authority rules

- `OBSERVABILITY.md` defines the target architecture, migration inventory, bounded retention policy and staged implementation plan.
- D-058 is the durable project-wide decision authorizing this consolidation.
- current performance/parser/bug-report components remain implementation reality until migrated; the new docs do not imply code has already moved.
- domain/source evidence remains authoritative in its current owner; observability records and correlates it rather than replacing it.
- no silent telemetry/upload or unbounded diagnostic history is authorized.

## Research preservation rule

External-tool research remains evidence, not implementation authority. MegaLogViewer, ECUMaster EMU PRO and TunerStudio can inform mature behavior, edge cases and regression expectations, but EpicScope should not copy proprietary implementation/architecture.

When implementation moves beyond a research note:

1. keep the historical observation intact;
2. update `research/STATUS.md`;
3. update the relevant current subsystem contract if product behavior changed;
4. add/refine an architectural decision when the change is a durable project invariant.

## Documentation maintenance rule

A feature change is not complete when only code changes. Update the smallest authoritative set that is affected:

- `HANDOFF.md` for continuation state;
- `ROADMAP.md` if sequencing/status changed;
- `PRODUCT.md` if user-visible product contract changed;
- subsystem authority docs for behavior details;
- `OBSERVABILITY.md` for diagnostics/performance/report architecture changes;
- `research/STATUS.md` when research disposition changed;
- `DECISIONS.md` or an accepted dated decision record when a durable architectural/product invariant changed.

Avoid copying large present-tense status blocks into many documents. Prefer links to the authority document so the repository does not drift back into contradictory snapshots.
