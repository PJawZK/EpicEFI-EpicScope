<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Research-to-product disposition is tracked in `docs/research/STATUS.md`.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Roadmap

## Roadmap principles

The roadmap describes intended capability and implementation order. It does not authorize code to bypass `FILE_ARCHITECTURE.md` or the evidence/safety rules established elsewhere.

Each implementation task should identify goal, architectural owner/location, dependencies, expected validation and completion criteria. Large features should be split into reviewable tasks before coding.

Research documents are behavioral references, not implementation authorities. Preserve the original notes under `docs/research/`; update `docs/research/STATUS.md` when EpicScope implements, improves, defers or supersedes a researched behavior.

## Current execution position — 2026-10-14

EpicScope Web has completed the originally approved implementation scope through Phase 4 foundations and remains the functional reference for Logger, Histogram and Analyzer behavior.

Current product maturity:

- **Logger:** mature functional reference.
- **Histogram:** generic research-parity checkpoint reached; maintenance/cleanup only unless field use shows a concrete gap.
- **Analyzer:** uneven maturity; Fueling/Ignition mature experimental checkpoints, Boost strong, Idle/AE useful but thinner, Fuel / Injector actively improving, Trigger / Sync still thin.
- **VE Analyzer:** researched and specified, not yet implemented.
- **MLG v3:** researched as a compatibility extension, not yet implemented.
- **Cleanup/consolidation:** approved but deferred until broader Analyzer coverage is achieved.
- **Linux production implementation:** future work after Web maturity review.

Approved product workflow:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Histogram sub-flow:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

Load Data order is intentionally:

> **INI → MSQ → LOG → UNLOAD → TS-SHIM**

## Phase 0 — Foundation

Status: **Complete**

Established product identity/scope, architecture/file ownership, normalized data model, performance/platform requirements, workflow/handoff/decision process and privacy/security/input rules.

## Phase 1 — Web log, navigation and source foundation

Status: **Complete as a functional foundation; regression maintenance continues**

Implemented:

- MLG v1/v2 parsing, staged validation and source-integrity diagnostics;
- bounded/random-access source access;
- Worker import and deferred CRC validation;
- Blob caching, multi-channel decoding and persistent decoded-channel reuse;
- synchronized timeline/cursor, zoom/pan/Fit;
- A/B, markers, saved ranges and view history;
- multi-pane fixed/freeform graph workspaces;
- exact-log and reusable-application persistence;
- read-only `ts_shim` live/capture source integration;
- recorded ↔ Shim source transitions;
- stable channel identity across recorded and Shim sources;
- semantic starter templates and fresh-state workspace seeding;
- retained-memory, performance and runtime-health diagnostics.

Do not restart broad Logger/performance optimization without a measured regression.

## Phase 2 — Channel catalog, UI workflow and generic analysis

Status: **Complete for the currently approved scope; targeted maintenance only**

Implemented:

- stable INI↔MLG logical/source binding;
- known+data / known-no-data / log-only states;
- channel search/group/favorite/recent semantics;
- shared analysis scopes and Qualification;
- Table Generator;
- Distribution;
- Scatter;
- saved setups/exports where selected;
- Math Channels;
- evidence navigation to Logger;
- semantic starter resolution and capability gating.

### Histogram research-parity checkpoint

The MegaLogViewer-inspired generic Histogram maturity gaps selected for EpicScope are closed at the intended checkpoint.

Established behavior includes:

- Table Generator exact Median and weighted breakpoint-node behavior;
- aligned X/Y/Z/reference/delta cell evidence;
- Distribution repeatable fixed geometry and outside-geometry provenance;
- Scatter point/box evidence, strongest contiguous Logger visit, saved setups and exports;
- Math Channels with historical references, logic, lazy conditionals and temporal helpers;
- shared timeline docking across Logger/Table Generator/Distribution/Scatter;
- unit-aware Histogram channel selectors, including Math Channels when unit metadata exists.

See `docs/HISTOGRAM.md` and `docs/research/STATUS.md`.

