# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production branch: `main`

Current integration candidate branch:

`integrate/points-2-11-clean`

Current integration PR:

PR #462 — **Integrate Analyzer ownership and correctness fixes through point 11**

Current PR #462 head before this documentation update:

`088ac51a801ab35496d02abab78fec1bfb8e79a7`

The branch is based directly on production `main`; it is intentionally not a continuation of the divergent temporary branch history.

Hosted production application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

PR preview pattern:

`https://pjawzk.github.io/EpicEFI-EpicScope/previews/pr-462/`

This file is the present-tense continuation authority. `DOCUMENTATION_MAP.md` defines how to interpret historical/reference documents. If older wording conflicts, use current `main`, this handoff, the relevant subsystem authority and current browser/runtime evidence.

## Current project position — 2026-10-15

- **Logger** — mature functional reference. Broad performance/micro-optimization work remains paused unless a measured regression appears.
- **Histogram** — generic research-parity checkpoint closed for the approved scope. Table Generator, Distribution, Scatter and Math Channels are mature unless field use exposes a concrete correctness gap.
- **Analyzer** — current ownership/correctness/performance cleanup through points 1–11 has been implemented and reconstructed onto the clean PR #462 integration branch. Browser acceptance is still required before merge.
- **VE Analyzer** — current highest-value active maturity target. Session retention, retained-primary evidence reuse, semantic invalidation, active-domain routing and cooperative analysis are in the integration candidate. One Result View authority defect remains open and currently blocks acceptance of PR #462.
- **Diagnostics / observability** — architecture/research work is documented separately; implementation should begin only after the current correctness/performance baseline is stable.
- **MLG v3** — researched compatibility extension, not yet implemented; v1/v2 remain production support.
- **Linux production implementation** — future work after Web maturity/cleanup.

## Repository and branch state

Historical remote-branch cleanup was completed earlier; old branches are not knowledge stores. Recover old implementation detail from Git history/merged PRs when needed.

The current active integration work is deliberately isolated on `integrate/points-2-11-clean` / PR #462. Do not merge PR #462 until the current Result View defect is fixed and browser acceptance is repeated on the exact resulting SHA.

The temporary source branch `temp/epicscope-fixes-points-1-2-20261015` remains historical evidence for the points work. Its implementation was reconstructed onto current `main` instead of merging its divergent ancestry wholesale.

## Documentation authority map

- `HANDOFF.md` — present-tense continuation authority.
- `FIX_PLAN.md` — consolidated correctness/performance work list and scope boundaries.
- `POINTS_5_11_INTEGRATION_REVIEW.md` — clean-integration review/evidence for points 5–11.
- `OBSERVABILITY.md` — planned observability/flight-recorder architecture authority.
- `research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md` — efficiency/performance implementation research for observability.
- `DOCUMENTATION_MAP.md` — document authority/history classification.
- `PRODUCT.md` — current product contract.
- `ROADMAP.md` — current sequence/status.
- `ANALYZER.md` — Analyzer family authority.
- `HISTOGRAM.md` — Histogram authority.
- `VE_ANALYZER.md` — VE algorithm/evidence/product contract.
- `VE_ANALYZER_WORKBENCH.md` — VE UI/workflow contract.
- `PREPOPULATED_WORKSPACES.md` / `STARTER_SYSTEM_VALIDATION.md` — Logger starter/workspace authority.
- `TS_SHIM_STATUS.md` — current live-source validation authority.
- `research/STATUS.md` — living research-to-product disposition.

Literal INI/MSQ/channel/table names remain preserved in user-facing behavior. Semantic roles may guide selection internally but must not rename source data.

## Approved visible workflow

Primary:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Histogram:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

VE Analyzer:

> **Load INI + MSQ + Log → select VE/target tables → verify actual mixture/RPM/load → qualify → discover/load lambda delay → activate working delay table → Run Analysis → review evidence/proposal**

Load Data order:

