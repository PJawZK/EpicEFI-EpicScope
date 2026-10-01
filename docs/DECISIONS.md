# EpicScope Decision Log

This file records approved project and architectural decisions that future implementation must respect until deliberately superseded.

## D-001 — Product name

**Status:** Approved

The project is named **EpicEFI – EpicScope** for formal/outward-facing use and **EpicScope** as the compact application/project name.

The project concept is to **scope a tune**: inspect ECU/log behaviour to identify faults and opportunities for improvement.

## D-002 — Platform development order

**Status:** Approved

Development order is:

1. Web
2. Linux
3. Android / EpicHub

Web is the functional reference. Linux is the primary production/performance target. Android follows after behaviour and performance architecture are mature.

## D-003 — Web technology direction

**Status:** Approved

EpicScope Web uses lightweight TypeScript as the default direction.

A large frontend framework is not assumed and requires justification before adoption.

## D-004 — Primary browser target

**Status:** Approved

Chromium is the primary Web target, with Brave treated as the user's first-class practical test browser.

Other browser families may be added later without delaying initial development.

## D-005 — Linux baseline

**Status:** Approved

Debian 13 Stable is the minimum authoritative Linux target.

Raising the minimum requires substantial demonstrated benefit; development convenience alone is insufficient.

## D-006 — Performance priority

**Status:** Approved

Log-reading/analysis speed and low RAM use outrank visual polish.

The mature Linux goal includes interactive analysis of a supported 1 GiB log on a 2 GiB RAM system without holding the complete source log in memory.

## D-007 — Web optimization policy

**Status:** Approved

Web development prioritizes discovering and validating the complete functional model before deep native-style optimization.

Obviously wasteful data architecture is still prohibited. Final performance optimization belongs primarily to the Linux stage once major feature requirements are known.

## D-008 — Initial source formats

**Status:** Approved

MLG is the first-class initial log format. CSV follows as the secondary import format.

Future formats must normalize through the same internal data model.

## D-009 — Normalized data authority

**Status:** Approved

Parsers normalize source data into common log/channel/time/session contracts before generic analysis or presentation.

Analyzers and UI must not become source-format parsers.

## D-010 — Controlled file architecture

**Status:** Approved

Repository/file architecture is controlled architecture.

New production code must fit an approved architectural responsibility/location. If it does not, architecture must be reviewed and updated before implementation.

Architecture may evolve explicitly; silent deviation is prohibited.

## D-011 — Task-to-file planning

**Status:** Approved

Implementation work should be split into architectural tasks that identify ownership/location, dependencies, validation, and completion criteria before coding.

A feature request does not automatically authorize a new top-level subsystem.

## D-012 — Repository workflow

**Status:** Approved

`main` is authoritative. Normal development should use short-lived task/feature branches and pull-request review before merge.

Long-lived parallel architecture branches are discouraged unless explicitly approved.

## D-013 — Versioning

**Status:** Approved

EpicScope uses semantic-style versioning.

`0.x` covers evolving Web/architecture development. `1.0` is reserved for a stable production baseline expected to align with mature Linux delivery rather than merely first Web availability.

## D-014 — License

**Status:** Approved

EpicScope is open source under the Apache License 2.0.

## D-015 — Dependency discipline

**Status:** Approved

Dependencies must justify their runtime, memory, maintenance, compatibility, and architectural cost.

Dependencies that materially raise Linux/runtime requirements or introduce major framework coupling require explicit review.

## D-016 — Privacy model

**Status:** Approved

Local log analysis is local by default.

Upload/share/publish functions are optional explicit actions and must never be required simply to analyze a local log.

## D-017 — Test-data policy

**Status:** Approved

Small curated fixtures may live in the repository. Large real logs must not casually bloat normal Git history and require a deliberate artifact/test-data strategy.

## D-018 — Benchmark policy

**Status:** Approved

Performance benchmarks exist from early development to detect regressions, even though Web is not required to satisfy final Linux targets.

Linux performance claims must eventually be measurement-driven on representative logs/hardware.

## D-019 — Error-handling policy

**Status:** Approved

Malformed files, missing channels, incompatible tune context, and unavailable analyzer inputs should degrade affected functionality where possible rather than crash the entire session.

Invalid/missing data must not be silently substituted with fabricated values.

## D-020 — Feature maturity labels

**Status:** Approved

Major analyzers/features use **Experimental**, **Beta**, and **Stable** maturity states.

Promotion requires validation evidence.

## D-021 — Naming conventions

**Status:** Approved

Consistent file/module/analyzer/channel terminology will be maintained. Exact source channel names should be preserved where useful, especially TunerStudio/MegaLogViewer terminology.

Generic dumping-ground names such as `misc`, `stuff`, or `helpers2` are not acceptable architectural ownership.

## D-022 — Compatibility policy

**Status:** Approved

Persisted sessions/public schemas must be versioned once introduced. Breaking changes require backward-compatible extension, migration, or explicit unsupported-version handling.

Silent compatibility breakage is prohibited.

## D-023 — EpicHub UI relationship

**Status:** Approved

The EpicHub Logger/Analyzer interaction model is the starting UI authority for EpicScope, not the full EpicHub application.

Relevant established behaviours include a consistent right-side details/settings area and timeline/navigation concepts already developed for the Logger/Analyzer work.

EpicScope may refine these behaviours as its analysis requirements mature.

## D-024 — Handoff system

**Status:** Approved

EpicScope uses a single continuously updated `docs/HANDOFF.md` file for chat continuation.

The handoff summarizes the latest valid project state and points to authoritative documents. It is not a transcript or duplicate architecture specification.

A new chat should be able to continue from a short instruction such as: **“Read the EpicScope repository handoff and continue from there.”**

## Superseding decisions

A decision is not removed merely because it becomes obsolete. A later entry should explicitly state that it supersedes the older decision and explain the approved replacement.
