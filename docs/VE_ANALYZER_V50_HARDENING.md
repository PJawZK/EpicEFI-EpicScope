# VE Analyzer v50 interaction hardening

Branch: `ui/ve-analyzer-v50-port`

This note records source-review hardening after the first real Lambda Delay binding to the shared v50 table interaction stack. It supplements `docs/VE_ANALYZER_V50_PORT_BRANCH.md` and `docs/VE_ANALYZER_V50_LEFTOVER_ISSUE_ROUTE.md` and remains branch-local until post-Codex reconciliation.

## Implemented

### Lifecycle-safe direct editing

`ve-table-interaction-dom.ts` exposes `cancelActiveInteraction()` and table rebinding cancels an active inline edit rather than blurring it into an implicit commit. Authority/lifecycle changes can explicitly cancel unfinished F2/direct-typing before replacing the rendered table.

The Lambda adapter cancels before source/tune/controller edits and resets interaction state before Grab / Use recommendation / Load operations. The hidden delay-file input follows the same safety rule.

### Gesture listener lifetime

Document-level pointer move/up/cancel listeners exist only while a drag or Brush gesture is active. Pointer cancellation cancels Brush rather than committing it. The Lambda MutationObserver is disconnected while the VE view is inactive and reconnected when active.

### Selection anchor correction

Ctrl/Cmd additive drag begins from the newly clicked cell while preserving previous selection. Shift extension retains the prior anchor.

### Bounded Lambda undo/redo

Lambda shared interaction history is capped at 100 transactions in each direction. Authority replacement still clears history, pins and selection.

### Heterogeneous Lambda edit primitive and owner application

`core/analysis/ve-delay-table-editing.ts` exposes `editVeDelayCellValues(...)`, validating heterogeneous `{row,col,workingMs}` edits before one immutable table pass with last-edit-wins deduplication. Homogeneous `editVeDelayCells(...)` set operations delegate to it.

Focused unit coverage verifies heterogeneous application and invalid-batch atomicity. After the first clean browser checkpoint, the v2 semantic owner was also switched from repeated per-cell immutable copies to one `editVeDelayCellValues(...)` call while preserving one `invalidate()`/publication and the existing boolean-failure contract.

## Second safe-fix pass

### Interpolation finite-value safety

The shared interaction engine now treats non-finite/undefined surface values as unavailable interpolation evidence instead of allowing `NaN` to enter min/max, Hermite, bilinear or boundary calculations.

- 1D interpolation skips a line when required anchors/support are unavailable.
- 2D interpolation aborts cleanly when any required corner/boundary source is unavailable.
- `changed` is set only after a finite target can actually be submitted.
- zero-strength interpolation is an explicit no-op.

Focused unit coverage includes non-finite 1D support and 2D boundary/corner cases.

### Explicit irregular 2D policy

`axis: 'both'` now requires a complete rectangular selection. Irregular Ctrl/Cmd selections no longer inherit an implicit hidden bounding-rectangle surface. They remain valid for other operations and applicable 1D interpolation.

### Roving table focus

Editable calibration cells now use one roving Tab stop instead of setting every cell to `tabIndex=0`. The active/anchor cell is keyboard reachable and arrow navigation continues to move focus within the table. This prevents large VE/Target tables from creating hundreds of sequential Tab stops.

### Stationary Brush Shift reversal

Gesture-scoped keydown/keyup listeners now update Brush direction while a stroke is active. A held stationary Brush therefore reacts to Shift press/release without requiring pointer motion. These keyboard listeners are removed with the pointer gesture listeners at stroke completion/cancellation.

### Programmatic compact-summary synchronization

The v50 compact setup summaries are no longer refreshed only by DOM `input`/`change` events. The presentation wrapper also schedules summary synchronization after `setContext`, `setTuneModel`, `refresh`, activation, and delay-edit forwarding, covering controller-driven/programmatic updates.

### Semantic coordinates survive visual row reversal

