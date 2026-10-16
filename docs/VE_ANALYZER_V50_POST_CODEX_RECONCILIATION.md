# VE Analyzer v50 post-Codex reconciliation map

Branch: `ui/ve-analyzer-v50-port`

Current product authority: `main` at `dd8381988cd61fb3b5ea4befc48cfcf36d2a815c` (PR #464 merged).

Current v50 checkpoint before reconciliation: `4cf563cffbd4d5351c1262369b156dff06747417`.

Common merge base: `8890498d96787582d59ac7ee2716bfbf8b38b2bd`.

At audit start the v50 branch is 60 commits ahead and 9 commits behind `main`. This document is branch-local planning/evidence only; it does not authorize or perform a merge to `main`.

## Reconciliation rule

Reconcile semantically, not mechanically. Current `main` wins for ownership/lifecycle/observability contracts. The v50 branch wins only for the accepted v50 interaction/presentation behavior that remains compatible with those contracts. Do not restore superseded wrappers or parallel state merely because they still exist in the older branch history.

## Current-main changes that directly affect v50

### 1. Stable VE entry now carries observability

Current `main` exposes `createVeAnalyzerView(observability?: ObservabilityRecorder)` and passes the recorder through `createVeAnalyzerViewV9(observability)` and `installVeAnalyzerCellEvidence(..., observability)`.

The pre-reconciliation v50 entry still has a zero-argument factory and therefore must not simply replace current `main`'s entry during replay.

Required reconciled shape:

- retain the optional `ObservabilityRecorder` argument;
- pass it through the current v9 chain;
- pass it to the current Cell Evidence owner;
- then install the v50 presentation and shared table interaction layers without creating another observability authority.

### 2. Do not restore the old Result Heat wrapper

Current `main` intentionally removed the outer `installVeAnalyzerResultHeat` controller wrapper. v7 is now the sole Result View presentation owner and performs text/metadata/missing/heat in one table pass. `ve-analyzer-result-heat.ts` is a pure policy helper used by that owner.

The old v50 entry still installs `installVeAnalyzerResultHeat(...)`. Reconciliation must drop that installation. Re-adding it would reintroduce the superseded selection listener / observer / queued correction pass and violate current presentation ownership.

### 3. v2 is now a stronger domain/readiness/observability owner

Current `main` v2 now owns:

- VE owner observability evidence/operations;
- readiness state and readiness listeners;
- retained-primary publication evidence;
- current context/tune/session invalidation semantics;
- the existing transactional homogeneous delay edit command.

The v50 branch adds the heterogeneous `editVeDelayCellValues(...)` primitive and uses it for the shared Lambda editor. Replay that capability on top of current v2; do not replace current v2 with the old branch version and do not move readiness/owner evidence into a new wrapper.

### 4. Wrapper chain still exists but responsibilities changed

Current `main` still forwards the stable controller contract through v3-v9, including `editDelayCells`, `sessionRevision`, primary-analysis access and readiness. Codex removed/condensed substantial wrapper-owned presentation work, but did not eliminate the chain.

Therefore:

- do not create v10 merely for reconciliation;
- preserve current wrapper responsibilities first;
- attach v50 through focused installers/adapters;
- only retire wrappers later if a separate cleanup proves parity.

### 5. Current Result View ownership makes the old DOM debt easier to isolate

`readDelaySurface()` in v7 remains documented debt: Lambda Delay Result View still reconstructs the surface from DOM rather than semantic owner state. This debt survived Codex and is now explicitly safe to address after the branch is replayed onto current `main`.

Reconciliation target:

- extend the semantic delay snapshot/capability with axes + values + an authority generation;
- make v7 consume that semantic surface;
- delete `readDelaySurface()` only after browser parity.

Do not move Result View ownership out of v7 while doing this.

### 6. Logger/source contract improved, but the v50 scope-strip gap still exists

Current `LoggerAnalysisContext` still exposes:

- source identity/sampleCount/revision;
- retained traces/channels;
- source-bound `loadTraces(...)`;
- `openSamplesInLogger(...)`;
- A/B times and saved ranges.

It still does not expose an authoritative whole-source time extent or an explicit `openRangeInLogger(startMs,endMs)` handoff. `LoggerPageController` has source/sample state and `focusAnalysisTimes(...)`, but that is not the same contract.

Therefore the v50 scope navigator must continue to avoid pretending loaded trace bounds are authoritative Full Log bounds. Add a proper Logger contract during reconciliation rather than faking the UI.

### 7. App-level presentation ownership was cleaned up

Codex moved/renamed analyzer presentation helpers and removed broad hidden installers/observers. `ve-analyzer-ui-refinements.ts` is now much smaller and focused on VE header help/cell-detail behavior rather than owning the workbench layout.

This supports the v50 direction: the v50 presentation installer can own its layout transformation, but it must preserve current app-level help/detail behavior and must not restore deleted generic MutationObserver-based refinement layers.

### 8. Row reversal remains accepted behavior

Current browser tests still explicitly state that the app-level VE presentation reverses load rows and verify Result View mapping by semantic coordinates rather than rendered row order. The v50 shared table controller already learned this lesson in real-browser testing by preserving existing semantic `data-delay-row`/`data-delay-col` coordinates.

Post-reconciliation acceptance must explicitly verify visual Up/Down keyboard semantics as well as semantic edit coordinates.

### 9. Observability is now one recorder/session architecture

Current `main` contains the D-058 observability recorder/session, owner evidence, runtime/parser/performance projections, persistence/recovery and Diagnostics view. v50 must not add a second diagnostics stream or independent persistent instrumentation.

Any new v50 owner/lifecycle evidence should use current owner-evidence/recorder boundaries only where useful. Presentation-only state such as selection/pins should remain session-local and normally does not need observability records.

## File-level replay route

### Reapply on top of current main

- `apps/web/src/pages/ve-analyzer-v50-presentation.ts`
- `apps/web/src/pages/ve-table-interaction.ts`
- `apps/web/src/pages/ve-table-interaction-dom.ts`
- `apps/web/src/pages/ve-analyzer-delay-edit-owner.ts`
- `apps/web/src/pages/ve-analyzer-delay-table-interaction.ts`
- `apps/web/src/styles/ve-analyzer-v50-port.css`
- `apps/web/src/styles/ve-table-interaction-dom.css`
- focused v50 tests/docs

These are branch additions and can be replayed with adaptation to current controller/observability ownership.

### Merge carefully, current main first

- `apps/web/src/pages/ve-analyzer-view.ts`
  - preserve `ObservabilityRecorder` argument and current Cell Evidence install;
  - add v50 presentation + delay interaction;
  - do **not** reinstall outer Result Heat wrapper.

- `apps/web/src/pages/ve-analyzer-view-v2.ts`
  - preserve all current owner/readiness/observability changes;
  - add heterogeneous delay edit application only.

- `apps/web/src/pages/ve-analyzer-view-v5.ts`
  - preserve current wrapper/ownership changes;
  - retain legacy-input yielding while shared owner is active and lifecycle-safe cancellation compatibility.

- `core/analysis/ve-delay-table-editing.ts`
  - reapply heterogeneous batch primitive against current core file and rerun all old + new tests.

- `scripts/browser/acceptance.mjs`, `tests/web/ve-delay-editing.browser.mjs`
  - current main has many additional integration/observability/source-integrity checks; append v50 checks without replacing current runner content.

- `.github/workflows/web-ci.yml`
  - retain current main workflow; only keep the v50 branch trigger if still useful during reconciliation. Do not change product CI policy merely for the port.

### Do not replay obsolete branch behavior

- outer `installVeAnalyzerResultHeat(...)` installation;
- any old assumptions that `createVeAnalyzerView()` takes no observability recorder;
- old generic UI-refinement ownership that Codex removed;
- direct localStorage ownership for future table-tool settings;
- fake Full Log bounds from loaded traces;
- action-button heuristics as the long-term authority-generation model.

## Reconciliation implementation sequence

1. Create a fresh reconciliation branch from current `main`; keep `ui/ve-analyzer-v50-port` as the frozen pre-reconciliation evidence/checkpoint.
2. Replay the branch-added interaction engine, DOM shell, Lambda owner adapter and v50 presentation files first, with no stable entry hookup yet.
3. Reapply the heterogeneous Lambda batch primitive and v2 owner application on top of current `main`.
4. Reconcile v5 legacy/shared-input yielding.
5. Reconcile the stable VE entry with current observability and v7 Result View ownership, then attach v50 presentation/shared Lambda interaction.
6. Reapply/merge tests into the expanded current-main browser runner.
7. Run typecheck, unit tests, build and full staged/fallback Chromium acceptance before further ownership cleanup.
8. Only from that green reconciled baseline, implement the deferred semantic work: delay surface generation/snapshot, v7 semantic Lambda Result View, Logger full-source/range handoff, preference ownership and teardown.
9. Finish branch-local UI/interpolation/keyboard/responsive work.
10. Run automated + manual user acceptance, then Codex final audit. No merge to `main` before those gates.

## Immediate conflict expectations

High-conflict files: `ve-analyzer-view.ts`, `ve-analyzer-view-v2.ts`, `ve-analyzer-view-v5.ts`, browser acceptance runner.

Low-conflict additions: shared table interaction modules, v50 presentation module, focused styles/tests.

Architectural conflict to avoid: restoring pre-Codex presentation wrappers when current `main` deliberately consolidated ownership.

## Main remains untouched

All reconciliation work must stay off `main` until:

- the reconciled branch is green;
- deferred ownership work is complete;
- manual v50 UI acceptance is complete;
- Codex performs the final branch audit;
- any required fixes are revalidated;
- the final integration PR is explicitly approved for merge.
