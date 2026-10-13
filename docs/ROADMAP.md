<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Roadmap

## Roadmap principles

The roadmap describes intended capability and implementation order. It does not authorize code to bypass `FILE_ARCHITECTURE.md`.

Each implementation task should identify goal, architectural owner/location, dependencies, expected validation and completion criteria. Large features should be split into reviewable tasks before coding.

## Current execution position — 2026-10-13

EpicScope Web has completed the originally approved implementation scope through **Phase 4** and remains the functional reference for Logger, Histogram and Analyzer behavior.

Established foundations include:

- MLG v1/v2 import/index/staged validation and source-integrity diagnostics;
- OPFS sidecar/native-column post-index access;
- INI-backed channel catalog/binding and optional MSQ tune enrichment;
- reusable graph workspaces/presets plus separate exact-log navigation persistence;
- multi-pane fixed/freeform graphs and timeline/range/marker tooling;
- generic range statistics, Qualification, Table Generator, Distribution and Scatter;
- shared Math Channels;
- Analyzer Range Compare and Tune Table;
- Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel / Injector and Trigger / Sync analyzer surfaces;
- evidence navigation back to Logger;
- validated read-only real-ECU/Pi/`ts_shim` source workflow;
- retained-memory, performance and runtime-health diagnostics.

The broad recorded-log performance campaign is complete unless a measured regression appears.

Analyzer maturity work reached sensible checkpoints in Fueling and non-knock Ignition and is deliberately paused for now. The latest completed product track is the **generic Histogram research-parity close-out**, culminating in PRs #372–#381 after the earlier consistency milestones #339, #340, #344 and #345. PR #381 fixed the final shared Hide/Show-controls docking mismatch by keeping the authoritative Logger `.timeline-wrap` intact when reused by Table Generator, Distribution and Scatter.

Do not begin Phase 5, restart broad Histogram redesign, or reopen mature analyzers automatically. Continue from concrete user-visible gaps, missing analyzer coverage, firmware/source integration needs, or measured regressions.

Approved product workflow:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Current generic Histogram sub-flow:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

## Phase 0 — Foundation

Status: **Complete**

Established product identity/scope, architecture/file ownership, normalized data model, performance/platform requirements, workflow/handoff/decision process and privacy/security/input rules.

## Phase 1 — Web log, navigation and source foundation

Status: **Complete as a functional foundation; regression maintenance continues**

Implemented:

- MLG v1/v2 parsing and staged validation;
- bounded/random-access source access;
- Worker import and deferred CRC validation;
- Blob caching, multi-channel decoding, OPFS column sidecar and sparse native per-channel persistence;
- synchronized timeline/cursor, zoom/pan/Fit;
- A/B, markers, saved ranges and view history;
- multi-pane fixed/freeform graph workspaces;
- exact-log and reusable-application persistence;
- read-only `ts_shim` live/capture source integration;
- in-process recorded ↔ Shim source ownership transitions;
- stable channel identity across `ini:*` recorded identities and raw Shim runtime IDs.

### Logger graph preset invariant

Named workspaces behave as real graph presets. Every available channel assigned to a visible pane must be active/rendered. The same rule applies after workspace restore/switch, Single→multi-pane layout changes and Freeform visibility changes.

Unavailable channels remain assigned but are not falsely activated. Pending loads must not be cancelled by duplicate reconciliation.

### Source ownership invariant

One Logger source family is authoritative at a time. INI/MSQ/workspace/report state survives source transitions. Returning from Shim to an INI-bound recorded log restores canonical recorded identities and binding.

See `docs/HANDOFF.md` and the `TS_SHIM_*` documents for the validated runtime topology.

## Phase 2 — Channel catalog, UI workflow and generic analysis foundation

Status: **Complete for the currently approved scope; targeted maintenance only**

Implemented:

- stable INI↔MLG logical/source binding;
- known+data / known-no-data / log-only states;
- full available-log analysis catalog with on-demand decode;
- channel search/group/favorite/recent semantics;
- range statistics and shared Qualification;
- Table Generator;
- Distribution;
- Scatter;
- saved presets/filters where currently supported;
- Math Channels;
- linked evidence back to Logger;
- shared saved analysis-filter storage;
- grouped ALL/ANY qualification semantics;
- shared analysis scopes.

