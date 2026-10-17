# VE Analyzer v50 interaction performance checkpoint

Branch: `ui/ve-analyzer-v50-reconcile`

The first functional manual pass reported that the table interactions work but feel very slow. A targeted performance pass therefore changed only the shared table-interaction hot path and Lambda Delay snapshot publication; accepted interaction semantics remain the authority.

The shared DOM controller now caches the rendered table-cell coordinate map for the lifetime of a rendered table, separates selection/Brush decoration from full semantic value/baseline decoration, and avoids rewriting unchanged DOM attributes. Pointer drag, keyboard selection and Brush hover no longer force semantic value/baseline reads for every table cell.

The Lambda Delay semantic owner now caches its working-value vector for one table/revision/authority generation instead of rebuilding `table.cells.map(cell => cell.workingMs)` for every per-cell snapshot read.

Checkpoint implementation commit: `1321a51edcf62f114253dcb60888df7a6b633ef8`.

This is a branch-only performance checkpoint. Full Web CI and another hands-on responsiveness pass are required before this work is considered accepted or eligible for integration. It does not authorize merging to `main`.
