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
- bulk `+ / -` adjustment that skips pins;
- snapshot-based local 3x3 Smooth with configurable strength;
- horizontal/vertical interpolation with linear or monotone shape-preserving behavior;
- pinned cells as interior 1D interpolation anchors;
- 2D bilinear and boundary-surface interpolation;
- configurable interpolation strength and clamping;
- continuous weighted Brush strokes with radius/strength/falloff;
- one Brush press/drag/release stroke represented by one open transaction and one commit;
- pin protection during Brush.

The module contains no DOM event wiring, timers, localStorage, TuneModel ownership or ECU/MSQ write path.

## Slice 4 — shared table DOM/controller shell

`apps/web/src/pages/ve-table-interaction-dom.ts` provides the presentation/input side of the shared interaction layer, with focused styling in `apps/web/src/styles/ve-table-interaction-dom.css`.

It now provides:

- DOM hit testing and row/column decoration only; rendered text is never read as tune/domain authority;
- replace/toggle/Shift-extend, additive Ctrl/Cmd selection and drag-rectangle selection;
- keyboard arrow navigation and Shift extension;
- owner-backed F2/Enter editing and digit replacement;
- Backspace digit editing without reading cell text;
- toolbar hooks for undo/redo, +/- adjustment, Smooth, interpolation, Pin, Brush, Revert and Clear;
- session-only selected/anchor/pinned visual state;
- the frozen pin-symbol-only treatment, with no pinned border highlight;
- continuous Brush pointer lifecycle with immediate movement pulses plus held 90 ms spray cadence;
- Shift reversal for Brush direction supplied from the active pointer gesture;
- mouse-wheel Brush-radius adjustment through the caller preference hook;
- one Brush press/drag/release stroke mapped to one `TableBrushStroke` transaction;
- document-level move/release handling so an active drag or Brush stroke can complete outside the cell target;
- touch-tap inline editing;
- separate Delete, explicit Clear and blank-entry commands so each production surface can preserve its own semantics.

The controller deliberately keeps accepted Lambda Delay compatibility attributes/classes while that old input layer is retired, allowing the existing browser acceptance to remain meaningful during the port.

## Slice 5 — Lambda Delay on the shared interaction stack

Lambda Delay is now the first real production surface bound to the shared v50 table interaction system.

`apps/web/src/pages/ve-analyzer-delay-edit-owner.ts` registers a semantic owner capability against the stable VE root. The root is only a lifetime/capability key: values are never reconstructed from rendered table text or DOM attributes. The base VE controller exposes through this capability:

- current rows/columns;
- an immutable working-value snapshot plus session revision;
- multi-cell value application with one final Analyzer invalidation;
- semantic revert-to-recommendation.

`apps/web/src/pages/ve-analyzer-delay-table-interaction.ts` adapts that owner to `TableEditSurface` and the shared DOM/controller. It supplies:

- owner-backed current values for F2/Enter/Backspace;
- stale-revision rejection before committing an open interaction transaction;
- non-negative Lambda Delay values while rejecting an explicitly typed negative value rather than silently accepting it;
- one semantic publication for a multi-cell edit/adjust/smooth/interpolate/Brush transaction;
- session-local undo/redo over semantic owner snapshots;
- explicit Clear/blank working-value behavior while preserving the accepted Lambda Delete = revert-to-recommendation behavior;
- selection and pins across ordinary owner re-renders;
- interaction/history reset when the delay authority itself is replaced by Grab, Use recommendation, Load, source change or tune change;
- a default 10 ms adjustment step, 50% smoothing, boundary-surface 2D interpolation, and Brush defaults of 5 ms / radius 1 / linear falloff; Brush radius can be changed by mouse wheel between 0 and 4.

The old `ve-analyzer-view-v5.ts` listener layer remains in the controller chain for now, but explicitly yields pointer/keyboard ownership whenever the shared delay interaction owner is active. This avoids two active editing systems while minimizing branch-local architectural churn before the post-Codex reconciliation.

The stable `ve-analyzer-view.ts` now installs the v50 presentation and then the shared Lambda Delay interaction adapter; no `v10` controller was introduced.

### Compatibility intentionally preserved

The existing Lambda Delay acceptance behavior remains part of the contract while the UI changes:

- range edit = one semantic revision / one invalidation;
- unchanged edit is a no-op;
- Delete reverts to generated recommendation/provenance;
- blank commit clears only working authority and preserves recommendation evidence;
- invalid/negative direct values are non-destructive;
- Escape cancels an inline edit and restores focus/selection;
- Backspace and digit replacement remain usable;
- touch tap opens the current semantic value;
- source/tune generations still reject stale file/analysis completions.

The existing browser fixture `tests/web/ve-delay-editing.browser.mjs` is therefore still expected to exercise the ported path rather than being discarded solely because the presentation owner changed.

## VE / Target ownership boundary still unresolved by design

The current production controller still does **not** expose an authoritative mutable VE-table or Target-table surface. Those values originate from the loaded `TuneModel` / `TuneEntry` path, which is analysis input rather than writable tune/review authority.

Therefore the branch still does not wire shared editing to VE or Target. Doing so now would require either mutating immutable analysis input or introducing a UI-local tune authority, both of which violate the port contract.

After Codex reconciliation/writable-tune ownership work, VE and Target need real table adapters that provide the same transaction boundary and can later map reviewed edits to MSQ/ECU application.

## Validation limitation on this branch

This chat currently has GitHub repository access but no executable local checkout, so these branch slices have not yet been run through TypeScript/build/browser acceptance in this session. The interaction engine includes source-level Vitest coverage, and the existing Lambda browser fixture should now exercise the shared adapter path, but neither has been executed here.

Treat the branch as integration work-in-progress until an executable checkout or CI/PR validation path is available. Do not merge it based on source review alone.

## Next slices

1. Typecheck/build/browser baseline for Slices 1–5 and visual correction against v50.
2. Fix any regression exposed by the existing Lambda Delay browser fixture before adding more behavior.
3. Add focused browser assertions for shared toolbar operations (undo/redo, pins, Smooth/interpolation and held Brush cadence) once the baseline runs.
4. Complete the scope navigator once a real Logger range-handoff/full-source-extent contract is available.
5. Add persisted production preference controls for table adjustment/Smooth/interpolation/Brush settings rather than keeping the current Lambda defaults as the final UX.
6. Connect VE direct editing/transactions only after a real authoritative mutable VE/review surface exists.
7. Connect Target editing under the same tune/review authority.
8. Port Advanced and Exclusions presentation over existing role/formula owners.
9. Port proposal/result/review, Cell Evidence and Analysis Summary presentation over retained authoritative analysis.
10. Remove superseded presentation rules/layers only after behavioral parity.
11. Rebase/reconcile this branch against the post-Codex `main`, run the fresh audit findings through the port, then run the full browser acceptance suite before any merge decision.

## Known reconciliation risks

- Codex Targets 10/11/16/17 may move presentation, diagnostics or lifecycle ownership.
- Storage recovery changes may affect the table-layout preference and eventual table-tool preference path.
- D-058 observability may change Diagnostics/status presentation.
- Current v7 still reconstructs Lambda Delay Result View data from DOM; this branch does not extend that pattern, but the old debt remains.
- The shared Lambda semantic owner is registered through a WeakMap keyed by the stable VE root to avoid rewriting every legacy wrapper on this isolated branch. Reassess whether this should become an explicit controller capability after post-Codex reconciliation.
- VE/Target editing cannot be honestly completed until a mutable tune/review owner is defined; do not solve that with a UI-local array.