Do not start another broad Histogram rewrite.

## Phase 3 — MSQ tune enrichment and table correlation

Status: **Complete for the currently approved scope**

Implemented:

- normalized tune values/tables/curves/scalars;
- optional tune enrichment;
- explicit table + X/Y relationship metadata;
- tune table interpolation/correlation;
- observed/tune evidence and sample population;
- optional tune context in analyzers where it improves attribution.

EpicScope is still an analysis product, not a live ECU tune editor. Any future VE proposal application must remain explicit and diff-first.

## Phase 4 — Specialized analyzers

Status: **Implemented foundations; maturity uneven; current active product track**

### Shared Analyzer foundation

Implemented:

- semantic channel-role suggestions with manual override;
- unit-aware channel selectors;
- Full Log / Current A/B / Saved Range scopes;
- Logger A/B → Analyzer handoff;
- Analyzer → Logger evidence navigation;
- shared saved Qualification where appropriate;
- grouped ALL/ANY qualification;
- provenance;
- shared numeric comparison;
- event-aligned evidence rendering;
- progressive disclosure;
- standardized inline help.

### Fueling

Status: **Mature experimental checkpoint — freeze unless bug/regression**

Includes lambda-first semantics, effective VE/load context, fuel-state exclusions, trailing-window stability, observed mixture-response delay, correction context, evidence strength, sortable evidence and Logger navigation.

### Ignition

Status: **Mature non-knock experimental checkpoint — freeze unless bug/regression**

Includes final timing/correction/dwell/load context, large-log-safe events, Areas to review, optional MSQ base-table attribution and conservative source clues.

### Boost

Status: **Strong experimental foundation — paused**

Open/Closed Loop models, target-independent spool evidence, operating-point summaries, compare scopes and conservative polarity-neutral interpretation are established.

### Idle

Status: **Useful foundation — later refinement**

Later useful work: richer phase/settling/oscillation/headroom metrics and MSQ DC Bias curve context.

### AE / MAP Predict

Status: **Useful foundation — later refinement**

Later useful work: richer event classification, timing/integrated error metrics and event-set comparison.

### Fuel Pressure / Injector

Status: **Active maturity track**

Recent established behavior through PR #390 includes:

- source-continuity-correct threshold event grouping;
- exact event-extreme sample/time;
- injector duty headroom and saturation evidence;
- decision-facing summary;
- calibrated low-side/high-side pressure role separation;
- explicit exclusion of CEL and raw electrical pressure channels;
- Conventional / port-injection vs GDI / high-pressure architecture mode;
- conventional rail-differential evidence vs GDI high-side evidence;
- unit-aware pressure/injector selectors and summaries.

Next completion targets:

1. expose full event-extreme RPM/load/MAP/pressure/PW/duty/deadtime context in the visible evidence view;
2. characterize pressure sag and recovery;
3. summarize repeated-event/repeatability behavior;
4. add pump/prime recovery where logged;
5. add voltage/deadtime and calibration-comparison evidence;
6. reach evidence/navigation usefulness comparable to Fueling/Ignition.

### Trigger / Sync

Status: **Next broad-coverage analyzer after Fuel / Injector**

Target maturity:

- sync state / trigger error / loss counter/reason;
- one-sample glitch vs sustained loss classification;
- RPM/voltage/load event context;
- pre/post evidence;
- frequency by RPM band;
- direct Logger navigation and ranked review areas.

A waveform-style Trigger Logger is a separate future capability and requires explicit scope.

## Planned major Analyzer feature — VE Analyzer

Status: **Research complete enough for implementation; product surface not started**

Authoritative behavior contract: `docs/VE_ANALYZER.md`.

Research basis: `docs/research/MLV_BEHAVIORAL_RESEARCH.md` and `docs/research/VE_AUTOTUNE_REFERENCE_RESEARCH.md`.

Planned core behavior:

