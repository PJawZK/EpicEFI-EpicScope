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

## Slice 1 — workbench/scope presentation

The first production slice is presentation-only and lives in `ve-analyzer-v50-presentation.ts` plus `ve-analyzer-v50-port.css`.

It currently:

- preserves the stable VE entry/controller contract;
- adds a branch-local v50 presentation class;
- reorders existing production nodes to the v50 hierarchy: table -> scope -> setup -> readiness/action;
- gives new users the v50 single-table default while preserving an existing stored table-layout preference;
- makes the existing VE table the dominant full-width work surface;
- adds a compact scope overview using real currently-bound Logger trace timestamps and real A/B markers;
- introduces no synthetic evidence or domain state.

The scope overview is intentionally not yet interactive and does not yet include `Open in Logger`, because current `LoggerAnalysisContext` exposes sample handoff but not a range-navigation action. That missing production contract should be solved explicitly rather than emulated with prototype behavior.

## Slice 2 — compact setup/readiness presentation

Started on the same branch without replacing any setup-domain owners.

The existing production controls are moved (never cloned) into native `<details>` disclosure groups matching the v50 setup vocabulary:

- Qualification;
- Scope;
- Operating Range;
- Guards;
- Cell Change;
- Mixture;
- an `Additional` fallback only if an existing production control has not yet been classified.

Each compact group shows a live summary derived from the underlying production controls. The controls keep their original `data-role` / `data-ve-quick` identity and existing event listeners. Native disclosure replaces the prototype popup framework; no standalone window/menu framework is ported.

The existing Advanced details owner remains authoritative. The v50 row adds only a presentation button that opens/scrolls to that existing owner. Exclusions are intentionally not fabricated yet because the current production VE path does not expose the v50 exclusions editor/engine contract.

Moving setup controls out of the action row leaves the current Run/cancel/Lambda-readiness/blocker owners intact, allowing the action row to converge toward the compact v50 readiness/action surface without duplicating readiness state.

## Validation limitation on this branch

This chat currently has GitHub repository access but no executable local checkout, so these branch slices have not yet been run through TypeScript/build/browser acceptance in this session. Treat the branch as integration work-in-progress until an executable checkout or CI/PR validation path is available. Do not merge it based on source review alone.

## Next slices

1. Typecheck/build/browser baseline for Slices 1–2 and visual correction against v50.
2. Complete the scope navigator once a real Logger range-handoff/full-source-extent contract is available.
3. Establish the shared production table-interaction boundary.
4. Connect VE direct editing/selection/transactions first.
5. Connect Target editing.
6. Connect Lambda Delay editing without changing current recommendation/working/re-grab semantics.
7. Port Advanced and Exclusions presentation over existing role/formula owners.
8. Port proposal/result/review, Cell Evidence and Analysis Summary presentation over retained authoritative analysis.
9. Remove superseded presentation rules/layers only after behavioral parity.
10. Rebase/reconcile this branch against the post-Codex `main`, run the fresh audit findings through the port, then run the full browser acceptance suite before any merge decision.

## Known reconciliation risks

- Codex Targets 10/11/16/17 may move presentation, diagnostics or lifecycle ownership.
- Storage recovery changes may affect the table-layout preference path.
- D-058 observability may change Diagnostics/status presentation.
- Current v7 still reconstructs Lambda Delay result-view data from DOM; do not extend that pattern.
- The branch must not become a second tune/analysis authority while waiting for reconciliation.
