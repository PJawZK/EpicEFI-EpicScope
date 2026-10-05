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
- File and module architecture is controlled architecture. New code must fit an approved responsibility and location.
- Architectural evolution is allowed only through explicit review and documented decisions.
- Supported source formats normalize into common internal models before analysis or presentation.
- Dependencies must justify their runtime, memory, compatibility, maintenance, or complexity cost.
- Compatibility with current stable Linux distributions is preferred over bleeding-edge dependencies.

## Initial technology direction

- Web: lightweight TypeScript, Chromium/Brave-first.
- Initial log format: MegaLogViewer / TunerStudio `.mlg`.
- Secondary import format: CSV, deferred until higher-value product work permits.
- Linux target baseline: Debian 13 Stable.
- License: Apache License 2.0.

## Current Web state

EpicScope Web now has functional foundations through **Phases 1–4**. Current work is refinement/usability rather than another architecture phase.

Implemented foundations include:

- MLG v1/v2 import, indexing, staged CRC validation and source-integrity diagnostics;
- INI-backed channel catalog/binding plus optional MSQ tune enrichment;
- reusable named graph workspaces and exact-log navigation persistence;
- multi-pane graphs, timeline/cursor, A/B ranges, markers and saved ranges;
- bounded session/persistent channel reuse plus the OPFS MLG column-sidecar/native-column path;
- full available-log channel catalog exposed to analysis with on-demand decode;
- generic range statistics, qualification/filters, Histogram, Scatter, Events and Compare foundations;
- Analyzer surfaces for Range Compare, Tune Table and the Experimental Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel Pressure / Injector and Trigger / Sync analyzers;
- Histogram surfaces for **Table Generator**, Distribution, Scatter and **Math Channels**;
- MLV-inspired Table Generator with weighted mean, custom/MSQ geometry, presets, grouped filters, calculated channels, CSV export and cell-to-Logger traceability.

The structural/file audit and intensive large-log optimization campaign are **done for now**. Performance remains a regression requirement. Do not reopen generic performance work without measured evidence.

## Current Histogram / Table Generator direction

Table Generator is the primary binned/table analysis surface. The former separate Heatmap and Dual Heatmap user-facing modes have been removed.

Important current behavior:

- **MLV weighted mean** is the first/default Cell statistic;
- plain Mean and the other numeric aggregations remain available;
- analysis X/Y/Z choices remain explicit user choices;
- Loaded MSQ tables provide **geometry only** — X/Y breakpoint vectors and dimensions — and do not rewrite selected analysis channels;
- common Auto-bin table sizes are available through **Size**;
- **Presets** are saved complete Table Generator setups;
- Filters use a compact saved-filter library plus grouped condition editor;
- Math Channels is a dedicated calculated-channel editor with source insertion, formula helpers, validation and preview;
- generated cells retain source sample evidence and can navigate back to Logger.

MLV weighted-mean parity is considered sufficiently matched for current use. A tiny remaining hit-count difference on one large reference cell is recorded as a compatibility footnote in `docs/DECISIONS.md`, not an active pursuit.

## Current UI workflow

The approved user-facing progression remains:

**1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

Current cleanup work favors a dense, visualization-first interface: remove redundant labels/rows, keep contextual controls compact, expose help where meaning is not obvious, and avoid letting development/diagnostic chrome compete with the analysis surface.

## Documentation authority

The project is defined by the documentation under [`docs/`](docs/):

- [`PRODUCT.md`](docs/PRODUCT.md) — product scope and feature map.
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture and dependency boundaries.
- [`FILE_ARCHITECTURE.md`](docs/FILE_ARCHITECTURE.md) — approved repository and source layout.
- [`DATA_MODEL.md`](docs/DATA_MODEL.md) — normalized log, channel, event, session, and analyzer concepts.
- [`UI_REFERENCE.md`](docs/UI_REFERENCE.md) — EpicHub-derived interaction reference plus EpicScope workflow/hierarchy rules.
- [`PERFORMANCE.md`](docs/PERFORMANCE.md) — performance and memory requirements and current large-log evidence.
- [`PLATFORMS.md`](docs/PLATFORMS.md) — Web, Linux, and Android platform policy.
- [`ROADMAP.md`](docs/ROADMAP.md) — staged implementation plan.
- [`WORKFLOW.md`](docs/WORKFLOW.md) — branching, task, review, handoff, and release workflow.
- [`DECISIONS.md`](docs/DECISIONS.md) — approved architectural/project decisions and compatibility footnotes.
- [`HANDOFF.md`](docs/HANDOFF.md) — **exact current continuation state and authority for a new chat/session**.

When historical/current-state wording elsewhere conflicts with `HANDOFF.md`, use the handoff plus current `main`/CI state.

## Web delivery

During the Web stage, EpicScope is built and validated by GitHub Actions and deployed from `main` to GitHub Pages. The project owner should be able to test the current Web build in Brave/Chromium without cloning the repository or installing Node/npm locally.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

Local log/tune analysis remains client-side unless an explicit future sharing feature is invoked.