Real browser execution exposed a production integration issue that source-only review did not: the existing VE UI refinement reverses calibration-table DOM row order so load increases visually from the bottom. The shared controller originally derived semantic row coordinates from DOM order after that reversal.

`markCoordinates()` now preserves existing semantic `data-delay-row` / `data-delay-col` coordinates when present and uses DOM indices only as fallback. This keeps the interaction engine aligned with Lambda authority regardless of visual row orientation.

### Direct-typing caret semantics

Native pointer/keyboard acceptance also exposed a direct-typing regression. Starting an edit by typing the first numeric character created the correct replacement input, but selecting the entire one-character input meant the next native text insertion replaced that first character. `1` followed by `75` therefore became `75` instead of `175`.

F2/Enter existing-value edits still select the full current value, while direct typing now places the caret after its first replacement character. Native browser range editing consequently preserves the established typing contract.

### Browser regression additions

`tests/web/ve-shared-table-interaction.browser.mjs` covers:

- active inline editing cancelled by delay-authority replacement;
- Ctrl/Cmd additive drag using the newly clicked cell as rectangle origin;
- one roving table Tab stop;
- compact setup summary refresh after programmatic controller refresh;
- held stationary Brush Shift reversal;
- existing semantic-owner edit/undo/pin/Brush behavior.

The historical `ve-delay-editing.browser.mjs` acceptance continues to cover four-cell transactional edits, no-op behavior, Delete/revert, blank working values, invalid input, touch editing, stale async completion, recommendation activation, Result Views and a 256-cell owner command. The browser runner also performs a native CDP pointer-capture plus keyboard-entry range edit.

## Executable validation checkpoint

GitHub Actions Web CI is enabled on this isolated branch so the production checkout can be built and exercised even when the assistant runtime has no local clone.

Clean checkpoint after the safe-fix pass and one-pass v2 owner migration:

- branch head: `1d913ee303a173ded4a0de3752e8f72b20683c72`
- Web CI run: `38977722663`
- TypeScript type-check: **PASS**
- Vitest: **PASS**
- production build: **PASS**
- browser acceptance, staged imports: **PASS**
- browser acceptance, fallback imports: **PASS**
- historical Lambda edit suite: **15/15 PASS** in the preceding diagnostic run and retained by the final green suite
- shared v50 Lambda interaction suite: **12/12 PASS** in the preceding diagnostic run and retained by the final green suite
- native pointer-capture + keyboard range edit: **PASS** after the direct-typing caret correction

Temporary diagnostic logging and temporary one-off patch workflows used to isolate those failures were removed before this checkpoint.

## Still intentionally pending

1. Move Lambda Result View off `ve-analyzer-view-v7.ts` DOM reconstruction and onto semantic owner geometry/values.
2. Introduce a delay-surface authority generation separate from broad Analyzer `sessionRevision`, then replace action-based history/pin resets with authority-change resets.
3. Decide and document Lambda working-value precision/quantization; accepted behavior currently permits fractional milliseconds while cells display whole milliseconds.
4. Replace the current approximate shape-interpolation slope calculation with a proper spacing-aware monotone/PCHIP formulation before relying on it for production VE tables.
5. Move temporary table-tool defaults (step, Smooth, interpolation and Brush settings) into the eventual production preference owner.
6. Run focused real-browser layout checks for setup disclosures, responsive geometry and representative table sizes before changing CSS from source inspection alone.
7. Reconcile Logger full-source extent/range-navigation, persistence ownership, explicit semantic controller capability, teardown and legacy wrapper retirement after Codex.
8. Explicitly verify vertical arrow-key navigation against the visually reversed load-axis row order; semantic coordinates are now correct, but keyboard movement should be judged by visual direction in a focused browser regression before broader table reuse.

## Merge boundary

The branch now has a clean executable correctness checkpoint, but it remains integration work-in-progress. Do not merge it into `main` until it has been reconciled with post-Codex ownership changes and the post-reconciliation build/typecheck/unit/browser suite is green again.
