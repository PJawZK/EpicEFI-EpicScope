# VE Analyzer v50 — leftover issue route

Branch: `ui/ve-analyzer-v50-port`

Purpose: detailed source-review routing after the first v50 production port, shared table-interaction extraction, Lambda Delay binding, and initial hardening pass. This is a routing/audit document, not evidence that the branch has passed build/typecheck/browser validation.

## Routing rules

Issues are split into four lanes:

- **Lane A — fix on this isolated UI branch before adding more surfaces**: local correctness/interaction problems whose ownership is already clear and whose fix does not require writable-tune architecture.
- **Lane B — validate first, then fix on this branch if reproduced**: behavior where browser/runtime evidence should decide the exact correction.
- **Lane C — post-Codex reconciliation / owner migration**: problems that intersect controller ownership, persistence, Logger contracts, Target 16/17 work, or future writable tune authority.
- **Lane D — accepted/deferred UX completion**: known missing v50 feature depth that should not block the current structural port.

## Lane A — fix before adding VE/Target editing

### A1. Interpolation must reject/skip non-finite source cells explicitly

Owner: `apps/web/src/pages/ve-table-interaction.ts`

`Smooth` and `Brush` explicitly pass reads through finite-value guards. `interpolate()` does not: its snapshot `read()` can cache `NaN` from a surface that represents an undefined cell as `NaN`. One undefined selected/boundary/support cell can therefore contaminate min/max, Hermite/bilinear math and the target value. The downstream surface may ignore a non-finite write, but the interaction engine can still mark the operation as touched and attempt a commit.

Route:

1. Make interpolation's read path return `number | undefined` or fail a row/selection segment cleanly when a required source value is non-finite.
2. Do not set `changed = true` until a finite target has actually been submitted.
3. Add tests for sparse/undefined Lambda cells in horizontal, vertical and 2D interpolation.

Priority: **high correctness**.

### A2. Programmatic VE rebuilds can leave v50 setup summaries stale

Owner: `apps/web/src/pages/ve-analyzer-v50-presentation.ts`

The compact summary chips are refreshed by root `input`/`change` listeners and once at install time. The underlying v2 controller also changes/selects values programmatically during `setContext`, `setTuneModel`, rebuild, automatic table/axis resolution and mixture-scale inference. Those updates do not have to dispatch DOM events.

Route:

- hoist `syncSetupSummaries()` to wrapper scope and call it after `setContext`, `setTuneModel`, `refresh`, and after initial install;
- keep user-event listeners for immediate typing/change feedback.

Priority: **high presentation correctness** because a stale summary can misrepresent the active analysis setup.

### A3. Roving focus instead of every table cell being a Tab stop

Owner: `apps/web/src/pages/ve-table-interaction-dom.ts`

`markCoordinates()` currently assigns `tabIndex = 0` to every editable cell. A 16×16 or larger calibration table becomes hundreds of sequential Tab stops. Arrow-key movement already exists, so the table should use a roving focus model: one active/anchor cell at `tabIndex=0`, other editable cells `-1`.

Route:

- keep one focusable cell (anchor, focused cell, or first cell when there is no anchor);
- update roving tabindex during selection/focus movement;
- retain arrow navigation and direct typing semantics;
- verify touch/mouse focus is not regressed.

Priority: **medium-high usability/accessibility**, and worth solving before the same controller is attached to VE/Target.

### A4. Stationary held Brush does not observe a later Shift state change

Owner: `apps/web/src/pages/ve-table-interaction-dom.ts`

Brush direction is updated from pointer events. While the pointer is stationary, the 90 ms held-spray timer reuses the last direction. Pressing/releasing Shift without moving the pointer therefore does not necessarily reverse the ongoing held spray.

Route:

- while a Brush stroke is active, track Shift through temporary keydown/keyup listeners or another gesture-scoped modifier owner;
- remove those listeners when the stroke ends/cancels;
- add browser coverage for reversing a held stationary Brush.

