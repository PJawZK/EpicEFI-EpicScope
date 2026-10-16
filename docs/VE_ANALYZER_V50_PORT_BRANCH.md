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

## Slice 3 — shared table interaction boundary

A production-shaped, domain-neutral interaction layer now exists in `apps/web/src/pages/ve-table-interaction.ts`, with focused tests in `tests/ve-table-interaction.test.ts`.

The boundary deliberately does not own tune values. A production table surface must supply dimensions, value reads, and a real transaction lifecycle (`beginTransaction` -> `get/set` -> one `commit` or `cancel`). This allows the same interaction vocabulary to sit over different authoritative owners without copying prototype arrays or creating a new mutation store.

The interaction session now covers the frozen v50 semantics needed by VE / Target / Lambda where applicable:

- replace / toggle / rectangle / additive / extend selection primitives;
- session-only pins;
- direct typed replacement that may deliberately override pins;
- bulk `+ / -` style adjustment that skips pins;
- snapshot-based local 3x3 Smooth with configurable strength;
- horizontal/vertical interpolation with linear or monotone shape-preserving behavior;
- pinned cells as interior 1D interpolation anchors;
- 2D bilinear and boundary-surface interpolation;
- configurable interpolation strength and clamping;
- continuous weighted Brush strokes with radius/strength/falloff and Shift-style direction supplied by the caller;
- one Brush press/drag/release stroke represented by one open transaction and one commit;
- pin protection during Brush.

The module intentionally contains no DOM event wiring, no timers, no localStorage, no TuneModel ownership and no ECU/MSQ write path. Pointer cadence, keyboard handling and toolbar presentation belong to the DOM/controller adapter; tune mutation belongs to the authoritative surface adapter.

## Slice 4 — shared table DOM/controller shell

`apps/web/src/pages/ve-table-interaction-dom.ts` now provides the presentation/input side of the shared interaction layer, with focused styling in `apps/web/src/styles/ve-table-interaction-dom.css`.

This shell is intentionally **not yet attached to VE/Target/Lambda production surfaces**. It is staged separately so selection/event behavior can be reviewed without inventing a mutable tune owner.

It provides:

- DOM hit testing and row/column decoration only; rendered text is never read as tune/domain authority;
- replace/toggle/Shift-extend and drag-rectangle selection wiring;
- keyboard arrow navigation and Shift extension;
- direct numeric typing plus Enter/F2 inline-edit presentation;
- toolbar command hooks for undo/redo, +/- adjustment, Smooth, interpolation, Pin, Brush, Revert and Clear;
- session-only selected/anchor/pinned visual state;
- pin symbol without the rejected pinned-cell border highlight;
- continuous Brush pointer lifecycle with an immediate movement pulse plus held 90 ms spray cadence;
- one pointer-down Brush stroke mapped to one `TableBrushStroke` transaction;
- cancellation on controller/table teardown;
- explicit callbacks for owner-provided undo/redo/revert/clear and post-edit refresh.

The DOM shell does not create a value store, undo stack, persistence store or tune writer. Those stay behind the `TableEditSurface`/production-owner boundary.

A remaining refinement before binding the shell is to provide owner-backed current-value text for F2/Enter editing and owner-backed Brush-radius preference mutation. Those must not be sourced from rendered cell text or hidden UI state.

### Production ownership issue exposed by Slices 3–4

The current controller contract exposes transactional Lambda Delay editing through `editDelayCells(...)`, but it does **not** expose an authoritative mutable VE-table or Target-table surface. The currently rendered VE/Target values originate from the loaded `TuneModel` / `TuneEntry` path, which is analysis input rather than a writable table owner.

Therefore the branch intentionally does **not** wire the new interaction layer to VE or Target yet. Doing so now would require either mutating immutable analysis input or introducing a second branch-local tune authority, both of which violate the port contract.

This is a useful integration finding rather than a missing UI detail. After the Codex reconciliation/writable-tune ownership work, VE and Target need a real table adapter that can provide one transactional edit boundary and later map reviewed edits to MSQ/ECU application. Lambda Delay can be adapted earlier because it already has a semantic transactional owner, but its current lifecycle/working-vs-recommendation rules must remain unchanged.

## Validation limitation on this branch

This chat currently has GitHub repository access but no executable local checkout, so these branch slices have not yet been run through TypeScript/build/browser acceptance in this session. The interaction engine includes source-level Vitest coverage, but those tests have not been executed here. Treat the branch as integration work-in-progress until an executable checkout or CI/PR validation path is available. Do not merge it based on source review alone.

## Next slices

1. Typecheck/build/browser baseline for Slices 1–4 and visual correction against v50.
2. Complete the scope navigator once a real Logger range-handoff/full-source-extent contract is available.
3. Refine owner-backed direct-edit value and Brush-radius preference hooks in the DOM shell.
4. Adapt Lambda Delay to the shared interaction boundary first, exposing only the minimum semantic snapshot/transaction surface needed from its existing owner.
5. Connect VE direct editing/transactions only after a real authoritative mutable VE/review surface exists.
6. Connect Target editing under the same tune/review authority.
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
- VE/Target editing cannot be honestly completed until a mutable tune/review owner is defined; do not solve that with a UI-local array.