1. Load INI
2. Load MSQ
3. Open Log
4. Unload Log
5. Connect Shim

INI and MSQ are independent application resources and survive source transitions.

## Source/runtime topology

Validated topology:

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
      ↓
ts_shim
      ↓ LAN
EpicScope same-origin Vite proxy
      ↓
Logger / Analyzer / Histogram
```

Stable workspace assignments normalize between canonical `ini:*` identities and matching raw Shim identities. Source transitions must never reapply starter templates, resurrect deleted channels or create raw + `ini:*` duplicate traces.

The Pi Zero 2 W phone-hotspot workflow is validated: Pi and laptop can share the phone hotspot for `ts_shim`, and the Pi returns to the configured home network when the hotspot is disabled.

## Logger checkpoint

Mature behavior includes MLG v1/v2 staged import, CRC/source diagnostics, large-log reuse, INI-backed channel binding, reusable workspaces, multi-pane Logger, A/B ranges, stable recorded/Shim channel identity, semantic starters, unavailable-channel handling and retained-memory/performance/runtime diagnostics.

Starter invariant:

- **Layout** = geometry.
- **Starter template** = semantic recipe.
- **Workspace** = ordinary user-owned state.

A starter resolves once. Later source transitions normalize identities only.

Do not resume broad Logger/performance micro-optimization without a concrete measured problem.

## Histogram checkpoint

Generic Histogram research parity is closed for the approved scope.

Current mature surfaces are Table Generator, Distribution, Scatter and Math Channels. Logger owns the authoritative timeline; Histogram reuses the complete timeline shell.

Point 9 on PR #462 adds explicit, recoverable persistence-failure feedback for saved Histogram/Math state without replacing the existing storage/cache owners.

## Analyzer checkpoint — integrated points 1–11

The clean integration candidate preserves the current Codex-era ownership model. Do **not** restore older controller files wholesale or roll back the points 5–11 architecture to fix local VE presentation defects.

### Point 1 — large-log correctness

Complete and already represented on production history before the clean integration reconstruction.

- Removed sample-sized argument spreads in VE, Fueling and Ignition large evidence/segment paths and VE visit extrema.
- >320k continuous-valid-sample regressions are retained in the clean integration.

### Point 2 — VE session authority

Complete in the integration candidate.

- Unchanged context/tune updates preserve working delay, retained primary result and proposal.
- Real source/catalog/sample-count/validity/tune/selected-scope changes invalidate conservatively.
- Existing generations reject stale asynchronous completions.
- Logger → Analyzer navigation preserves completed VE session authority.

The Analyzer-entry loop exposed by this preservation work was traced to the old global channel decorator assigning a preferred AFR channel absent from a hidden selector and dispatching `change` despite no real value transition. The narrow loop guard was retained, and point 5 subsequently removed the global decorator ownership itself.

### Point 3 — retained primary evidence

Complete.

- VE v2 owns `getPrimaryAnalysis()` and publishes borrowed read-only references to the current completed analysis.
- Cell evidence consumes the retained primary evidence/proposal instead of performing a second full-log VE analysis.
- No duplicate trace load / qualification / evidence-map / proposal run is required to open a cell.

### Point 4 — semantic detail invalidation

Complete for retained primary/cell-detail lifetime.

- Result View changes are presentation-only with respect to primary analysis identity.
- Cell-detail cache invalidation follows semantic owner notifications rather than broad root input/change observers.
- Popup detail/strongest-visit work is reusable for the current primary analysis.

Important: this point did **not** prove that the visible Result View cell text itself remains source-authoritative. The current open Result View defect is documented below.

### Point 5 — selector / DOM ownership

Complete.

- Analyzer and Histogram document-wide option-decoration scans/observers were removed.
- Existing selector owners create/label/validate their own options.
- VE actual-mixture eligibility/default correction is selector-local.
- No replacement global observer/listener/lifecycle wrapper was introduced.

### Point 6 — active Analyzer routing

Complete.

- Only the selected active Analyzer domain receives expensive work.
- Hidden controllers retain latest pending input and defer calculation until activated.
- Deactivation/real replacement advances existing generations so obsolete completions/errors cannot update a newer session.
- Completed VE authority survives navigation where semantics remain unchanged.

### Point 7 — CPU/correctness cleanup

Complete for the profiled scope.

- VE robust weighted estimates prepare/sort observations once and reuse the sorted input for median/P10/P90.
- Channel-role normalization is cached by immutable definition identity.
- Idle/AE extrema use bounded iteration rather than argument spreads.
- Event-table preparation is capped to the displayed 200 rows while summaries retain full evidence.
- Event-envelope percentiles sort each bin once and reuse it.

No unprofiled rolling-window/recovery rewrite was performed.

### Point 8 — cooperative VE work

Complete for the profiled VE evidence pipeline.

- VE calculation uses cooperative bounded batches/yields rather than adding an unjustified new worker/lifecycle model.
- Progress and explicit Cancel are present.
- Existing generation/activity ownership performs cancellation/stale rejection.
- This is primarily a responsiveness/cancellation improvement; total analysis latency is not claimed to be lower in every environment.

### Point 9 — persistence failure visibility/recovery

Complete.

- Distribution, Scatter, Table Generator presets/filters and Math Channel save/delete paths surface storage failure.
- Failed changes remain usable in current-session state and expose Retry.
- Existing storage schemas, keys and caches remain authoritative; no automatic retry loop or parallel persistence architecture was added.

### Point 10 — analysis trace-load errors

Complete.

- Range comparison, Tune correlation, Boost, specialized suite, Ignition and Fuel/Injector handle current-generation trace-load rejection at their existing controller boundaries.
- Obsolete/hidden failures remain ignored through point-6 guards.
- Current failures hide stale output, present safe actionable error text and allow retry through the existing control.

### Point 11 — transactional MSQ replacement

Complete.

- The last valid tune/session stays authoritative while a replacement is read, parsed, structurally validated and normalized.
- Failed replacement preserves the old tune and valid VE working delay/result/proposal/evidence.
- Latest selection wins through an app-shell generation token, including when the latest selection fails.
- A successful accepted replacement publishes the new model once through the existing tune owner and invalidates dependent analysis normally.
- This remains a transactional MSQ replacement change only; it is not a general file-loading refactor.

### Point 12 — telemetry async conversion/socket identity

Not implemented. Remains a lower-priority, reproduction-gated candidate. Existing ArrayBuffer transport and frame-generation guards reduce exposure. Do not implement without a controlled deferred-conversion/reconnect reproducer.

## Validation state of the clean integration

PR #462 was reconstructed on current `main` specifically to avoid reintroducing divergent branch ancestry and to preserve production regression tests.

The clean integration passed CI at earlier heads. Source-branch validation for the included points was extensive (automated tests, production build/typecheck and focused Chromium checks), but browser acceptance of the exact integrated build remains mandatory.

The owner tested the PR #462 preview and confirmed the major integrated behaviors remain functional, including Analyzer entry and VE session/navigation behavior. However, the preview also reproduced the open Result View value-loss defect described below. Therefore PR #462 is **not accepted for merge yet**.

## Open blocker — VE Result View uses mutable presentation as source state

This is the immediate continuation task.

### Confirmed primary failure

Current `ve-analyzer-view-v7.ts` reparses each cell from presentation state on every Result View change:

```ts
const metrics = parseVeRenderedCellMetrics(
  cell.title,
  main.textContent ?? '',
);

