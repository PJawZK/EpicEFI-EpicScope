# Viewed region analysis — read-only implementation plan

Implementation follow-up: [Group A native checkpoint](NATIVE_VIEWED_REGION_CHECKPOINT.md). The text below preserves the pre-implementation plan; current completion and validation are recorded in that checkpoint.

Branch: `ui/idle-analyzer-html-integration`. Inspected implementation: `2621eaec9635ce31869d76b8e39f899015c68aac`. This checkpoint changes documentation only. No production/test changes, new diagnostic mode, broad layout cleanup or push are included.

## Problem and intended behavior

The user's screenshots show eight checked regions and metrics for their combined union. Selecting another Graph focus changes the plot, while cards and assessment correctly retain the union. That separation is implemented intentionally but leaves no direct way to analyze the region being inspected. The current labels and persistent discovery banner make that behavior difficult to understand.

Add **Viewed region** as an explicit native Idle analysis scope. In that scope, choosing a real managed region updates both plots and accepted metrics/assessment for that interval. Keep **Included regions combined** as the aggregate scope: changing graph focus there continues to leave aggregate metrics unchanged. Panning, zooming, Fit, hover and trace visibility never change analysis scope.

### First implementation decisions

- Viewed region initially means one source-bound managed region, selected by its stable region ID. Included and excluded regions can be explicitly analyzed; selecting one does not change its checkbox or combined membership.
- Do not automatically choose the first region or fall back to Full Log. If no real managed region is selected, show a concise selection prompt and withdraw stale evidence. Keep the selector reachable even when the region list is empty; overview/Logger pseudo-focus is not a valid managed selection.
- While Viewed region is active, the focus control serves as the region selector. Its overview/Logger choices must be disabled or clearly unavailable for that scope. Actual Logger A/B remains its own existing analysis-scope option.
- Scope labels beside the cards and assessment must identify **Viewed region: name · bounds** or **Included regions combined (N)**. Brief functional wording is necessary now; the comprehensive decluttering pass is deferred.
- Preserve the existing legacy single-manual scope until a separate migration is justified. Do not silently rewrite inclusion choices to simulate a single-region analysis.
- If a selected region is deleted or retired by a source/revision change, clear its accepted result and show unavailable selection. A split retains the first child's ID; Viewed region then analyzes that child with its new bounds and labels it explicitly. Merging a selected target transfers to the retained merged ID; changed bounds invalidate normally. Do not silently include unrelated regions or gaps.

## Current owners and exact integration points

| Owner | Current behavior | Bounded extension |
| --- | --- | --- |
| `apps/web/src/pages/idle-analyzer-view.ts`: `selectedBounds`, `configure` scope options | Full/Logger/saved/included/manual; no Viewed option | Resolve the selected managed ID to plain start/end bounds; add `viewed` without routing invalid selection to Full |
| Same view: `manageRegion` focus action, focus-select listener, timeline marker clicks | Graph-only; dropdown and manager use separate paths | Route managed focus changes through one local owner action: analyze only when scope is Viewed; graph-only otherwise |
| Same view: `analyze`, accepted result, generation/pending key | Existing semantic key, source-bound read, stale rejection and retained columns | Reuse exactly this pipeline; a different actual interval/qualification withdraws old cards and advances the existing request generation |
| Same view: `renderAssessment`, `renderCoverage`, `renderRegionControls`, `renderTimeline` | Purpose/coverage mostly branch on included/manual scopes | Use the selected managed region for Viewed purpose and coverage; show matching scope throughout both Stability and Base Airflow |
| `idle-qualification-plan.ts` | Included bypass checks manual eligibility; manual path assumes a manually created region | Add an explicit Viewed selection branch with the real region's eligibility; never impersonate the manual scope |
| `idle-region-session.ts` | Owns stable IDs, bounds, purpose, inclusion, origin/bounds-edit provenance | Remain authoritative; no duplicate region store or cloned sample arrays |
| `core/analysis/idle-stability.ts`, `idle-airflow.ts` | Already consume bounded selection/qualification/original indices | Reuse unchanged unless a concrete regression identifies a missing contract |
| `analyzer-scope.ts` / `LoggerAnalysisContext` | Shared real Logger ranges and captured loading/navigation commands | Preserve shared behavior; Viewed is Idle-local, not a new global Logger range type |