Priority: **medium interaction parity** with the frozen v50 Shift-reverse contract.

### A5. Explicit irregular-selection policy for 2D interpolation

Owner: `apps/web/src/pages/ve-table-interaction.ts`

Current 2D interpolation derives a bounding rectangle and boundary surface, then writes only selected cells. That gives irregular Ctrl/Cmd selections implicit bounding-rectangle semantics. It is deterministic, but it is not obvious to the user and is not explicitly part of the frozen contract.

Recommended route:

- require a complete rectangular selection for `axis: 'both'`;
- reject/no-op irregular 2D selections;
- preserve irregular selections for +/- / Smooth / Pin / Brush and 1D interpolation as applicable;
- add focused unit coverage.

Priority: **medium predictability**.

## Lane B — run the branch, then resolve from evidence

### B1. Build/typecheck/browser execution is still the largest unresolved risk

Owners: whole branch / acceptance harness.

No source review can substitute for executing:

- TypeScript strict build/typecheck;
- Vitest, including `tests/ve-table-interaction.test.ts` and delay editing tests;
- full browser acceptance;
- the new `ve-shared-table-interaction.browser.mjs` fixture;
- visual inspection against the frozen v50 reference.

Route: **do not begin VE/Target writable-surface binding before this checkpoint**.

### B2. Setup disclosure geometry needs real-browser inspection

Owners: `ve-analyzer-v50-port.css`, `ve-analyzer-v50-presentation.ts`.

At desktop widths the `<details>` bodies are absolute popovers. Below 1100 px they become `position: fixed` with a hard-coded `top: 112px`. The quick-control host also changes overflow behavior. Source inspection cannot prove that these do not overlap app chrome, clip, or create awkward scroll behavior in actual EpicScope layouts.

Route after browser run:

- inspect 1440/1280/1024/900-ish widths;
- if needed, anchor popovers through the existing app overlay/tool host rather than increasing CSS exceptions;
- avoid recreating the standalone floating-window framework.

### B3. Multiple native setup `<details>` can remain open simultaneously

Owner: v50 presentation.

This can produce overlapping compact popovers. It may be acceptable, but the frozen interaction feels more like one active compound-control surface at a time.

Route: validate real UX first. If overlapping panels are confusing, implement a tiny presentation-only “open one, close siblings” policy.

### B4. Table sizing/min-width behavior needs real table geometries

Owner: `ve-analyzer-v50-port.css`.

The branch changes the dominant table from fixed 42 px cells to `width:100%`, `table-layout:fixed`, `min-width:780px`. This should be checked with small, 16×16, and larger tables. Do not tune geometry from the 2×2 browser fixture alone.

## Lane C — post-Codex / production-owner reconciliation

### C1. Switch the legacy Lambda owner to the new heterogeneous one-pass primitive

Owners: `core/analysis/ve-delay-table-editing.ts`, `ve-analyzer-view-v2.ts`.

The core now has `editVeDelayCellValues(...)`, but v2 `applyDelayCellValues()` still deduplicates and then calls `editVeDelayCells()` once per edited cell, repeatedly cloning the table in local intermediate state. External publication remains atomic, but the hot operation is unnecessarily O(number-of-edits × table-size).

Route:

- import `editVeDelayCellValues` in the semantic owner;
- validate/apply the whole heterogeneous batch once;
- keep exactly one `invalidate()` and one publication;
- retain invalid-batch atomicity tests.

This is a small code change, but because it touches the legacy large controller and the branch still lacks executable validation, route it with the owner cleanup or immediately after validation.

### C2. Remove Lambda Result View DOM reconstruction

Owners: `ve-analyzer-view-v7.ts`, Lambda semantic owner/controller capability.

`readDelaySurface()` still reconstructs RPM/load axes and delay values from the rendered table (`textContent`, `dataset.delayValue`). The new shared editor does not extend this pattern, but the old Result View debt remains.

