# EpicScope Handoff

## Repository

`PJawZK/EpicEFI-EpicScope`

## Authoritative branch

`main`

Application baseline entering this docs-only handoff refresh:

`67cf7715f7c7dcab2b48f1589ef927270b872c82`

That commit is the merge of PR #199, **Complete Phase 4 Experimental analyzer surfaces**.

Post-merge validation on that exact application commit:

- Web CI: PASS — type-check, tests and production build;
- GitHub Pages build: PASS;
- GitHub Pages deploy: PASS.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

Normal owner testing is browser/GitHub-Pages based and must not require a local clone, Node.js or npm.

## Current project position

**Phases 1 through 4 are complete for the currently approved scope.**

Do not restart Logger/performance/layout campaigns without a concrete defect or new requirement. Logger is the stable recorded-log foundation and specialized analysis now sits on top of its read-only decoded analysis context.

The active implementation sequence has reached the end of **Phase 4 — Specialized analyzers**. This handoff deliberately does **not** begin Phase 5.

Next future phase, only when explicitly resumed:

> **Phase 5 — Sessions, sharing, and reporting**

Approved top-level workflow remains:

> **1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

## Current real EpicScope modes

The EpicScope logo dropdown is the mode/surface switcher.

### Logger

Recorded log viewing/navigation and source context:

- MLG loading and validation;
- optional INI channel catalog/binding;
- reusable workspaces and multi-pane graphs;
- active channel browser;
- shared viewport/cursor/timeline;
- A/B selection;
- markers and saved ranges;
- Channel Details/statistics;
- contextual range Analyze entry;
- exact-log persistence separated from reusable workspace state;
- large-log sidecar/cache architecture.

Logger is considered complete enough for the current phase. Change it only when a concrete defect or a required analysis integration hook justifies the change.

### Histogram

Generic binned/pair analysis over Logger's already-decoded active traces:

- Distribution;
- Heatmap;
- Scatter.

### Analyzer

Real analysis mode containing:

- Range Compare;
- Tune Table;
- Boost · Experimental;
- Idle · Experimental;
- AE / MAP Predict · Experimental;
- Fueling · Experimental;
- Ignition · Experimental;
- Fuel Pressure / Injector · Experimental;
- Trigger / Sync · Experimental.

Do not add another top-level mode when a view naturally belongs inside Logger, Histogram or Analyzer.

## Generic analysis foundation — implemented and deployed

### Range statistics

PR #175:

- reusable selected-range statistics;
- min/max/mean/sample standard deviation;
- valid/invalid counts;
- reversed A/B normalization;
- explicit complete vs partial decoded coverage;
- live Channel Details refresh on A/B changes.

### Qualification / filters

PR #177 / #178:

- `gt/gte/lt/lte/eq` comparison authority;
- multiple conditions with AND semantics;
- source-sample-index alignment;
- eligible / rejected / invalid / unavailable evidence;
- contextual A/B Analyze UI;
- no hidden source scan.

### Histogram / Heatmap / Scatter

PRs #179–#187:

- 1D Histogram;
- 2D Heatmap;
- Scatter;
- explicit source-index alignment and evidence counts;
- shared numeric aggregation;
- Count / Mean / Min / Max / sample Std dev Heatmap cell values;
- explicit value-channel evidence;
- deterministic Scatter presentation thinning only, while full valid-pair analysis counts remain authoritative.

### Events

PR #189 / #190:

- generic contiguous qualification-run events;
- explicit short-gap merge and minimum-duration semantics;
- invalid/unavailable samples break events;
- contextual Events UI reuses the same qualification conditions;
- presentation row limit does not alter full event counts.

### Compare

PR #191 / #192:

- generic left-vs-right numeric cohort comparison;
- per-side evidence and explicit coverage;
- right-minus-left absolute/relative deltas;
- Analyzer activated as a real mode;
- first UI compares two saved Logger ranges on one active decoded channel.

## Phase 3 — MSQ tune enrichment and table correlation — complete for current scope

### MSQ parser / tune model

PR #193:

- browser-independent raw MSQ decoding under `core/parsers/msq/`;
- normalized tune values under `core/tune/`;
- scalar/vector/table/text classification;
- source/page/units/dimensions retained;
- MSQ remains optional tune enrichment, never the runtime channel catalog;
- table-axis relationships are not guessed from variable names.

### Table correlation

