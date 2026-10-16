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
- PR #465's production Lambda Delay Shift-click selection fix and expanded native/browser acceptance are now present in this branch as part of the current-main merge.

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

## Current-main synchronization

The reconciliation branch was merged forward to current `main` after PR #465 landed. The merge base is now `8fb99c0099408b74330d6468868424f1b94b05f5`; the branch is ahead of main and no longer behind it. This keeps the v50 work isolated while ensuring final testing includes the production Shift-click fix and its new regression coverage.

## Remaining reconciliation work

- production preference ownership for table editing tools;
- final lifecycle/teardown cleanup if current ownership requires it;
- spacing-aware monotone/PCHIP interpolation;
- explicit visual Up/Down keyboard acceptance with reversed load-row presentation;
- responsive/visual acceptance;
- user hands-on UI test;
- final Codex branch audit, fixes/revalidation and explicit merge approval.

Before user UI acceptance, rerun the full Web CI gate on the current synchronized branch head. `main` remains untouched by the v50 changes.