Use a small local descriptor/resolver if needed to keep selection, purpose and bypass rules consistent. Do not introduce a generic session framework, lifecycle wrapper, observer or global event listener.

### Important discovery-dropdown distinction

The existing `candidates` dropdown is **not** the Graph focus selector. It validates the current discovery source/settings, then calls `commitRange`, which writes actual Logger A/B bounds. Preserve that source-authoritative callback and do not reinterpret discovery array indices as managed region IDs.

For the first extension, keep that explicit Logger action. When it or a Shift-drag commits a new Logger A/B while Viewed is active, transition visibly to **Current A/B** and focus Logger A/B; never claim that the managed region was resized. Included-combined behavior continues to preserve its union. A minimal truthful action label such as **Use candidate as Logger A/B** can accompany this functional distinction; consolidation of discovery controls remains deferred.

## Qualification, purpose and authority traps

- Viewed analysis applies current numeric qualification to that interval, independent of its inclusion checkbox. A checkbox controls only the combined scope.
- `buildIdleQualificationPlan` currently treats `kind === 'manual'` as bypass-capable without filtering `idleRegionAllowsBypass`. That assumption is valid for its present manual creator, but unsafe for arbitrary discovered candidates. Do **not** map Viewed to manual or merely substitute its ID into `manualId`.
- Explicit manual bypass in Viewed must require `region.origin === 'manual' || region.boundsEdited`, using the existing shared predicate. Renaming or assigning a purpose does not enable bypass. An untouched candidate remains subject to required channels and conditions.
- Only a genuinely eligible, explicitly bypassed selected region may allow unused conditional channels to be missing. Discovery never bypasses; Full/Logger scopes keep their existing policy.
- Purpose comes from the selected managed region even if excluded. It remains declared intent, not measured idle state. Unrelated checked regions cannot influence Viewed purpose; combined scope still summarizes its included purposes.
- Keep original tune, analysis/proposal/working state and MSQ/ECU boundaries untouched. No rendered text, graph geometry or candidate banner becomes measurement authority.

## Cache and async behavior

- Cache keys use source/catalog/role identity, actual normalized bounds/union and qualification/bypass semantics. Never put the whole region object, label, purpose or inclusion flag into the numeric key. The preceding cache regression already showed cached reads can hide repeated CPU analysis.
- Changing from region A to B with different analytical inputs runs scoped analysis through the existing owner. Rapid A→B and late A completion must leave B authoritative. Identical bounds with identical eligibility can reuse numerical evidence while current region labels/purpose update.
- Retain existing full-source column reuse. Do not add a per-region cache of full arrays, duplicate evidence passes or an unbounded results registry. First reads may be required; later region changes over retained columns are CPU work, not file I/O.
- Base Airflow must use the newly accepted original-index selection. Its retained aggregate expires with that result and is recreated only when needed; mode/tab changes remain presentation-only.
- Selecting/focusing a region while another scope is active must retain current graph-only behavior. Unrelated inclusion/purpose/name edits must not trigger Viewed numeric work unless the actual selected bounds/qualification changed.
- No rolling-window optimization, worker move or full-log algorithm rewrite in this functional extension. Existing full-column scans may remain CPU costs; measure separately if they block basic use.

## Focused regression and native acceptance matrix

