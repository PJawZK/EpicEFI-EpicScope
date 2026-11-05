# Idle Analyzer native integration specification and staged plan

**Proposal only.** This readiness pass does not authorize production implementation, HTML changes or a main merge. Audited state, evidence and blockers: [assessment](INTEGRATION_READINESS_AUDIT.md). Functional classification: [matrix](FUNCTIONAL_COVERAGE_MATRIX.md). Proposed types/authority: [reconciliation](SOURCE_AUTHORITY_RECONCILIATION.md).

## Intended integrated behavior

The accepted compact Idle workspace renders production-source measurements and core results. It retains eight diagnostic modes, two coordinated plots, purpose-tagged operating regions, distinct A/B source timelines, Diagnosis/Evidence/Next Test, read-only tune context, and explicit limits of inference. Missing roles disable only dependent metrics/modes. Region edits affect analysis; viewport edits do not. Every card, event, summary, comparison and export reports the same accepted source/configuration revision.

One accepted primary recording remains authoritative while a temporary replacement is prepared. B is an explicitly retained independent source, not another Logger. A failed or retired replacement cannot destroy or overwrite accepted evidence. Reload restores validated descriptors, requires source rebinding and recomputes results. It never fabricates ranges, raw samples, tune association or analytical confidence.

No automatic tune changes, ECU writes, Burn, new general framework, parallel parser/resolver or redundant Logger are included. Existing VE original/proposal/working state and MSQ save behavior must remain untouched.

## Integration blockers versus deferrable work

| Must be settled before the affected capability ships | Can wait if accurately unavailable/disabled |
|---|---|
| Canonical original indices/validity/continuity, role units and provenance | Oscillation frequency, controller lag and t63 estimation |
| Transactional replacement/generation rejection and accepted-handle ownership | Automatic gain or bias recommendations |
| Metric definitions: σ, sign, recovery origin/gaps/dwell, valid denominators | Automatic multi-recording matching beyond two explicitly bound sources |
| Complete setting→operation wiring or clear disabled state | Editing calibration or applying a proposed change |
| Region/result/summary/export semantic revision consistency | Additional responsive polish beyond basic usability and no hidden critical controls |
| A/B comparability, source identity strength and missing-source refusal | Strong full-content identity if restoration remains explicit/review-required under sampled verification |
| Plan schema round-trip if Load/Save plan is exposed | Legacy plan migration if the unsupported control is disabled/removed |
| Source-aware Logger navigation if its action is enabled | B Logger activation if clearly unavailable until its owner contract exists |
| Browser-scale safe loops/bounded rendering and no hidden-domain expensive work | Broad worker/algorithm optimization unrelated to a reproduced integration requirement |

Missing original September MLG and October MSQ/INI/firmware are **validation blockers for those claims**, not blockers to specifying architecture or implementing read-only unavailable states. The October25 prefix is suitable for parser/session regression, not a substitute tuning experiment.

## Incremental sequence and stop points

Each stage should be separately reviewable, locally committed with a handoff and stopped for review. Do not begin multiple stages merely to consume a usage window. If resource limits approach, record exact branch/SHA, changed files, commands/results, outstanding work and next bounded action before stopping. Numerical contract changes should be reviewed before dependent UI expectations are written.

### Stage 1 — Freeze source fixtures and numerical contracts

Scope: tests/specification, no native UI port yet.

1. Obtain or formally mark unavailable the original October20/September30 recordings, exact matching INI/MSQ and firmware revision. Record source hashes/provenance and redistribution permission; keep private real logs out of Git.
2. Build small canonical MLG fixtures covering recovered retry, unrecovered CRC, loss/counter gaps, timestamp rollover/regression and truncated tail. Derive expected indices/quality from production parser, not HTML dense `idx`.
3. Turn the audit reference cases into independent expected-value tests. Decide sample σ versus explicitly named population σ; preserve actual−target core sign or invert only labeled presentation. Define recovery origin, settling dwell, maximum gap, incomplete terminal events, sample/time weighting and interval endpoints.
4. Define required roles per mode and available/unavailable result shape. Separate tune-derived bias, logged bias, raw PID and derived applied correction. Verify no assumption that sampling cadence is controller cadence.

Existing files to extend: `tests/analysis/idle-control-diagnostics.test.ts`, `specialized-analyzers.test.ts`, `numeric-aggregation.test.ts`; parser fixtures/tests; channel-role tests. The readiness pass itself added none of these tests.

Acceptance: expected numbers explain every intentional HTML/production difference; invalid optional channels never become healthy zero percentages; no causal tuning verdict without evidence. Stop before replacing core behavior solely for parity.

### Stage 2 — Bind a native Idle session to existing source/controller owners

Scope: primary source, canonical roles, selection and immutable session revisions; no new graphs needed yet.