### Current UI hierarchy

- EpicScope logo dropdown switches Logger / Analyzer / Histogram;
- Analyzer and Histogram use compact secondary dropdowns;
- Logger Layout menu owns layout/arrange/reset/clear;
- Undo/Redo is one compact split control;
- Settings is organized by current mode/interface/data-storage context;
- Table Generator uses **Table Size** and **Weighted Mean** terminology;
- transient menus/popovers close on outside interaction or when another transient control opens;
- Diag / Perf / Report use anchored footer-popout interaction;
- reusable anchored round-`i` help is the standard pattern for non-obvious controls/results.

## Histogram maturity — current authoritative state

The broad consistency and research-parity passes are complete.

### PR #339 — Scope / evidence flow

Implemented:

- **Full Log / Current A/B / Saved Range** consistency across Table Generator, Distribution and Scatter;
- shared Logger timeline including Table Generator;
- removal of redundant manual Refresh controls from auto-updating Histogram analysis views;
- Distribution comparison using arbitrary Primary/Compare scopes on shared boundaries;
- Distribution Auto comparison bins from combined populations;
- Distribution Time-gap correctness;
- Scatter Full Log / Current A/B / Saved Range;
- full-qualified-data density with bounded point rendering;
- Scatter line-gap handling;
- rendered Scatter point → Logger navigation.

### PR #340 — Shared Qualification

The same saved grouped ALL/ANY Qualification sets work across Table Generator, Distribution and Scatter, including visible eligibility provenance and explicit missing dependencies.

### PR #344 — Shared Math Channels

Saved Math Channels are first-class Histogram inputs in Distribution and Scatter as well as Table Generator. Qualification may depend on Math Channels. The dormant hidden mini calculated-field editor inside Table Generator is intentionally deferred to later cleanup.

### PR #345 — Unified help

Histogram uses the same shared anchored round-`i` information popover as Analyzer. Help is intentionally limited to non-obvious calculations/semantics.

### PRs #372–#381 — research-parity and final UI consistency

The generic Histogram maturity work is complete at the intended checkpoint:

- Scatter: box-region evidence, strongest contiguous-visit Logger navigation, saved setups and qualified/region CSV export;
- Table Generator: exact Median plus richer aligned X/Y/Z/reference/delta cell evidence, on top of weighted tune-table-node behavior;
- Distribution: saved setups/CSV plus exact fixed min/max/bin-width geometry for reproducible repeated tests and explicit outside-geometry provenance;
- Math Channels: historical references, comparisons/logical expressions, lazy conditionals and sample-aware `lag()` / `delta()` / moving `avg()` / timestamp-based `rate()` helpers;
- shared Histogram timeline docking: Logger, Table Generator, Distribution and Scatter preserve the same Hide/Show-controls edge-tab placement by re-parenting the complete `.timeline-wrap`, not the shell/toggle separately.

Manual browser testing confirmed the Table Generator, Distribution and expanded Math Channel behaviors pass practical use. The post-#381 docking fix was also confirmed visually across Logger and all timeline-backed Histogram surfaces.

Remaining Histogram work is cleanup/maintenance only unless a concrete user-visible gap is demonstrated:

1. later consolidate dormant duplicate/runtime-refinement code during the dedicated cleanup phase;
2. replace remaining text/DOM state bridges during cleanup only if they become correctness or maintenance problems;
3. preserve the shared timeline-wrapper docking invariant.

Do **not** start another broad Histogram rewrite.

## Phase 3 — MSQ tune enrichment and table correlation

Status: **Complete for the currently approved scope**

Implemented:

- normalized tune values/tables/curves/scalars;
- optional tune enrichment;
- explicit table + X/Y relationship metadata;
- tune table interpolation/correlation;
- observed/tune evidence and sample population.