Route:

- extend the semantic delay snapshot with `rpmBins`, `loadBins`, values, and an authority/surface generation;
- have Result View interpolate from the semantic snapshot;
- delete `readDelaySurface()` and associated DOM parsing only after browser parity.

Priority: **high architectural cleanup before VE/Target shared editing becomes production architecture**.

### C3. Separate semantic session revision from delay-surface authority generation

Owners: v2 semantic owner, `ve-analyzer-delay-edit-owner.ts`, shared adapter.

`sessionRevision` currently changes for many Analyzer invalidations. It is useful as a stale-edit guard, but it is not the same concept as “this is a different editable delay surface.” Selection/pins/history should survive ordinary analysis invalidation when the same working surface remains, but must be dropped when authority is replaced.

Route:

- add a `surfaceGeneration`/authority token to the semantic snapshot;
- increment it only when the editable delay surface identity changes (new load, Use recommendation, context/tune rebuild, successful re-grab replacement as appropriate);
- use `revision` for stale transaction publication and `surfaceGeneration` for selection/pin/history reset.

This also resolves the current coarse reset timing around Grab/Load actions.

### C4. Grab/Load interaction reset is currently action-based, not authority-based

Owner: shared Lambda adapter + semantic surface generation.

The adapter resets on the visible Grab/Use/Load button before it knows whether authority actually changes. For Load, opening then cancelling a picker can discard interaction history. For Grab, v9 may auto-promote a successful re-grab when a working table exists, but a failed/cancelled discovery should not necessarily discard history merely because the button was pressed.

Route: replace pre-action reset heuristics with C3's semantic surface-generation observation. Keep immediate cancellation of an active unsafe gesture/edit if required, but clear history/pins only when authority actually changes.

### C5. Controller capability and teardown should become explicit

Owners: `VeAnalyzerViewController`, post-Codex Target 17 cleanup.

The branch uses a WeakMap keyed by the VE root to expose Lambda semantic editing without rewriting every v-layer. This is reasonable for the isolated branch, but the final architecture should not rely on a hidden side-channel capability.

Route during reconciliation:

- expose an explicit semantic delay/table capability from the stable controller or a composed capability object;
- introduce `destroy()`/dispose semantics if controller instances can be recreated;
- disconnect observers/listeners in v7, result-heat, shared interaction, and similar wrappers through that lifecycle.

Pre-existing examples include v7's document-level outside-click listener and mutation observers, and result-heat's MutationObserver without a retained teardown handle.

### C6. Logger scope navigator needs source extent + range navigation contracts

Owners: `LoggerAnalysisContext`, Logger/Analyzer integration.

The v50 strip currently estimates extent from `context.traces`, but Logger traces may be lazily loaded or partial. That is not an authoritative “Full Log” extent. There is also no explicit `openRangeInLogger(startMs,endMs)` style handoff.

Route:

- add an authoritative source-time extent to Logger analysis context;
- add explicit range navigation/open-in-Logger capability;
- then make the strip interactive and add the frozen `Open in Logger` flow;
- do not infer source extent by forcing trace loads.

### C7. Persistence should move out of direct localStorage probing

Owners: v7/v50 preference paths, post-Codex storage owner.

The v50 presentation duplicates the table-layout storage key so it can distinguish “no saved preference” and choose the frozen single-table default. This is transitional and creates a subtle restricted-storage issue: if `localStorage.getItem()` throws, the v50 wrapper does not apply the single-table default even though v7's own store routine would safely tolerate a failed write.

Route:

- final preference owner should expose “stored value vs default” directly;
- default single-table presentation should not depend on storage availability;
- table tool preferences should use the same owner.

### C8. Wrapper-chain consolidation / legacy layer retirement

Owners: post-Codex Target 17 and fresh audit.

The stable entry composes v9 plus Cell Evidence plus Result Heat plus v50 Presentation plus shared Lambda interaction, while older v5 input code still exists and yields conditionally to the new owner. This is acceptable for isolated integration, but it should not become the permanent architecture.