- semantic VE-analysis qualification presets;
- separate Lambda Delay Discovery preset;
- single / RPM-curve / RPM×load delay models;
- explicit **Grab lambda delays from log** workflow;
- no expensive automatic delay scan on startup/log load/analyzer open;
- timestamp-based delay alignment;
- bilinear VE-node evidence;
- starting-table prior/confidence authority;
- independent evidence authority and user apply percentage;
- correction limits that withhold rather than silently clamp;
- Measured / Interpolated / Weak / Withheld / No-evidence result states;
- source-sample provenance and Logger navigation;
- immutable original tune until explicit review/export/apply.

Implementation order should reuse existing Fueling, AFR-delay, Qualification, Table Generator weighting, scope, semantic role and MSQ foundations.

## MLG v3 compatibility extension

Status: **Researched; not implemented; not a current EpicEFI blocker**

`docs/research/MLG_V3_RESEARCH.md` records:

- v3 uses the broad v2-style container path;
- LE scalar IDs 9..14 are experimentally confirmed;
- IDs 8/15 are not valid evidence for F64 and must remain unsupported;
- extended bitfields still need fixture validation;
- v3-capable TunerStudio can continue writing v2 for current EpicEFI projects.

When implemented, extend the current parser rather than creating a separate architecture. Add explicit per-field byte order and regression coverage for mixed widths/endianness.

## Dedicated cleanup/consolidation phase

Status: **Approved direction; deferred until broader Analyzer coverage**

Candidate work:

- remove dormant duplicate editor paths;
- reduce analyzer-local/shared DOM enhancement layers;
- remove unnecessary MutationObservers;
- replace direct DOM state bridges with explicit contracts;
- rename helpers that became generic;
- consolidate table/event/help/rendering infrastructure;
- centralize canvas sizing/resize ownership;
- simplify CSS/runtime UI surgery;
- remove dead/unreachable branches and compatibility leftovers;
- re-profile representative large logs.

Do not destabilize mature behavior solely for internal tidiness.

## Phase 5 — Sessions, sharing and reporting

Status: **Not started — explicit owner approval required**

Potential future scope:

- versioned full-session persistence;
- annotations/bookmarks;
- result snapshots;
- explicit sharing/publishing.

No silent upload/telemetry of local log/tune content.

## Phase 6 — Web functional maturity review

Before Linux becomes primary focus:

- complete broad Analyzer maturity targets;
- complete VE Analyzer if retained as planned;
- run cleanup/consolidation;
- review feature completeness and workflow clarity;
- freeze/version key contracts;
- profile representative workloads after cleanup;
- define Linux benchmark/hardware baselines;
- decide which Web internals are retained/replaced/ported.

## Phase 7 — Linux production implementation

Primary baseline: Debian 13 Stable.

Goals:

- native high-performance data path;
- low RAM;
- large-log indexing/bounded queries;
- responsive graphs/tables;
- preservation of established EpicScope semantics.

## Phase 8 — Linux feature expansion

Potential later work:

- persistent native indexes/caches;
- very large logs;
- optional file-library/watching workflows;
- direct ECU logging/live analysis if separately approved;
- additional analyzers;
- packaging/update strategy.

## Phase 9 — Android / EpicHub integration

Reuse proven core concepts after Linux/Web semantics mature; design tablet/mobile presentation independently where appropriate.

TunerStudio interaction/stability research primarily informs EpicHub. Only the transferable invariants—explicit proposal vs tune state, diff-first application, no implicit Burn/write—should constrain future EpicScope VE proposal workflows.

## Current recommended sequence

1. keep research/documentation synchronized;
2. finish Fuel / Injector;
3. mature Trigger / Sync;
4. implement VE Analyzer;
5. add MLG v3 compatibility when remaining mapping is verified or demand appears;
6. refine AE / MAP Predict and Idle;
7. run cleanup/consolidation;
8. perform Web functional maturity review;
9. then begin Linux production work.

## Roadmap change control

New major feature groups must be placed deliberately in roadmap and architecture before implementation. A feature request alone does not authorize a new subsystem or architectural layer.

For exact present-tense continuation, always defer to `docs/HANDOFF.md`.