**Table Generator rule:** a loaded MSQ table supplies geometry/breakpoint vectors/dimensions. It must not silently rewrite selected runtime analysis channels.

Tune/MSQ context is now also used deliberately where Analyzer questions require calibration context, including Ignition base-table attribution.

## Phase 4 — Specialized analyzers

Status: **Experimental foundations implemented; maturity uneven; current feature expansion paused**

The earlier Phase-4 completion meant that each planned analyzer existed with real calculations/evidence. It did not mean that each analyzer had equal practical tuning maturity.

### Shared Analyzer foundation — implemented

- semantic channel-role suggestions with manual override;
- Full Log / Current A/B / Saved Range scopes;
- contextual Logger A/B → Analyzer handoff;
- event/source navigation back to Logger;
- event-aligned evidence renderer;
- individual event selection vs aggregate view;
- shared saved Qualification where appropriate;
- grouped ALL/ANY qualification;
- per-scope provenance;
- shared numeric comparison;
- progressive disclosure of decision-facing vs secondary diagnostics;
- anchored round-`i` information/help;
- aligned-evidence canvas sizing tied to actual displayed dimensions.

### BOOST — mature experimental foundation, currently paused

Implemented capability-driven Open Loop / Closed Loop analysis, target-independent Open Loop pressure-rise spool, RPM×TPS/load operating points, evidence strength/consistency, matched-scope comparison, upper/lower chamber response summaries, sortable evidence tables and conservative observed interpretations.

Critical invariant remains:

> Boost interpretation is descriptive and polarity-agnostic. Do not infer an automatic duty-direction recommendation from observational duty/pressure association.

Repeated-pull/repeatability maturity remains a viable later step, but Boost is not the active work track now.

### IDLE — mature foundation, later parity/refinement

Implemented subsystem-aware Combined / DC Idle / IAC / ETB / Ignition views, canonical RPM/target semantics, runtime-vs-calibration DC Bias distinction, sag/recovery evidence and rich controller/actuator context.

Later useful work includes richer phase/settling/headroom metrics and tune/MSQ DC Bias curve context.

### AE / MAP PREDICT — useful foundation, later parity/refinement

Implemented aligned transient evidence, prediction mean/MAE, lean/rich excursion metrics and Logger navigation.

Later useful work includes richer event classification/timing/error metrics and comparison between event sets.

### FUELING — maturity checkpoint reached; freeze unless bug/regression

Fueling now includes:

- lambda-first actual/target semantics with Gas Scale AFR fallback;
- `veValue` as current effective VE and `veTableYAxis` as preferred VE/load coordinate;
- `actualLastInjection` as preferred command for observed mixture response delay;
- DFCO/other fuel-cut explanation and exclusion from ordinary steady-fueling conclusions;
- AE/decel transient context;
- trailing-window RPM/load stability rather than adjacent-sample jitter sensitivity;
- visible low-count bins with Weak/Moderate/Strong evidence;
- scale-aware mixture thresholds;
- STFT/LTFT/total-correction context;
- observed mixture-response-delay evidence;
- sortable evidence tables and Logger navigation;
- restrained/progressive presentation.

A Fueling heatmap experiment was rolled back because its DOM/layout integration caused page-load and graph-stretch regressions. Do not reintroduce a similar overview without a safer architecture and measured validation.

See `docs/FUELING_ANALYZER.md`.

### IGNITION — non-knock maturity checkpoint reached; freeze unless bug/regression

The current validation scope deliberately excludes knock diagnosis until trusted knock hardware/evidence is available.

Implemented non-knock behavior includes:

- final ignition advance as the primary signal;
- aggregate correction/retard, dwell, RPM and ignition-load context;
- timing-step/correction events;
- large-log-safe statistics/event paging;
- clean default event evidence with optional extra traces/envelopes;
- ranked stable-context **Areas to review**;
- configurable default review focus above 1000 rpm so cranking/start regions do not crowd the shortlist;
- Logger navigation;
- optional MSQ base-ignition-table comparison;
- source clues indicating base-table alignment, correction overlap, residual timing movement or insufficient explanatory evidence.