- Extend `apps/web/src/pages/specialized-analyzer-suite-view.ts` at its current Idle/active-domain boundary, coordinated by `analyzer-page.ts`. Introduce a small dedicated Idle session model/controller only where the existing suite cannot express the accepted workflow. It owns source/configuration/result revisions, not byte decoding or Logger state.
- Reuse `LoggerAnalysisContext` captured loaders and source revision, `analyzer-scope.ts`, existing role suggestion/semantic overrides and numeric-range validity. Add only missing Idle roles to the existing resolution mechanism.
- Represent stable Idle regions with source identity, purpose, bounds, inclusion and revision. Logger A/B/saved ranges seed source selections; they do not become detached invented ranges. Graph viewport remains separate.
- Specify invalidation: source/catalog/validity/tune/qualification/selection semantic change invalidates dependent results; unchanged context and presentation changes do not. Existing hidden-domain deferred work and stale-read generation guards remain the boundary.

Potential new files (names illustrative): `pages/idle-analyzer-session.ts` and a narrowly scoped state contract. Reuse existing patterns; do not introduce a generic source/lifecycle framework as a prerequisite.

Acceptance: unchanged context does not destroy a session; real changes advance revision; hidden Idle performs no expensive read/calculation; switching domain or source during a pending read cannot install stale evidence. No VE lifecycle/save regression.

### Stage 3 — Extend one core Idle analysis, not eight competing analyzers

Scope: pure numeric results and event semantics needed by all eight views.

- Reuse `analyzeIdle`, `analyzeIdleControlDiagnostics`, `aggregateNumericSamples`, qualification and table-correlation primitives. Add missing idle-specific capability/metric/region/event functions beside existing core modules rather than porting the prototype’s monolithic `metricsFor`.
- Produce one immutable, revision-keyed result with reusable per-region/union metrics and event references. Physical event identity includes original source indices. Overlapping regions can reference one event; totals do not double-count it.
- Correct or extend shared sag semantics under Stage1 decisions, including terminal/censored events and gap/dwell rules. Preserve compatibility of existing specialized-analyzer consumers with explicit migration tests.
- Implement derived correction, configured-limit coverage and expected tune-bias interpolation only when prerequisites hold; report unavailable otherwise. Classification/recommendation content consumes typed evidence and assumptions, never DOM text.
- Use bounded iteration/extrema for >320k samples. Quantiles/medians should share materialized/sorted values when required; no repeated full source reads. Do not initiate the paused broader performance program.

Potential new core files: a focused Idle region/qualification module and result definitions if extension of current modules would mix responsibilities. No separate parser, source cache or second library of generic statistics.

Acceptance: numeric fixtures pass; per-role invalid/unavailable counts reconcile; overlapping/gapped scopes have correct event identity; >320k continuous samples do not throw. t63/frequency/lag remain unavailable unless independently justified.

### Stage 4 — Project the accepted single-source UI from retained results

Scope: accepted layout/modes, single source, read-only tune/evidence.

- Create focused native Idle view components hosted by the current Analyzer route. Preserve mode picker, metric strip, two plots, three assessment tabs, regions and operation feedback.
- Adapt `analyzer-event-evidence.ts`, production graph/timeline/viewport primitives and existing help. Reuse available rendering before adding missing two-panel/transform support. Avoid whole-page scans, duplicate event handlers or a second chart data authority.
- Wire each exposed setting to a declared effect: rediscover candidates, requalify analysis, change rule threshold or presentation only. Manual regions retain explicit bypass policy. Disable missing fan/state roles and remove synthetic source claims.
- Bind normalized INI/MSQ table definitions and immutable source-associated tune snapshots read-only. Illustrative base/target/spark geometry must not appear as actual tune cells.
- Summary/plan/evidence all consume the same accepted result; display scope and revision/freshness. Changing timeline bounds cannot retain an apparently current old summary.

Existing owners to adapt: specialized suite/router, help/presentation, evidence graph, INI table editor parser, `core/tune/tune-model.ts` and `table-correlation.ts`. No changes to MSQ writing or VE working/proposal ownership.

Acceptance: all modes have supported or clear unavailable state; settings causality tests pass; tab/trace/zoom changes do not recalculate full-log analysis; region changes do. One event click changes only viewport. No regression to existing VE/Brush/editing behavior.

### Stage 5 — Add independent B with transactional ownership and comparison

Scope: bounded A/B comparison capability and source-aware timelines.

- Extend existing MLG importer/worker/data-source adapters to expose a retained comparison handle without replacing primary Logger automatically. Decide handle disposal and storage retention explicitly; do not instantiate another Logger.
- Each replacement has a request generation and temporary candidate; preserve old accepted B until new B fully accepts. Failure/older completion never clears/overwrites current B. Apply equivalent ownership discipline to comparison tune references.
- Implement independent real regions, elapsed/normalized/event display transforms and original-index anchors; view transforms do not change calculations. Retain condition-first interval suggestions; no RMSE-based selection bias.
- Compare capabilities, coverage, CLT/TPS/target/loads and tune/firmware definitions. MSQ diff uses normalized entries including page/geometry/additions/removals, not name-only maps. Display descriptive differences with structured limitations; unmatched/missing/reversed chronology cannot become an improvement verdict.