1. **Known unequal regions:** use two intervals with deliberately different RPM/target/request values. Viewed A→B must change sample counts, sigma/RMSE/band facts, Airflow cards, purpose and assessment as mathematically expected.
2. **Combined scope:** with the same intervals checked, switching focus must retain combined metrics, counts and accepted analysis identity. Overlap/shared endpoints still count once.
3. **All focus entry points:** selector, manager Inspect/View action and timeline region marker must follow the same scope-sensitive policy. The discovery dropdown remains an explicit Logger action.
4. **Missing selection:** overview, deleted region, empty region list and replacement source must not retain old cards or silently analyze Full Log.
5. **Bypass correctness:** untouched candidate with missing coolant must block; name/purpose changes must not bypass; explicit eligible manual/bounds-edited selection may bypass only with the setting enabled. Excluded selection does not alter combined inclusion.
6. **Presentation reuse:** pan/zoom/Fit, tabs, modes and name/purpose changes retain numbers and viewport where bounds are unchanged. Use existing owner events to distinguish calculation requests from cached source reads.
7. **Async/lifetime:** hold A's read, select B, resolve B then A; B must remain current. Hide/source/catalog/unit/revision change must reject obsolete completions, with no hidden work.
8. **Region mutations:** selected/unselected edit, split, merge and delete must follow the explicit rules above; inclusion edits for other regions must not affect Viewed facts.
9. **Logger ownership:** Current A/B, saved ranges and native Shift-drag continue using checked Logger callbacks. A Viewed→A/B transition labels both graphs and cards correctly without creating a managed range.
10. **Scale/browser:** >320k original samples, retained-read counts and bounded graph DOM; both worker/fallback configurations. Native file replay with a known real interval, two distinct selections, qualification, Stability↔Airflow, navigation and 390px layout. No full1GB/hardware responsiveness claim from a synthetic count alone.

Relevant files: existing `tests/web/idle-analyzer.browser.mjs`, `tests/analysis/idle-qualification.test.ts`, `tests/idle-region-session.test.ts` and core Stability/Airflow tests. Extend actual behavior tests; do not write tests that merely mirror new helper branches.

## Proposed bounded implementation checkpoint after reset

1. Recheck branch/HEAD and any upstream changes; use current source/region owners.
2. Implement the scope descriptor, guarded qualification and unified managed-focus action together. Add matching scope/purpose/coverage rendering for both modes; no broader UI redesign.
3. Add the independent numerical and browser cases above, preserving all existing aggregate-scope/Brush/VE behavior.
4. Run relevant unit/build/browser gates and real native replay sequentially where resource-heavy. Keep timing/assertion limits intact; use existing completion helpers.
5. Save exact SHA, validation results, limitations, seven-stage status and handoff; stop for review. No automatic push or main merge.

## Explicitly deferred user requirements

**After accepted HTML features are incorporated:** review persistent clutter, consolidate duplicate review controls, clarify actions and choose what remains visible versus contextual/disclosed. The candidate banner currently resembles an unresolved approval/correction request despite having no approval workflow. Its later design must make it initial-inspection feedback, dismissible or cleared after that inspection, with region management accessible normally. Do not invent a required approval state or auto-include candidates merely to dismiss a banner. Historical “new excluded regions” text must not masquerade as the current inclusion state.

**After Idle Analyzer:** design shared in-application EpicScope information/help infrastructure: contextual information bubbles, short task guidance and optional tutorials/walkthroughs. Reuse existing help owners; avoid duplicated per-page chrome, global DOM-decoration scans and external-documentation dependence for normal use. Clear controls come first; help must not compensate for misleading labels.

No production work on either deferred item is authorized by this planning checkpoint.

## Current stage completion

| Stage | Status |
| --- | --- |
| 1 — Fixtures/contracts | Partial; Viewed qualification/scope cases specified, not implemented |
| 2 — Source/session | Existing primary-source foundation complete; Viewed extension pending |
| 3 — Core analysis | Partial; existing Stability/Airflow primitives reusable |
| 4 — Native UI | Partial; Viewed workflow next, broad cleanup deferred |
| 5 — Independent B/comparison | Not started |
| 6 — Persistence/plans/Logger | Partial |
| 7 — Acceptance | Open; baseline full browser gate passed, new extension unimplemented/unvalidated |