main.textContent = veResultDisplay(metrics, view, delayMs).text;
```

This makes the output of one Result View become the input/source for the next Result View.

Example: an evidence cell whose original VE is 60 can display `18` in Samples, then `Moderate` in Confidence; when the next view reparses `Moderate`, the numeric original VE is no longer recoverable from visible text. This is a confirmed code-level failure, not an I/O/cache issue.

### Why cells fail irregularly

Measured proposal cells often include `Current <VE>` in their title, so the parser can sometimes recover the original VE even after visible text changes.

Weak/withheld/evidence-only cells do not consistently encode the original VE in their title. Those cells depend much more heavily on whatever is currently visible, so corruption varies across cell classes.

### Second presentation writer in the full app

`ve-analyzer-ui-refinements.ts` independently compacts measured proposal text after render, e.g. changing a visible `60 → 63` form to `63`. It also observes Analyzer subtree child mutations for its presentation refinements.

Therefore `main.textContent` is categorically not authoritative VE state: multiple presentation layers deliberately modify it.

This refinement code predates the Codex points work and is not treated as the newly introduced root cause, but it proves that a Result View fix must not depend on timing of visible-text capture.

### Why the existing tests missed it

The restored Result View unit test exercises the pure formatter repeatedly against one pristine metrics object. It proves fallback formatting, not the browser's destructive sequence of render → reparse rendered output → render another view.

The current VE Chromium lifecycle test cycles Result Views, but its assertions cover retained primary identity, trace-read count and popup/detail identity. It does not assert visible VE table values through each view.

The controller-level lifecycle environment also does not reproduce the complete app-shell presentation stack with `installVeAnalyzerUiRefinements()` active.

So CI/browser component checks can pass while the full preview still loses displayed values.

### Confirmed heat-map issue

Fallback/base values are marked by the formatter as `scaleMode: 'base'`, but current v7 assigns neutral `--ve-cell-level: 0.5` for that path instead of restoring the original VE base heat level.

When a Result View has no real metric for a cell, both the original VE value and its original VE-table heat intensity should be preserved.

### Lambda Delay exception

Lambda Delay is semantically different from Samples/Confidence/Spread. A cell with no VE evidence can still have a valid interpolated delay metric from the working delay surface.

Rule:

> If the selected Result View has a real metric for the cell, display that metric. If it has no metric, fall back to the original VE value/base heat level.

A valid interpolated delay is a real metric even when VE evidence is absent.

### Remaining DOM-derived delay debt

`readDelaySurface()` currently reconstructs delay information from rendered headers/cells/datasets. This is not the cause of the current VE value-loss bug, but it remains presentation-derived authority debt because the Codex VE owner already owns `workingDelayTable`.

Do not broaden the immediate Result View repair into a delay-ownership refactor. Record the debt and address it separately after the current blocker is closed.

### Load-axis orientation trap

App-level VE UI refinement physically reverses rendered load rows. Do not map a DOM row position directly to `primaryAnalysis.cells[row * cols + col]`.

Any source-authoritative Result View mapping must use a stable cell index assigned at render time or model coordinates mapped back to authoritative axes.

### v8/v9 boundary

Current investigation found no independent Result View overwrite in v8 or v9. The problematic ownership region is:

```text
v2 authoritative table render
        ↓