PR #194:

- explicit `table + X axis + Y axis` relationships;
- ascending/descending axis support;
- clamped bilinear tune-value lookup;
- nearest-cell sample population;
- sample count / observed statistics / interpolated tune evidence;
- observed-minus-tune error is explicit opt-in only.

### End-to-end tune UI

PR #195:

- **Load MSQ…** under Load Data;
- session-only normalized tune context;
- Analyzer **Tune Table** subview;
- explicit table/X-axis/Y-axis selections;
- explicit decoded X/Y/observed channel selections;
- A/B or saved-range scope;
- compatibility is not silently assumed;
- no ECU writing or tune editing.

## Phase 4 — Specialized analyzers — COMPLETE

All specialized analyzers begin at **Experimental** maturity. Do not promote to Beta/Stable without validation evidence from representative real logs and workflows.

Shared Phase 4 rules:

- use already-active decoded Logger traces;
- explicit channel roles instead of firmware-specific hard-coded names in analysis cores;
- A/B or saved-range scope;
- source sample indices and times retained for events;
- invalid/unavailable evidence must remain explicit;
- caller-owned complete/partial decoded coverage;
- no hidden full-log/source reads;
- no ECU write/burn/tune mutation;
- presentation limits must not masquerade as analysis limits.

### Boost — Experimental

PR #196 / #197:

- measured pressure required;
- target, RPM, upper duty and lower duty optional;
- target tracking: mean error, MAE, RMSE, overshoot and undershoot;
- configurable spool events;
- configurable steady-state windows;
- upper/lower wastegate-duty summaries;
- explicit channel/configuration UI.

### Idle — Experimental

PR #198 / #199:

- RPM/target tracking;
- idle-valve duty;
- bias/feed-forward;
- P/I/D terms where available;
- configurable sag detection;
- recovery-to-band timing.

### AE / MAP Predict — Experimental

PR #198 / #199:

- TPS tip-in/decel event detection;
- configurable event window;
- measured MAP response;
- predicted-vs-measured MAP error;
- AFR lean/rich excursion evidence.

### Fueling — Experimental

PR #198 / #199:

- actual/target AFR tracking;
- configurable error deadband;
- lean/rich evidence counts;
- optional VE/fuel-value context.

### Ignition — Experimental

PR #198 / #199:

- advance/retard/knock aggregates;
- configurable knock threshold;
- grouped knock events;
- peak knock with advance/retard context.

### Fuel Pressure / Injector — Experimental

PR #198 / #199:

- fuel pressure;
- rail differential pressure;
- injector pulse width;
- injector duty;
- injector deadtime;
- configurable low-pressure events;
- configurable high-duty events.

### Trigger / Sync — Experimental

PR #198 / #199:

- sync-state evidence;
- trigger-error evidence;
- sync-loss counter evidence;
- RPM context;
- sync-state dropout events;
- trigger-error threshold events;
- sync-loss counter increment events.

The six non-Boost Phase 4 analyzers share `core/analysis/specialized-analyzers.ts` and a reusable Experimental Analyzer UI surface while retaining domain-specific channel roles, thresholds, metrics and event tables.

## Analysis provenance rules — authoritative

Analysis must not silently discard or invent evidence.

Where applicable retain or expose:

- input sample count;
- valid sample count;
- invalid sample count;
- unavailable/not-decoded count;
- rejected/outside-range counts;
- source sample indices;
- selected time/range scope;
- complete vs partial decoded coverage;
- explicit X/Y/value/filter semantics;
- explicit aggregation method;
- event detection thresholds/configuration.

If a trace does not fully cover the requested scope, do not present the result as complete.

## Large-log architecture — do not reopen without evidence

The large-log performance campaign remains done for now.

Primary benchmark architecture:

1. session RAM full-range cache;
2. OPFS MLG sidecar native-width transposed stripes;
3. sparse native OPFS per-channel cache;
4. original row-reader fallback.

Do not restart generic performance optimization unless a concrete regression or new feature demonstrates a bottleneck.

## Phase boundary

**STOP HERE. Phase 4 is complete.**

Do not begin implementation of Phase 5 from this handoff unless the project owner explicitly asks to continue.

When resumed, Phase 5 in `docs/ROADMAP.md` covers sessions, sharing and reporting. Any backend/share architecture still requires explicit approval before new top-level areas or upload/telemetry behavior are introduced.
