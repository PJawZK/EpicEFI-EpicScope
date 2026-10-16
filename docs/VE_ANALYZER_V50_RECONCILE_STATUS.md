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

## First validation gate

Run current Web CI against this branch:

1. TypeScript type-check.
2. Full Vitest suite.
3. Production build.
4. Full staged Chromium acceptance.
5. Full Worker-disabled fallback acceptance.
6. Historical Lambda editing/native pointer-keyboard acceptance.
7. Shared v50 Lambda interaction acceptance.

Any failures are reconciliation evidence and must be corrected on this branch before deferred ownership work.

## Still deferred until green reconciled baseline

- semantic Lambda Delay Result View surface/axes and removal of v7 DOM reconstruction;
- a dedicated delay-surface authority generation separate from broad Analyzer session revision;
- authoritative Logger whole-source extent and explicit range handoff for the v50 scope navigator;
- production preference ownership for table editing tools;
- final lifecycle/teardown cleanup if current ownership requires it;
- spacing-aware monotone/PCHIP interpolation;
- explicit visual Up/Down keyboard acceptance with reversed load-row presentation;
- responsive/visual acceptance and user hands-on UI test.

`main` remains untouched by these v50 changes.