v7 Result View presentation
        ↕
app-level VE UI refinements
        ↓
pure Result View formatter
```

## Required forward fix — adapt Codex-era owners, do not restore old files

This is an explicit project constraint.

**Do not restore the pre-Codex VE files or replace current point-5–11 implementations with older branch versions.** Keep the current Codex-era owners and adapt them forward.

Recommended repair:

1. In current v2, where the owner already has `entry.numericValues[index]`, stamp immutable model-derived metadata on each freshly created VE cell, e.g.:

   ```ts
   td.dataset.veCellIndex = String(index);
   td.dataset.veCurrentValue = String(current);
   td.dataset.veBaseLevel = String(baseLevel);
   ```

2. In current v7, stop using mutable `main.textContent` as the `current` VE source. Parse Result View metrics against `cell.dataset.veCurrentValue` (or another explicit owner-provided stable model value).

3. A per-cell `WeakMap` may still cache parsed title/evidence metrics to avoid repeated regex work, but it must not be the only authority for original VE because capture timing can race with presentation mutators.

4. When `display.scaleMode === 'base'`, restore `cell.dataset.veBaseLevel`; do not force neutral 0.5.

5. Preserve legitimate real metrics, including interpolated Lambda Delay, even for cells without VE evidence.

6. Do not use DOM row order as model index because app-level row orientation can differ from model order.

7. Keep all points 5–11 architecture, cooperative analysis, activity routing, generation guards, retained primary evidence, persistence/error handling and transactional replacement behavior intact.

## Required Result View regression coverage

Add a real Chromium regression that checks visible cell values, not only primary identity/popup lifetime.

Test at least these cell classes:

| Cell class | Required coverage |
|---|---|
| measured | title contains current/proposed data |
| weak / withheld | candidate evidence but no guaranteed `Current` title field |
| evidence-only | evidence metrics without proposal |
| no-evidence | original VE only |

Cycle repeatedly:

```text
Proposed VE
→ VE change
→ VE change %
→ Mixture error %
→ Samples
→ Evidence weight
→ Confidence
→ Spread %
→ Lambda delay
→ Proposed VE
```

Assertions must compare against model-derived `TuneEntry.numericValues`, not against whatever was visible in the preceding Result View.

Also verify:

- fallback always returns the original VE value;
- base heat-map intensity returns exactly;
- measured/weak/withheld calculations remain based on original VE;
- valid delay metrics remain visible where applicable;
- repeated cycles are stable;
- primary-analysis identity is unchanged by presentation-only switching;
- no additional trace loading occurs;
- full integration with `installVeAnalyzerUiRefinements()` active passes, not only a bare VE controller fixture.

## Observability / diagnostics continuation

A separate planned feature track consolidates current Diagnostics, Performance and Report systems into one bounded observability/flight-recorder architecture.

The implementation authority is `docs/OBSERVABILITY.md`; performance-specific pre-build research is in `docs/research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md`.

Important implementation constraints already established:

- one authoritative bounded observability/session stream;
- specialized reports are projections rather than parallel stores;
- packed/efficient hot-path representation, separate critical/detail retention, pre-insertion coalescing and backpressure;
- numeric stable IDs for common fields, monotonic timestamps and primitive operation IDs;
- owner-provided revisions/fingerprints; no arbitrary state hashing;
- event/boundary-driven snapshots, not broad polling;
- O(1) streaming anomaly state; expensive causal analysis deferred;
- batched/chunked persistence rather than per-event writes;
- previous-session black-box tail plus anomaly/error context windows;
- recursion/self-observation protection;
- explicit observability-on versus minimal/off overhead benchmarks;
- no automatic runtime mutation/repair from anomaly detection initially.

Do not begin this implementation until the current PR #462 correctness baseline is browser-accepted and stable.

## Immediate continuation order

1. Fix the open Result View source-authority defect by adapting current v2/v7 forward as specified above.
2. Add the full-stack browser regressions for visible Result View values and base heat levels.
3. Re-run CI and deploy a fresh PR #462 preview from the exact resulting SHA.
4. Owner browser acceptance: load the real INI/MSQ/log workflow, run VE, cycle all Result Views repeatedly, verify untouched/base values, evidence states, heat map, Logger round-trip/session retention and general Analyzer responsiveness.
5. Only after browser acceptance, merge/reconcile the clean points 1–11 integration with `main`.
6. Point 12 remains reproduction-gated and lower priority.
7. After the correctness/performance baseline is stable, begin the observability implementation plan from its documented step 1.

## Acceptance rule

For VE/Analyzer runtime work, CI is necessary but not sufficient. Browser behavior on the actual integrated build is acceptance authority.

Do not claim the Result View defect is fixed until the exact PR preview is browser-tested after the source-authority repair.

Never automatically write or Burn to the ECU. Original VE/tune data, Analyzer evidence/proposal and any user-reviewed application result remain distinct states.