Genuinely new functionality: narrow comparison-session/result projection and retained second-source ownership extension. Reuse source, worker, cache, resolver, statistics, graph and persistence facilities.

Acceptance: real canonical prefix import agrees on original indices and all five recovered attempts; A/B bounds remain independent; slowA/fastB/lateA and failed replacements preserve current accepted state; missing roles affect only dependent results; event alignment never fabricates matched physical load.

### Stage 6 — Persistence, test plans and real Logger handoff

Scope: versioned session descriptor and end-to-end workflow, no raw-file duplication.

- Use existing workspace persistence conventions with explicit Idle schema, validation, migration and observable storage failures. Persist full moved bounds for built-in and user regions; derive labels from current bounds.
- Declare source verification strength. Matching sampled/metadata identity requires the documented review policy; exact unattended restoration requires stronger verification. Keep missing-source refusal, no raw localStorage payload and explicit re-import.
- Make test plan export/import use one versioned schema with source/configuration/result provenance and A/B descriptors. Operator status/note does not alter analytical truth. Reject corrupt/oversized/unsupported payloads without destroying accepted state.
- Primary Logger handoff uses current source-bound callbacks. Add B activation only through a reviewed existing-source orchestration path; otherwise explain unavailable state. Translate display coordinates back to original time/sample indices.

Acceptance: reload/missing/matching/mismatching/unsampled-collision policy; bounds/enums/schema corruption; failed storage; plan round-trip; B handoff cannot focus A accidentally; stale callbacks are refused. Navigation retains accepted session without repeating import/analysis unnecessarily.

### Stage 7 — Production/browser acceptance and freeze

Scope: validation and correction of reproduced integration defects only.

- Run typecheck, production build, relevant full unit/integration suite and full browser regression for touched workflows. Record exact commit SHA and commands/results; CI success alone is insufficient.
- Real browser path: load INI/MSQ/MLG → Logger ranges → Idle all modes → manual/auto regions → settings → event/graph evidence → A/B import/replace → tune inspection → plan export/import → reload/re-import → Logger handoff → VE/other domains and back.
- Validate >320k continuous valid samples and the supplied full large log where available, with exact browser/hardware and timing/memory observations. Keep true physical I/O/decode separate from cached calculation/render cost. The prefix cannot close this gate.
- Validate narrow/desktop, long names, keyboard focus, pointer/touch, graph gaps/spikes, per-control behavior, cancellation and source replacement during analysis. Confirm no expensive hidden-domain work and no new listeners/observers that compete with existing owners.
- Stop for manual UI/analytical acceptance. No main merge until separately requested and acceptance evidence is reviewed.

If a full real fixture is unavailable, leave that acceptance line open; do not invent a successful validation or substitute a synthetic throughput result for recorded evidence.

## Regression inventory

| Boundary | Required cases |
|---|---|
| Canonical source | Recovered retry versus unrecovered corruption; invalid retained indices; tail policy; lost/stale/missing quality; rollover/regression; both sources independently |
| Mapping/units | Missing/ambiguous roles; catalog replacement same channel ID; incompatible units; manual override; RPM-only capability; physical TPS versus pedal; λ without assumed AFR |
| Mathematics | Reference table in audit; sample/population σ; sign; finite-role intersection; irregular cadence/weighting; minimum coverage; configured versus watch limits |
| Events | Threshold boundaries; gaps/dwell; terminal low run; censored recovery; overlapping regions deduplicate event IDs; selected scope never borrows recovery outside permitted runs |
| Lifecycle | Same-context no-op; source/tune/scope/validity changes; hidden domain; pending read/import failure; old completion after new session/disposal |
| UI | Every mode/tab/control; real unavailable states; no rendered text authority; graph display versus semantic selection; shifted bounds/labels; constrained viewport and accessible focus |
| Comparison | Independent source clocks; overlap/same-source refusal; condition versus intervention; reverse/unknown chronology; incompatible tune; missing loads; explicit event anchors; matching not outcome-ranked |
| Persistence | Valid/rejected schema; moved built-in bounds; source absent/mismatch/collision policy; re-import; no raw rows; storage exceptions; exact export/import schema |
| Production boundaries | Existing Logger range commands; retired-source rejection; no competing Logger; VE original/proposal/working/save unaffected; no ECU writes |

## Recommended first approval

Approve Stage1’s fixture/numerical scope, not a broad port. The highest-value early work is a reliable specification of source indices, missing data, sign/σ/recovery and semantic revisions. Most prototype-only repairs should be implemented once at the eventual native owners; another HTML version is not required to complete this readiness pass.