Ignition does **not** claim knock/detonation, judge timing as safe/unsafe, or recommend a specific advance change from observational logs alone.

### FUEL / INJECTOR and TRIGGER / SYNC — next broad-coverage candidates when Analyzer work resumes

These analyzers exist but have not received the same maturity depth as Fueling/Ignition.

When Analyzer work resumes, prefer bringing these and the remaining AE/Idle gaps toward similar practical usefulness before adding another deep layer to already-mature Fueling/Ignition.

### Range Compare / Tune Table

Continue extending shared scope/Qualification/tune-correlation infrastructure rather than forking analyzer-local equivalents.

## Analyzer development policy — current

Analyzer feature work is paused.

When resumed, the preferred order is:

1. improve practical coverage of the less-mature analyzers, beginning with Fuel / Injector and Trigger / Sync;
2. validate the same user-facing evidence/Logger-navigation principles across them;
3. address remaining practical AE / MAP Predict and Idle gaps;
4. stop each at a sensible maturity checkpoint;
5. then begin the dedicated code cleanup/consolidation/optimization phase.

Do not keep deepening one analyzer indefinitely while others remain thin.

## Dedicated cleanup/consolidation phase — deferred but approved direction

Once broader analyzer coverage is achieved, run an explicit cleanup pass across Logger/Analyzer/Histogram.

Candidate work includes:

- remove dormant duplicate editor paths;
- reduce analyzer-local/shared DOM enhancement layers;
- remove unnecessary MutationObservers;
- replace direct DOM state bridges with explicit state/contracts;
- rename Boost-specific helpers that became generic;
- consolidate shared table/event/help/rendering infrastructure;
- centralize canvas sizing/resize ownership;
- simplify CSS and runtime UI surgery;
- remove dead/unreachable branches and obsolete compatibility paths;
- re-profile representative large logs after consolidation.

Until then, do not destabilize mature behavior solely for internal tidiness.

## Correctness and safety refinement — current policy

Accepted correctness work includes defensive untrusted-input handling, explicit unavailable/missing data, source integrity reporting, large-array safety, timestamp-gap handling, controlled rendering of large evidence sets and local-first privacy.

Missing/ambiguous evidence must degrade the affected capability rather than fabricate a result.

## Performance / retained-memory status

The dedicated recorded-log performance campaign is complete for the current architecture.

Representative controlled 1.19 GB-log behavior remains sufficient for the current Web reference implementation. Retained-memory/source-lifetime diagnostics show no current cross-log strong-reference leak.

Do not resume broad micro-optimization or impose new retention policies without a concrete measured workload/regression.

## Phase 5 — Sessions, sharing and reporting

Status: **Not started — explicit owner approval required**

Potential future scope includes versioned full-session persistence, annotations/bookmarks, result snapshots and explicit sharing/publishing. No silent upload/telemetry of local log/tune content.

## Phase 6 — Web functional maturity review

Before Linux becomes primary focus:

- review feature completeness and workflow clarity;
- complete the deliberate cleanup/consolidation phase;
- consolidate duplicate concepts;
- freeze/version key contracts;
- profile representative workloads after cleanup;
- define Linux benchmark/hardware baselines;
- decide which Web internals are retained/replaced/ported.

## Phase 7 — Linux production implementation

Primary baseline: Debian 13 Stable.

Goals include native high-performance data path, low RAM, large-log indexing/bounded queries, responsive graphs/tables and preservation of established EpicScope semantics.

## Phase 8 — Linux feature expansion

Potential later work: persistent native indexes/caches, very large logs, optional file-library/watching workflows, direct ECU logging/live analysis if separately approved, additional analyzers and packaging/update strategy.

## Phase 9 — Android / EpicHub integration

Reuse proven core concepts after Linux/Web semantics mature; design tablet/mobile presentation independently where appropriate.

## Roadmap change control

New major feature groups must be placed deliberately in roadmap and architecture before implementation. A feature request alone does not authorize a new subsystem or architectural layer.

For exact present-tense continuation, always defer to `docs/HANDOFF.md`.
