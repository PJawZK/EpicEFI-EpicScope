# VE Analyzer v50 reconciliation status

Branch: `ui/ve-analyzer-v50-reconcile`

Base/product authority: `main` at `dd8381988cd61fb3b5ea4befc48cfcf36d2a815c`.

This branch is deliberately isolated from `main`. It is the post-Codex reconciliation branch for the frozen v50 VE Analyzer presentation and shared table interaction work. No merge to `main` is authorized before automated validation, user UI acceptance and a final Codex branch audit.

## Replayed against current main

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
- current expanded browser runner retains all Codex/source-integrity/observability checks and adds shared-v50 interaction acceptance.

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

## Current validation gate

The Logger scope/range reconciliation must now pass the same full gate:

1. TypeScript type-check.
2. Full Vitest suite.
3. Production build.
4. Full staged Chromium acceptance.
5. Full Worker-disabled fallback acceptance.
6. Historical Lambda editing/native pointer-keyboard acceptance.
7. Shared v50 Lambda interaction acceptance.
8. Existing Result View acceptance, including Lambda Delay and neutral fallback semantics.
9. Logger retained-context/source-extent acceptance.
10. v50 selected-scope `Open in Logger` acceptance.

Any failure is reconciliation evidence and must be corrected on this branch.

## Remaining reconciliation work after this gate

- production preference ownership for table editing tools;
- final lifecycle/teardown cleanup if current ownership requires it;
- spacing-aware monotone/PCHIP interpolation;
- explicit visual Up/Down keyboard acceptance with reversed load-row presentation;
- responsive/visual acceptance;
- user hands-on UI test;
- final Codex branch audit, fixes/revalidation and explicit merge approval.

`main` remains untouched by these v50 changes.
