# VE Analyzer v50 interaction hardening

Branch: `ui/ve-analyzer-v50-port`

This note records the source-review hardening pass performed after the first real Lambda Delay binding to the shared v50 table interaction stack. It supplements `docs/VE_ANALYZER_V50_PORT_BRANCH.md` and is intentionally branch-local until the post-Codex reconciliation.

## Implemented in this pass

### Lifecycle-safe direct editing

`ve-table-interaction-dom.ts` now exposes `cancelActiveInteraction()` and table rebinding cancels an active inline edit rather than blurring it into an implicit commit. Authority/lifecycle changes can therefore explicitly cancel an unfinished F2/direct-typing operation before replacing the rendered table.

The Lambda adapter calls cancellation before source/tune/controller edits and resets interaction state before Grab / Use recommendation / Load operations. The hidden delay-file input also resets interaction state on `change`, so direct fixture/file replacement follows the same safety rule as the visible Load button.

### Gesture listener lifetime

Document-level pointer move/up/cancel listeners are no longer installed for the entire controller lifetime. They are installed only while a drag or Brush gesture is active and removed when that gesture finishes or is cancelled. Pointer cancellation cancels Brush rather than committing it.

The Lambda MutationObserver is disconnected while the VE view is inactive and reconnected when it becomes active.

### Selection anchor correction

Ctrl/Cmd additive drag now begins from the newly clicked cell while preserving the previously selected cells. Shift extension retains the prior anchor. This removes the competing/stale DOM-anchor behavior found during source review.

### Bounded Lambda undo/redo

Lambda shared interaction history is capped at 100 transactions in each direction. Authority replacement still clears history, pins and selection.

### Heterogeneous Lambda edit primitive

`core/analysis/ve-delay-table-editing.ts` now exposes `editVeDelayCellValues(...)`, which validates a heterogeneous set of `{row, col, workingMs}` edits before applying them in one immutable table pass with last-edit-wins deduplication. Existing homogeneous `editVeDelayCells(...)` delegates to this primitive for set operations.

Focused unit coverage verifies heterogeneous value application and rejects invalid batches without partial publication.

The current legacy v2 owner still needs to be switched from its per-edit loop to this primitive during a later controller-owner cleanup; the core operation is ready and tested, but this branch deliberately avoids rewriting the large legacy controller merely to force that migration before executable validation.

### Browser regression additions

`tests/web/ve-shared-table-interaction.browser.mjs` now additionally covers:

- active inline editing cancelled by delay-authority replacement;
- Ctrl/Cmd additive drag using the newly clicked cell as the rectangle origin;
- existing semantic-owner edit/undo/pin/Brush behavior.

## Still intentionally pending

1. Run TypeScript, Vitest and real-browser acceptance against this branch before further large integration work.
2. Move Lambda Result View off `ve-analyzer-view-v7.ts` DOM reconstruction and onto semantic owner geometry/values.
3. Wire the new heterogeneous delay edit primitive into the underlying legacy Lambda owner after validation or post-Codex reconciliation.
4. Decide and document Lambda working-value precision/quantization; existing accepted behavior currently permits fractional milliseconds even though cells display rounded milliseconds.
5. Replace the approximate non-uniform shape interpolation slope calculation with a proper spacing-aware monotone/PCHIP formulation before relying on it for production VE tables.
6. Define/reject irregular 2D selections explicitly rather than allowing bounding-rectangle semantics to remain implicit.
7. Move temporary table-tool defaults (step, Smooth, interpolation and Brush settings) into the eventual production preference owner.

## Merge boundary

These changes remain integration work-in-progress. Do not merge the branch into `main` until it has been reconciled with post-Codex ownership changes and has passed build/typecheck/unit/browser acceptance.