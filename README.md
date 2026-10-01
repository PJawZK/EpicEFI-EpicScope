# EpicEFI – EpicScope

**EpicScope** is a high-performance ECU log analysis and tuning-diagnostics project for EpicEFI and compatible tuning workflows.

The project goal is not merely to display logged channels. EpicScope is intended to **scope a tune**: inspect recorded ECU behaviour, identify faults and weak areas, compare changes, and expose opportunities for improvement through tune-aware analysis.

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
- Supported source formats normalize into a common internal data model before analysis or presentation.
- Dependencies must justify their cost in runtime weight, maintenance, compatibility, or complexity.
- Compatibility with current stable Linux distributions is preferred over bleeding-edge dependencies.

## Initial technology direction

- Web: lightweight TypeScript, Chromium-first.
- Initial log format: MegaLogViewer / TunerStudio `.mlg`.
- Secondary import format: CSV.
- Linux target baseline: Debian 13 Stable.
- License: Apache License 2.0.

## Documentation authority

The project is defined by the documentation under [`docs/`](docs/):

- [`PRODUCT.md`](docs/PRODUCT.md) — product scope and feature map.
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system architecture and dependency boundaries.
- [`FILE_ARCHITECTURE.md`](docs/FILE_ARCHITECTURE.md) — approved repository and source layout.
- [`DATA_MODEL.md`](docs/DATA_MODEL.md) — normalized log, channel, event, session, and analyzer concepts.
- [`UI_REFERENCE.md`](docs/UI_REFERENCE.md) — approved EpicHub Logger/Analyzer interaction/layout reference as adapted for EpicScope.
- [`PERFORMANCE.md`](docs/PERFORMANCE.md) — performance and memory requirements.
- [`PLATFORMS.md`](docs/PLATFORMS.md) — Web, Linux, and Android platform policy.
- [`ROADMAP.md`](docs/ROADMAP.md) — staged implementation plan.
- [`WORKFLOW.md`](docs/WORKFLOW.md) — branching, task, review, handoff, and release workflow.
- [`DECISIONS.md`](docs/DECISIONS.md) — approved architectural/project decisions.
- [`HANDOFF.md`](docs/HANDOFF.md) — current project state for chat continuation.

## Status

EpicScope is currently in **Phase 1 — Web log foundation**. `WEB-REFERENCE` has established the initial UI/interaction authority; application code still waits for the concrete `WEB-BOOT` task split and tooling decision.
