# VE Analyzer v50 production-port branch

Branch: `ui/ve-analyzer-v50-port`

Base: `main` at `8890498d96787582d59ac7ee2716bfbf8b38b2bd`.

This branch is intentionally isolated from the Codex target implementation work. Do not merge or fast-forward it into `main` until the Codex sequence and fresh post-target repository audit have been reconciled.

## Authority

The frozen external reference is `EpicScope_VE_Analyzer_Interactive_Concept_v50_frozen_port_candidate.html` plus its `EpicScope VE Analyzer v50 — Port & Verification Handoff`.

Production authority remains in EpicScope owners:

- stable entry: `apps/web/src/pages/ve-analyzer-view.ts`;
- VE lifecycle/analysis: existing VE controller chain;
- retained result: `getPrimaryAnalysis()` / result owner;
- Lambda Delay: existing working/recommendation and transactional edit owners;
- Logger: `LoggerAnalysisContext`;
- formula execution: existing calculated-field evaluator;
- persistence: existing application persistence owners.

Do not create a `v10` wrapper. Do not copy the prototype's inline script, synthetic arrays, fake readiness/evidence, fake Logger, fake Lambda recommendation, floating-window framework, or raw localStorage model into production.

## Slice 1 — started

The first production slice is presentation-only and lives in `ve-analyzer-v50-presentation.ts` plus `ve-analyzer-v50-port.css`.

It currently:

- preserves the stable VE entry/controller contract;
- adds a branch-local v50 presentation class;
- reorders existing production nodes to the v50 hierarchy: table -> setup -> readiness/action;
- gives new users the v50 single-table default while preserving an existing stored table-layout preference;
- makes the existing VE table the dominant full-width work surface;
- adds a compact scope overview using real currently-bound Logger trace timestamps and real A/B markers;
- introduces no synthetic evidence or domain state.

The scope overview is intentionally not yet interactive and does not yet include `Open in Logger`, because current `LoggerAnalysisContext` exposes sample handoff but not a range-navigation action. That missing production contract should be solved explicitly rather than emulated with prototype behavior.

## Next slices

1. Browser/typecheck baseline for Slice 1 and visual correction against v50.
2. Finish compact setup/readiness presentation without changing underlying controls or readiness authority.
3. Add a real Logger range-handoff contract and complete the scope navigator.
4. Establish the shared production table-interaction boundary.
5. Connect VE direct editing/selection/transactions first.
6. Connect Target editing.
7. Connect Lambda Delay editing without changing current recommendation/working/re-grab semantics.
8. Port Advanced and Exclusions presentation over existing role/formula owners.
9. Port proposal/result/review, Cell Evidence and Analysis Summary presentation over retained authoritative analysis.
10. Remove superseded presentation rules/layers only after behavioral parity.
11. Rebase/reconcile this branch against the post-Codex `main`, run the fresh audit findings through the port, then run the full browser acceptance suite before any merge decision.

## Known reconciliation risks

- Codex Targets 10/11/16/17 may move presentation, diagnostics or lifecycle ownership.
- Storage recovery changes may affect the table-layout preference path.
- D-058 observability may change Diagnostics/status presentation.
- Current v7 still reconstructs Lambda Delay result-view data from DOM; do not extend that pattern.
- The branch must not become a second tune/analysis authority while waiting for reconciliation.
