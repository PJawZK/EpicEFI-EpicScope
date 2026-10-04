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

EpicScope Web is a hosted, usable large-log analysis foundation with:

- MLG v1/v2 import, indexing, staged CRC validation and source-integrity diagnostics;
- INI-backed channel catalog and conservative INI↔MLG binding;
- reusable named graph workspaces and exact-log navigation persistence;
- multi-pane graphs, timeline/cursor, A/B ranges, markers and saved ranges;
- bounded session/persistent channel reuse plus the OPFS MLG column-sidecar/native-column path;
- large-log performance diagnostics and tested report/health formatting;
- a simplified channel browser with tested search/group/Active/Favorites/Recent semantics and live unit-aware values.

The structural/file audit and the earlier large-log optimization campaign are **done for now**. Performance remains a regression requirement, but the active product focus has moved to UI hierarchy and then generic analysis capability.

## Current UI workflow

The approved user-facing progression is:

**1. Load Data → 2. Channels → 3. Navigate → 4. Select / qualify range → 5. Analyze → 6. Compare / Export**

Implemented UI hierarchy work through PR #172 includes:

- **Load Data ▾** replacing separate Open Log / Load INI top-level buttons;
- **Graphs · <workspace> ▾** making workspace meaning explicit;
- the **EpicScope logo dropdown** acting as the in-product mode switcher, currently exposing Logger and planned Analyzer / Histogram modes;
- removal of empty top-level Tools / Compare placeholders;
- a clearer **Channels / Channel browser** hierarchy with compact sort controls, a primary **Load now** action, and secondary actions under `⋯`;
- standardized channel readouts such as `848 rpm`, `2.1 %`, `λ 0.987`, and `82.2 °C` without value bars.

The next planned UI pass is the larger timeline restructuring: **Navigate → Range/Markers → Analyze**, ordered by normal frequency and importance while preserving existing timeline/range functionality.

## Documentation authority

The project is defined by the documentation under [`docs/`](docs/):

- [`PRODUCT.md`](docs/PRODUCT.md) — product scope and feature map.
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture and dependency boundaries.
- [`FILE_ARCHITECTURE.md`](docs/FILE_ARCHITECTURE.md) — approved repository and source layout.
- [`DATA_MODEL.md`](docs/DATA_MODEL.md) — normalized log, channel, event, session, and analyzer concepts.
- [`UI_REFERENCE.md`](docs/UI_REFERENCE.md) — EpicHub-derived interaction reference plus current EpicScope workflow/hierarchy rules.
- [`PERFORMANCE.md`](docs/PERFORMANCE.md) — performance and memory requirements and current large-log evidence.
- [`PLATFORMS.md`](docs/PLATFORMS.md) — Web, Linux, and Android platform policy.
- [`ROADMAP.md`](docs/ROADMAP.md) — staged implementation plan and current execution position.
- [`WORKFLOW.md`](docs/WORKFLOW.md) — branching, task, review, handoff, and release workflow.
- [`DECISIONS.md`](docs/DECISIONS.md) — approved architectural/project decisions.
- [`HANDOFF.md`](docs/HANDOFF.md) — exact current continuation state.

## Web delivery

During the Web stage, EpicScope is built and validated by GitHub Actions and deployed from `main` to GitHub Pages. The project owner should be able to test the current Web build in Brave/Chromium without cloning the repository or installing Node/npm locally.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

Local log/tune analysis remains client-side unless an explicit future sharing feature is invoked.
