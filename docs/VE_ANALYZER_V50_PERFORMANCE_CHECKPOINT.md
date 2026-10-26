# VE Analyzer v50 interaction performance checkpoint

Branch: `ui/ve-analyzer-v50-reconcile`

Validated production-code checkpoint: `d9cf33b51a7d0adf3d922867916bcc0ae0f81f0c` (`Validate live Brush preview through full Web CI`).

This is a branch-only checkpoint. It does not authorize merging to `main`.

## Stage 1 — interaction hot-path reduction

The first functional hands-on pass reported that the table interactions worked but felt very slow. The confirmed hot paths were repeated whole-table semantic value/baseline work and DOM decoration on pointer/selection movement, plus repeated Lambda Delay working-value vector reconstruction for per-cell snapshot reads.

The targeted performance pass therefore changed only the shared table-interaction hot path and semantic snapshot publication while preserving accepted interaction semantics:

- cache the rendered table-cell coordinate map for the lifetime of the rendered table;
- separate lightweight selection/Brush decoration from full semantic value/baseline decoration;
- avoid rewriting unchanged DOM attributes;
- pointer drag, keyboard selection and Brush footprint movement no longer force semantic value/baseline reads for every table cell;
- cache the Lambda Delay working-value vector for one table/revision/authority generation instead of rebuilding `table.cells.map(cell => cell.workingMs)` for every per-cell snapshot read.

The subsequent hands-on test reported that performance was **much better**.

## Stage 2 — live Brush preview without restoring the old cost

The next hands-on finding was that the moving Brush footprint was responsive but the numeric values remained visually frozen until pointer-up. That made it difficult to see what the Brush was doing and by how much.

At validated checkpoint `d9cf33b51a7d0adf3d922867916bcc0ae0f81f0c`, Brush preview was changed so:

- affected cells visibly update their numeric value continuously during the active stroke;
- repeated stationary pulses visibly accumulate;
- the weighted Brush footprint remains visible;
- lower/higher baseline-memory color updates during the preview;
- Shift reversal visibly changes the pending values in the reverse direction;
- pointer-up commits the stroke once as one semantic edit / one Undo transaction;
- cancellation restores the pre-stroke presentation/state.

The old whole-table rerender path was **not** restored. Instead:

- the generic Brush transaction reports only pending cells whose preview value actually changed;
- the DOM controller updates only those cells;
- rapid preview updates are coalesced with `requestAnimationFrame`;
- semantic table authority/revision remains unchanged during the active stroke and changes only on commit;
- direct multi-cell typing preview updates the existing value node instead of replacing the VE cell's internal DOM structure;
- VE Proposal and Lambda Delay retain domain-specific display formatting while the shared interaction core remains domain-neutral.

Dedicated automated acceptance verifies the important separation: visible cell text changes during the active stroke, semantic owner/revision does not change during the stroke, and pointer-up commits the previewed stroke exactly once.

## Validation

At `d9cf33b...` the complete Web gate was green:

- TypeScript type-check;
- full unit suite;
- production build;
- staged Chromium acceptance;
- Worker-disabled fallback Chromium acceptance.

The next performance decision should be driven by user hands-on evidence. Do not reintroduce whole-table semantic refreshes merely to gain richer preview behavior.
