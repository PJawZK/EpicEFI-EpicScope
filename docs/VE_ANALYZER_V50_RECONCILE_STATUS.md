# VE Analyzer v50 reconciliation status

Branch: `ui/ve-analyzer-v50-reconcile`

Base/product authority: current `main` through `8fb99c0099408b74330d6468868424f1b94b05f5` (PR #465, Lambda Delay Shift-click range editing).

This branch is deliberately isolated from `main`. It is the post-Codex reconciliation branch for the frozen v50 VE Analyzer presentation and shared table interaction work. No merge to `main` is authorized before automated validation, user UI acceptance and a final Codex branch audit.

## Replayed and reconciled against current main

- v50 presentation layer and focused styles;
- shared table interaction engine and DOM controller;
- semantic Lambda Delay edit owner and shared Lambda adapter;
- heterogeneous Lambda Delay batch editing in one immutable pass;
- current-main v2 readiness/observability ownership retained;
- current-main v5 observability retained while legacy input yields when the shared owner is active;
- current-main optional `ObservabilityRecorder` path retained through the stable VE entry;
- current-main v7 Result View ownership retained; the obsolete outer Result Heat wrapper is not restored;
- current readiness contract is forwarded through both v50 wrappers;
- focused interaction/unit/browser regression modules restored;
- current expanded browser runner retains all Codex/source-integrity/observability checks and adds shared-v50 interaction acceptance;
- PR #465's production Lambda Delay Shift-click selection fix and expanded native/browser acceptance are present in this branch as part of the current-main merge.

## Reconciled green baselines

### Replay baseline

Web CI run `38979825194` passed after the current-main replay and before the semantic delay-surface cleanup:

- TypeScript type-check: pass;
- full Vitest suite: pass;
- production build: pass;
- staged Chromium acceptance: pass;
- Worker-disabled fallback acceptance: pass;
- historical Lambda editing/native pointer-keyboard acceptance: pass;
- shared v50 Lambda interaction acceptance: pass;
- current-main observability/source-integrity/Diagnostics/readiness acceptance retained.

### Semantic Lambda baseline

Web CI run `38980417790` passed after introducing dedicated Lambda surface authority and switching v7 Result View away from DOM reconstruction. The same full validation/browser gate remained green.

### Logger scope and shared-table rebind baseline

The first Logger-scope browser run exposed a sequencing gap in the new focused fixture: scope changes synchronously rebuild the rendered delay table and the shared DOM owner rebinds through MutationObserver delivery. The fixture now waits for that production rebind before exercising the new table. The shared adapter also observes the delay-host subtree so nested table rebuilds cannot leave the interaction controller attached to obsolete DOM.

Web CI run `38981117512` passed with the explicit post-scope settle. A subsequent full run after the subtree-observer hardening (`38981472740`) also passed TypeScript, Vitest, production build, staged Chromium and fallback Chromium acceptance.

### Current-main interaction parity baseline

After current `main` was merged forward, PR #465's added Shift-click/live-preview acceptance exposed the shared-owner preview gap described below. The shared v50 owner was updated to preserve that accepted behavior, and Web CI run `38982070694` passed TypeScript, the full unit suite, production build, staged Chromium and fallback Chromium acceptance.

### Spacing-aware interpolation baseline

Web CI run `38982461290` passed after physical-axis linear/2D interpolation and nonuniform shape-preserving PCHIP were introduced. TypeScript, the full unit suite (including uneven-axis cases), production build, staged Chromium and fallback Chromium all passed.

## Semantic Lambda surface

### Dedicated delay-surface authority

The semantic delay snapshot carries:

- broad Analyzer `revision` for compatibility/evidence;
- dedicated `authorityGeneration` for the editable Lambda-delay surface;
- rows/cols;
- RPM/load axes;
- working values.

`authorityGeneration` advances when the editable Lambda surface itself changes or is replaced/withdrawn, rather than on every unrelated Analyzer invalidation. Shared table transactions use this generation for stale-commit rejection.

### Result View no longer reconstructs Lambda authority from DOM

v7 remains the sole Result View presentation owner, but its Lambda surface comes from the semantic delay owner snapshot. It no longer reconstructs RPM/load axes or working delay values from rendered headers, `dataset.delayValue`, or cell text.

The existing v7 interpolation/display/heat policy remains in place; only the source of Lambda authority changed.

## Logger scope/range reconciliation

The v50 scope navigator now has a production contract instead of inferring Full Log bounds from whichever traces happen to be loaded:

- Logger retains the authoritative imported whole-source time range with the accepted data source;
- `LoggerAnalysisContext` captures that source extent with the same source lifetime as its sample/catalog loader;
- Logger exposes a range-focus operation owned by Logger navigation;
- the application shell provides the Analyzer-to-Logger range handoff and mode switch;
- the v50 navigator renders the actual selected Analyzer scope (`Full Log`, `Current A/B`, or saved range) against the authoritative source extent;
- `Open in Logger` hands that semantic range back through the explicit contract;
- loaded trace bounds are no longer treated as Full Log authority.

Focused browser regressions cover retained source extent and the v50 selected-range handoff.

## Current-main range-edit reconciliation

After syncing PR #465, its new browser acceptance exposed a semantic parity gap: the shared v50 input owner correctly formed the Shift-selected range and deferred mutation until commit, but unlike the accepted production v5 path it only showed the direct-typing preview in the active cell. PR #465 requires live preview across the whole selected range while semantic delay authority and revision remain unchanged until Enter/blur.

The shared DOM controller now mirrors the typed preview text into the other selected rendered cells only. Preview state is presentation-only and retained by actual cell element, so cancellation or table replacement cannot restore old text into a newer semantic surface. Enter/blur still performs one shared semantic transaction; Escape/cancellation restores the rendered values without mutation.

## Visual keyboard navigation

Lambda Delay renders load rows in descending DOM order while preserving ascending semantic row indices. The shared table DOM controller derives Arrow-key neighbours from the rendered table geometry rather than assuming semantic row `-1` is visually up. This keeps Up/Down correct for reversed load presentation while preserving semantic cell coordinates for edits and range selection.

Focused browser acceptance checks ArrowUp from semantic row 0 reaches the visually higher semantic row 1, ArrowDown returns, and Shift+ArrowUp extends the selection in the same visual direction.

## Spacing-aware interpolation

Shared interpolation has an optional physical-axis contract at the `TableEditSurface` boundary. Generic surfaces continue to fall back to index coordinates, while the Lambda Delay adapter supplies its semantic RPM and load bins.

- linear H/V interpolation uses actual axis spacing rather than equal cell-index distance;
- shape-preserving H/V interpolation uses nonuniform PCHIP/Fritsch-Carlson-style weighted derivatives with endpoint limiting instead of the former equal-spacing harmonic approximation;
- 2D bilinear and boundary/Coons interpolation use physical row/column fractions as well;
- pinned interior anchors and the existing clamp/strength/transaction semantics remain unchanged;
- unit regressions cover uneven 1D linear spacing, uneven monotone shape interpolation and uneven 2D geometry.

## Persisted table-tool preferences

The frozen v50 contract calls for configurable `+ / −`, Smooth, H/V/2D interpolation and Brush settings, with those settings persisted while selection, pins and active Brush remain session-only. The production port now follows that split.

- a validated/restricted-storage-safe state owner stores only the currently implemented Lambda Delay tool settings under `epicscope.veAnalyzer.tableTools.v1`;
- no guessed VE/Target defaults are persisted before real mutable VE/Target adapters exist;
- Lambda defaults match the frozen reference: 5 ms adjustment step, Smooth 0.5, linear 1D, bilinear 2D, interpolation strength 1 with clamp enabled, Brush +5 / radius 1 / strength 0.7 / smooth falloff;
- the toolbar now exposes explicit H, V and 2D interpolation commands rather than hiding direction inside one fixed command;
- right-click `+ / −`, Smooth, H/V/2D interpolation or Brush opens a compact contextual configuration popover;
- Brush wheel radius changes update the same persisted preference owner;
- pins, selection/anchor and active Brush are still session-only interaction state and never persisted;
- browser acceptance verifies right-click step configuration is persisted and used by subsequent edits.

The contextual configuration is deliberately a lightweight shared-table presentation surface, not the prototype floating-window framework.

## Lifecycle cleanup

The shared table controller already scopes document pointer/keyboard listeners to active gestures, disconnects its delay-host observer while inactive and cancels active edits on authority/lifecycle replacement. One remaining remount case was closed at the application boundary: shell disposal now deactivates Analyzer before replacing its DOM, allowing an active VE domain to disconnect its observer and gesture state even when the whole app shell is remounted without an intervening navigation event.

## Current-main synchronization

The reconciliation branch was merged forward to current `main` after PR #465 landed. The merge base is `8fb99c0099408b74330d6468868424f1b94b05f5`; the branch is ahead of main and no longer behind it. This keeps the v50 work isolated while ensuring final testing includes the production Shift-click fix and its new regression coverage.

## Current validation gate

A full Web CI run is required on the current branch head after persisted tool configuration and lifecycle cleanup. It must pass:

1. TypeScript type-check.
2. Full Vitest suite, including uneven-axis interpolation tests.
3. Production build.
4. Staged Chromium acceptance.
5. Worker-disabled fallback Chromium acceptance.
6. Current-main Shift-click/direct-typing live preview and native acceptance.
7. Shared v50 selection/editing/Brush/undo/pin/scope acceptance.
8. Persisted right-click tool configuration and explicit H/V/2D controls.
9. Visual reversed-row Arrow navigation acceptance.
10. Existing Result View, Logger context, source-integrity, observability and Diagnostics regressions.

## Remaining work after this gate

- responsive/visual browser acceptance at representative desktop widths and table layouts;
- user hands-on UI test from this branch;
- fixes from that manual acceptance, if any, followed by the full gate again;
- final Codex branch audit against current `main`, narrowly fixing justified defects/cleanup and deferring speculative redesign;
- final revalidation, PR inspection and explicit merge approval.

`main` remains untouched by the v50 changes.
