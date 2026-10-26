# EpicScope documentation authority map

Last authority refresh: 2026-10-26

This file defines how repository documentation should be interpreted so historical plans/research do not override current product state.

## Code-first interpretation (2026-10-26)

Current `main` implementation, its explicit code/test contracts and observed runtime behavior take priority over all written summaries, historical branches and standalone prototypes. This includes the current handoff: if it disagrees with implementation, mark a documentation mismatch; do not alter correct runtime code to satisfy a stale sentence. A code defect must be established separately with evidence. Docs-only changes should not affect application behavior.

PR #466 integrated VE v50 and MSQ workflows; PR #467 merged complete-prefix MLG recovery at runtime checkpoint `f6bdbf78643754d1bf3398980bcad3583201fef9`. Historic PR #462 remains valid provenance, not the latest baseline. Pages builds `main`. [Archived handoff checkpoints](handoffs/ARCHIVE_THROUGH_2026-10-26.md) retain original wording and are **not** present-tense instructions. `HANDOFF.md` now contains a concise current-state index and unresolved acceptance/policy distinctions.

The older 2026-10-16 snapshot below is preserved as historical context until Pass B reconciles individual subsystem specifications against current code. Do not interpret it as current project status.

## Present-tense authority

Use these documents for current project state and continuation:

1. `HANDOFF.md` — present-tense continuation authority.
2. current `main` implementation and current browser/runtime evidence.
3. `PRODUCT.md` — current product contract.
4. `ROADMAP.md` — current sequencing and phase status.
5. `ANALYZER.md`, `HISTOGRAM.md`, `VE_ANALYZER.md`, `VE_ANALYZER_WORKBENCH.md`, `PREPOPULATED_WORKSPACES.md`, `TS_SHIM_STATUS.md`, `LOG_MLG_PLAN.md` — subsystem authorities.
6. `OBSERVABILITY.md` — approved diagnostics/performance/report consolidation architecture and implementation plan.
7. `research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md` — performance-first implementation research for D-058 observability.
8. `research/STATUS.md` — living mapping from preserved external research to current EpicScope implementation state.
9. approved decisions in `DECISIONS.md` and accepted later decision records under `decisions/`.

If two current-facing documents disagree, `HANDOFF.md` and the actual current `main` runtime win until the contradiction is corrected. An explicit later accepted decision may refine an older decision while preserving the older record for traceability.

## Historical project snapshot (2026-10-16)

As of 2026-10-16 (superseded by current code and handoff):

- `main` is the only product/continuation authority;
- PR #462 is merged at `2fdce3a4fc2a8759a45058c0ebc06dba0ed4739b`;
- the exact pre-merge Analyzer/VE runtime accepted by the owner was `b435702412642f039a8a7f49d33037c309bef9d8`;
- Analyzer points 1–11 are integrated and accepted on `main`;
- VE Result View source-authority, heat-map and navigation/session regressions are closed;
- Logger is a mature functional reference;
- generic Histogram research parity is closed for the approved scope;
- Fueling and non-knock Ignition are mature experimental Analyzer checkpoints;
- Boost is a strong experimental foundation;
- Fuel / Injector and Trigger / Sync retain targeted lower-priority maturity gaps;
- immediate next work is a focused UI polish pass;
- D-058 unified observability is the next substantial implementation track after UI polish;
- MLG v3 remains researched but not implemented;
- Linux remains future production implementation after Web maturity/observability consolidation.

## Historical/reference documents

The following classes intentionally preserve older observations or design stages and are not present-tense implementation authorities by themselves:

- external-tool research under `research/` other than the living `research/STATUS.md` and current observability implementation research;
- dated implementation/audit notes under `research/`;
- superseded/historical dated decision records under `decisions/`;
- `WEB_BOOT_PLAN.md`;
- `SHIM7_CAPTURE_BINDING.md`;
- superseded/historical sections inside `DECISIONS.md`;
- `BRANCH_CLEANUP_2026-10-15.md` as a cleanup/provenance record;
- `DOCUMENTATION_AUDIT_2026-10-15.md` as a dated audit record;
- `POINTS_5_11_INTEGRATION_REVIEW.md`, `INTEGRATION_NOTE.md` and `VE_ANALYZER_ENTRY_INVESTIGATION.md` as evidence from the now-completed integration sequence.

Historical documents may correctly say “planned”, “not yet implemented”, describe PR #449 as the then-current baseline, or describe defects that were later fixed. Do not rewrite historical evidence merely to make it read like present state. Current disposition belongs in `HANDOFF.md`, `ROADMAP.md`, subsystem authorities or `research/STATUS.md`.

## Current accepted decisions

`decisions/2026-10-15-ve-runtime-and-delay-authority.md` records:

- **D-056** — VE lambda-delay working model is **RPM × load table only**. Scalar/single and RPM-curve modes are historical/rejected unless a new decision explicitly reopens them.
- **D-057** — VE lifecycle/render/state/input changes require browser acceptance evidence in addition to normal automated CI.

The historical PR #449 boundary named in D-057 has since been superseded by the browser-accepted PR #462 integration on `main`; the browser-acceptance principle remains current.

`decisions/2026-10-15-unified-observability-authority.md` records:

- **D-058** — diagnostics, performance history, runtime errors and report assembly converge on one versioned, bounded observability/session architecture. Existing useful probes stay in their natural owners, reports become projections over the shared record stream, and redundant collectors/builders are removed only after migration parity.

## VE Analyzer authority rules

- `VE_ANALYZER.md` is the current algorithm/evidence/product contract.
- `VE_ANALYZER_WORKBENCH.md` is the current UI/workflow contract.
- current `main` plus browser acceptance of the integrated behavior supersede older PR #449-era implementation snapshots.
- browser behavior remains acceptance authority for VE runtime changes; green CI alone is insufficient.
- the accepted lambda-delay working model is **RPM × load table only**.
- original VE/tune data, analysis evidence/proposal and user-reviewed/application state remain distinct.
- EpicScope must never automatically write/Burn VE changes to the ECU.

## Observability authority rules

- `OBSERVABILITY.md` defines the target architecture, migration inventory, bounded retention policy and staged implementation plan.
- D-058 is the durable project-wide decision authorizing the consolidation.
- `research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md` records the performance-first implementation constraints and benchmarking direction.
- current Performance/parser/bug-report components remain implementation reality until migrated; approved architecture does not imply migration is already complete.
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

A feature change is not complete when only code changes. Update the smallest authoritative set affected:

- `HANDOFF.md` for continuation state;
- `ROADMAP.md` if sequencing/status changed;
- `PRODUCT.md` if user-visible product contract changed;
- subsystem authority docs for behavior details;
- `OBSERVABILITY.md` for diagnostics/performance/report architecture changes;
- `research/STATUS.md` when research disposition changed;
- `DECISIONS.md` or an accepted dated decision record for durable architecture/product invariants.

Avoid copying large present-tense status blocks into many documents. Prefer authority links so the repository does not drift back into contradictory snapshots.