Route only after parity:

- remove superseded v5 input implementation;
- fold v50 presentation into focused owners;
- fold result heat into the single Result View owner;
- remove dead CSS selectors and compatibility attributes only after browser tests stop relying on them.

## Lane D — intentional UX completion after correctness

### D1. Persisted tool configuration

Frozen v50 expects configurable +/- increment, Smooth strength, interpolation options, and Brush parameters/right-click tool configuration. Lambda currently uses temporary constants (10 ms step, 0.5 Smooth, boundary 2D, 5 ms Brush delta, radius 1, linear falloff) with wheel-only radius mutation.

Route: add controls only after the shared engine passes browser validation, and persist through the production preference owner rather than branch-local localStorage.

### D2. Lambda precision/quantization decision

The renderer shows whole milliseconds while the shared algorithms can produce fractional values. Core provenance also treats values that round to the recommendation's displayed millisecond as a semantic revert.

Route: explicitly choose either:

- Lambda surface quantizes edits to 1 ms; or
- UI displays sufficient fractional precision and provenance rules compare true stored values.

Recommendation: **quantize Lambda only at its surface adapter**, leaving the generic table engine floating-point capable for VE/Target.

### D3. Toolbar command availability/state

The generic toolbar currently allows commands to be clicked when they will no-op. Undo/Redo availability is not exposed, nor are interpolation/selection preconditions reflected visually.

Route after correctness: add capability/state callbacks so buttons can disable themselves without learning domain state from the DOM.

### D4. Brush radius semantics during an already-open stroke

The active `TableBrushStroke` captures radius/falloff options at pointer-down. Wheel changes therefore affect the next stroke, not the currently open stroke. This is internally consistent. Confirm against desired v50 UX before making options dynamically mutable mid-transaction.

## Additional source-review observations

### Generic DOM controller still assumes a row-header table shape

`markCoordinates()` starts editable cells at `cellIndex = 1`, which is correct for current VE/Target/Lambda tables because column 0 is the load-axis row header. If the interaction layer is intended to be truly generic beyond these calibration tables, coordinate discovery should eventually be supplied by a table adapter/selector instead of hard-coded DOM geometry. This does not block the current VE-family use case.

### Existing global-listener debt is not introduced by v50, but validation can expose it

`ve-analyzer-view-v7.ts` owns a `document.pointerdown` outside-click listener without a controller teardown contract. `ve-analyzer-result-heat.ts` creates an observer without a retained disposer. These predate the v50 branch. Do not conflate them with the shared DOM controller's gesture listener issue, which has now been corrected. Route them through controller lifecycle/Target 17 cleanup rather than expanding this isolated branch opportunistically.

### Branch history/core-touch reconciliation risk

The UI branch now also changes a core delay editing primitive and legacy v2 owner integration. Before final PR, rebase/reconcile against post-Codex `main`, rerun the fresh audit, and consider squashing/reorganizing branch commits into reviewable logical units. Do not merge the current 30+ incremental integration commits as-is merely because source review looks good.

## Recommended execution order from here

1. **A1** non-finite interpolation handling + tests.
2. **A2** setup-summary resync on programmatic rebuilds.
3. **A3** roving cell tabindex.
4. **A4/A5** Brush Shift tracking and explicit irregular-2D policy.
5. Run full **B1** executable validation and browser/visual checks.
6. Fix reproduced **B2–B4** presentation issues only from evidence.
7. After validation, wire **C1** one-pass heterogeneous Lambda owner application.
8. During post-Codex reconciliation, do **C2–C8** owner/persistence/Logger/legacy cleanup.
9. Finish **D1–D4** tool configuration/precision/polish after the architecture is stable.

The key constraint remains unchanged: **do not create a UI-local mutable VE or Target authority to make the v50 controls appear complete.** VE/Target shared editing waits for the real writable/review tune owner.