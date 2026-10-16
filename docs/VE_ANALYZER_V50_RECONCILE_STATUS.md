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

## First reconciled green baseline

Web CI run `38979825194` passed after the current-main replay and before the semantic delay-surface cleanup:

- TypeScript type-check: pass;
- full Vitest suite: pass;
- production build: pass;
- staged Chromium acceptance: pass;
- Worker-disabled fallback acceptance: pass;
- historical Lambda editing/native pointer-keyboard acceptance: pass;
- shared v50 Lambda interaction acceptance: pass;
- current-main observability/source-integrity/Diagnostics/readiness acceptance retained.

This established that the v50 presentation/interaction replay itself was compatible with the post-Codex baseline before deeper ownership cleanup.

## Semantic Lambda surface checkpoint

The deferred Lambda ownership work has now begun from that green baseline.

### Dedicated delay-surface authority

The semantic delay snapshot now carries:

- broad Analyzer `revision` for compatibility/evidence;
- dedicated `authorityGeneration` for the editable Lambda-delay surface;
- rows/cols;
- RPM/load axes;
- working values.

`authorityGeneration` advances when the editable Lambda surface itself changes or is replaced/withdrawn, rather than on every unrelated Analyzer invalidation. Shared table transactions use this generation for stale-commit rejection.

### Result View no longer reconstructs Lambda authority from DOM

v7 remains the sole Result View presentation owner, but its Lambda surface now comes from the semantic delay owner snapshot. It no longer reconstructs RPM/load axes or working delay values from rendered headers, `dataset.delayValue`, or cell text.

The existing v7 interpolation/display/heat policy remains in place; only the source of Lambda authority changed.

## Current validation gate

The semantic delay-surface changes must pass the same full gate before work proceeds into Logger/range ownership:

1. TypeScript type-check.
2. Full Vitest suite.
3. Production build.
4. Full staged Chromium acceptance.
5. Full Worker-disabled fallback acceptance.
6. Historical Lambda editing/native pointer-keyboard acceptance.
7. Shared v50 Lambda interaction acceptance.
8. Existing Result View acceptance, including Lambda Delay and neutral fallback semantics.

Any failure is reconciliation evidence and must be corrected on this branch.

## Remaining reconciliation work after this gate

- authoritative Logger whole-source extent and explicit range handoff for the v50 scope navigator;
- production preference ownership for table editing tools;
- final lifecycle/teardown cleanup if current ownership requires it;
- spacing-aware monotone/PCHIP interpolation;
- explicit visual Up/Down keyboard acceptance with reversed load-row presentation;
- responsive/visual acceptance;
- user hands-on UI test;
- final Codex branch audit, fixes/revalidation and explicit merge approval.

`main` remains untouched by these v50 changes.
