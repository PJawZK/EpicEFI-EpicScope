# VE Analyzer v50 UI completion checkpoint — 2026-10-17

Branch: `ui/ve-analyzer-v50-reconcile`

Current UI-completion head: `01156f066575f03bb1a2a47901f750b15b45c671` (`Install final v50 layout reconciliation`).

This checkpoint closes the frozen-v50 **presentation / interaction transfer** pass. It does not authorize merging to `main`, and it does not close the separately deferred Brush-performance work.

## UI transfer now complete

The production VE Analyzer now carries the frozen v50 workbench hierarchy while retaining existing EpicScope semantic owners:

- table-first workbench with the table as the dominant surface;
- compact scope navigator and explicit Logger range handoff;
- compact disclosure-based setup controls;
- frozen v50 table-tool icon vocabulary and shared table interaction core;
- VE Proposal/review and Lambda Delay adapters using semantic owners rather than rendered DOM text;
- selection/range/direct typing, Undo/Redo, +/- configuration, Pin, Smooth, H/V/Both interpolation, Clear/Revert and continuous Brush interaction where supported;
- MLV-style lower/blue and higher/red baseline memory;
- pinned-cell symbol without a pinned border;
- direct semantic Scope choices rather than a nested select;
- viewport-aware popup/disclosure placement;
- responsive 1024 / 1366 / 1920 workbench acceptance;
- global EpicScope Help and Settings remain the sole Help/Settings controls; VE does not duplicate them;
- selection-dependent commands visibly expose unavailable state while preserving right-click tool configuration;
- Undo/Redo availability follows each surface's actual semantic history stacks;
- persistent Cell Evidence inspector presentation: the existing evidence owner remains authoritative, while an open inspector follows the current VE selection and its header can be moved within the viewport;
- final workflow order matches the frozen reference: setup -> readiness/status -> primary Run action, with Run last/right, blocker feedback immediately adjacent to the status band, and review/navigation tools subordinate after the blocker surface;
- frozen status proportions restored: 40 px status band, 4 x 7 px padding, 34 px readiness state/chip scale and 40 px primary Run control.

No new tune/application authority was introduced by the final presentation pass.

## Explicitly not part of UI completion

The frozen standalone prototype also demonstrates capabilities for which current production has no matching semantic owner. They must not be smuggled into a visual reconciliation pass:

- editable Target-table mutation authority;
- saved custom formula-based VE exclusion rules and their sample-filter execution/persistence;
- proposal acceptance/write/export into tune/ECU authority;
- synthetic/prototype scope evidence-density overlays.

Target continues to be a separate tune-table presentation authority and remains read-only unless production explicitly exposes an editing owner later. The production Exclusions navigation exposes existing state-exclusion mappings; a future custom-rule editor must reuse the shared calculated-field/formula execution path and real analysis filtering rather than copying prototype state.

## Brush performance remains deferred

The current Brush feature remains functionally accepted for the UI transfer, including continuous held spray, live numeric/heat preview, Shift reversal, footprint presentation and one semantic transaction per stroke. The user has explicitly deferred the remaining footprint/pointer responsiveness optimization until after the UI is fully complete.

Do not use further CSS micro-optimization as the next Brush step. The likely future optimization boundary is direct footprint delivery to the canvas renderer plus cached cell geometry, avoiding the current preview-attribute / MutationObserver / repeated geometry path.

## Validation

Full Web CI for the final UI-layout head is run `39061649218` (#1799):

- TypeScript type-check: pass;
- unit suite: pass;
- production build: pass;
- staged Chromium acceptance: pass;
- Worker-disabled fallback Chromium acceptance: pass.

The prior persistent/movable Cell Evidence integration also passed the full gate independently at `91809fe0b15db4e35e9036debc0e7758a60efeca`, run `39061421347` (#1796).

## Next boundary

1. user hands-on visual/UI acceptance of this completed transfer;
2. only then resume the separately deferred Brush-performance optimization;
3. rerun full validation after Brush work;
4. final Codex audit of the reconciled branch against current `main`;
5. apply only evidence-backed fixes/cleanup and revalidate;
6. final diff / PR inspection;
7. merge only after explicit user approval.

`main` remains untouched.
