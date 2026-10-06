# EpicEFI – EpicScope

**EpicScope** is a high-performance ECU log analysis and tuning-diagnostics project for EpicEFI and compatible tuning workflows.

The product goal is not merely to display logged channels. EpicScope is intended to **scope a tune**: inspect recorded ECU behaviour, identify faults and weak areas, compare changes, and expose opportunities for improvement through tune-aware analysis.

## Project direction

EpicScope is developed in three deliberate stages:

1. **Web** — functional reference and feature-validation platform.
2. **Linux** — primary production application, optimized for speed, low RAM usage, very large logs, and native file handling.
3. **Android / EpicHub** — later reuse of proven analysis concepts and core logic.

The Web implementation establishes **what EpicScope should do**. The Linux implementation becomes the authority for **how efficiently it can do it**.

## Core principles

- Performance and log-reading speed take priority over visual effects.
- The mature Linux application targets operation on low-resource systems.
- A 2 GiB RAM system must ultimately be able to interactively analyze a 1 GiB supported log without requiring the entire log in memory.
- Local analysis stays local unless the user explicitly chooses to share or publish data.
- File and module architecture is controlled architecture.
- Supported source formats normalize into common internal models before analysis/presentation.
- Dependencies must justify their runtime, memory, compatibility, maintenance, or complexity cost.

## Technology direction

- Web: lightweight TypeScript, Chromium/Brave-first.
- Initial log format: MegaLogViewer / TunerStudio `.mlg`.
- Secondary import format: CSV, deferred.
- Linux target baseline: Debian 13 Stable.
- License: Apache License 2.0.

## Current Web state

EpicScope Web has functional foundations through **Phases 1–4**. Current work is maturity/refinement inside those existing modes, with active focus on **Analyzer usefulness and evidence-driven tuning workflows**.

Implemented foundations include:

- MLG v1/v2 import, indexing, staged CRC validation and source-integrity diagnostics;
- INI-backed channel catalog/binding plus optional MSQ tune enrichment;
- reusable named graph presets/workspaces and exact-log navigation persistence;
- multi-pane fixed/freeform graphs, timeline/cursor, A/B ranges, markers and saved ranges;
- bounded session/persistent channel reuse plus OPFS column-sidecar/native-column access;
- full available-log channel catalog exposed to analysis with on-demand decode;
- Histogram surfaces for **Table Generator, Distribution, Scatter and Math Channels**;
- Analyzer surfaces for Range Compare, Tune Table and the Experimental Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel / Injector and Trigger / Sync analyzers;
- Logger/Histogram/Analyzer evidence navigation back to the source log;
- retained-memory and runtime-health diagnostics.

## Current Logger direction

Named graph workspaces function as real graph presets.

Current invariant:

> **Every available channel assigned to a visible pane must be active/rendered.**

This applies after workspace restore/switch, layout changes and Freeform visibility changes. Unavailable channels remain assigned without becoming false active traces.

Freeform safely ignores geometry for out-of-layout hidden panes.

## Current Histogram direction

### Table Generator

- **Weighted Mean** is the visible/default MLV-style weighted statistic;
- analysis X/Y/Z choices remain explicit user choices;
- Loaded MSQ tables provide **geometry only** — X/Y breakpoint vectors/dimensions — and do not rewrite selected runtime analysis channels;
- the toolbar uses **Table Size**; the old separate Size button is removed;
- presets save complete Table Generator setups;
- grouped filters and Math Channels are reusable analysis inputs;
- generated cells retain source evidence and can open contributing samples in Logger.

### Distribution

Distribution now supports Full Log / A-B scope, Count/%/Time modes, automatic/manual bins, Histogram/Cumulative views, percentile statistics, saved-range comparison and clickable bin evidence with Logger navigation.

### Scatter

Scatter now supports Full Log / A-B, Single/Dual plots, Dots/Lines, density heat coloring, the shared Logger timeline and shared Hide/Show controls.

## Current Analyzer direction

Analyzer is being moved from summary-only screens toward evidence-driven tuning tools.

Shared current foundation:

- semantic channel-role suggestions with visible manual override;
- Full Log / Current A-B / Saved Range scopes;
- event→Logger navigation;
- reusable event-aligned evidence graphs with median and 10–90% envelopes.

Idle and AE / MAP Predict are the first analyzers using that richer evidence model.

Idle now explicitly separates:

- Combined;
- DC Idle;
- IAC Valve;
- ETB;
- Ignition.

RPM strongly prefers the canonical EpicEFI `RPMValue` runtime channel. Idle Target is required for sag/recovery analysis.

The **DC Bias calibration curve/table is calibration data, not a scalar logged channel**. Analyzer only treats a distinct **DC Bias output (runtime)** as runtime evidence; future curve/current-point analysis belongs to tune/MSQ context.

Next shared Analyzer work is comparison between ranges/event sets, reusable qualification filters/stable-state logic, confidence/coverage indicators, derived analysis signals and analyzer presets before expanding Boost/Fueling and the remaining specialist analyzers.

## Performance status

The intensive large-log architecture campaign is done for now. Performance remains a regression requirement.

Retained-memory instrumentation has also been added. A browser-session replacement test of the ~295 MB log followed by the ~1.2 GB log showed the previous source collected and zero previous live sources, so there is currently no evidence of a cross-log strong-reference retention leak.

No new LRU/byte budget is imposed without a concrete single-log many-channel stress result or another measured regression.

## Current UI workflow

The approved progression remains:

**1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

Current UI work favors a dense, visualization-first interface with redundant labels/controls removed and contextual controls grouped consistently across modes.

## Documentation authority

The project is defined by the documentation under [`docs/`](docs/):

- [`PRODUCT.md`](docs/PRODUCT.md) — product scope and feature map.
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture and dependency boundaries.
- [`FILE_ARCHITECTURE.md`](docs/FILE_ARCHITECTURE.md) — approved repository/source layout.
- [`DATA_MODEL.md`](docs/DATA_MODEL.md) — normalized log/channel/event/session/analyzer concepts.
- [`UI_REFERENCE.md`](docs/UI_REFERENCE.md) — EpicScope interaction/hierarchy rules.
- [`ANALYZER.md`](docs/ANALYZER.md) — current Analyzer semantics and maturity direction.
- [`PERFORMANCE.md`](docs/PERFORMANCE.md) — performance/memory requirements and evidence.
- [`ROADMAP.md`](docs/ROADMAP.md) — staged implementation plan and current refinement track.
- [`WORKFLOW.md`](docs/WORKFLOW.md) — branching/task/review/handoff workflow.
- [`DECISIONS.md`](docs/DECISIONS.md) — approved architectural/project decisions.
- [`HANDOFF.md`](docs/HANDOFF.md) — **exact current continuation state for a new chat/session**.

When historical/current-state wording elsewhere conflicts with `HANDOFF.md`, use the handoff plus current `main`/CI state.

## Web delivery

EpicScope Web is built/validated by GitHub Actions and deployed from `main` to GitHub Pages. Owner testing should work in Brave/Chromium without cloning the repository or installing Node/npm locally.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

Local log/tune analysis remains client-side unless an explicit future sharing feature is invoked.
