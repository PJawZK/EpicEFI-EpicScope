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

Future formats must normalize through approved internal models rather than leaking source-format semantics into analyzers or UI.

## D-009 — Normalized data authority

**Status:** Approved

Parsers normalize source data into the appropriate common contracts before generic analysis or presentation.

Log sources such as MLG/CSV normalize into log/channel/time contracts. Tune/configuration sources such as INI/MSQ normalize into tune/firmware contracts.

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

Default code naming rules are defined in `WORKFLOW.md`: kebab-case directories/files, PascalCase exported types/classes, camelCase functions/variables, and documented task/decision identifiers.

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

The exact current reference must be inspected/identified before Phase 1 shell implementation so the UI is not reconstructed from memory alone.

## D-024 — Handoff system

**Status:** Approved

EpicScope uses a single continuously updated `docs/HANDOFF.md` file for chat continuation.

The handoff summarizes the latest valid project state and points to authoritative documents. It is not a transcript or duplicate architecture specification.

A new chat should be able to continue from a short instruction such as: **“Read the EpicScope repository handoff and continue from there.”**

## D-025 — Project-owner architecture approval

**Status:** Approved

Architectural changes require project-owner approval before implementation.

Contributors, implementation agents, and future chats may propose changes but may not self-authorize structural deviation simply by editing architecture documents or the decision log.

## D-026 — Parser/tune ownership

**Status:** Approved

Raw source-format decoding belongs under `core/parsers/`.

MLG and CSV are log parsers. INI and MSQ decoding also belong under parser ownership when tune-awareness is implemented.

`core/tune/` owns normalized firmware/tune/table semantics and relationships, not raw INI/MSQ syntax parsing.

## D-027 — Session and persistence ownership

**Status:** Approved

`core/session/` is the approved home for non-UI session composition/orchestration.

`core/persistence/` is the approved home for storage-independent serialization, schema versioning, migration, and persisted-artifact compatibility logic.

Platform-specific storage remains behind application/platform adapters.

## D-028 — Untrusted input policy

**Status:** Approved

Imported logs, tune files, session files, metadata, and shared artifacts are untrusted input.

Parsers/importers must validate file-provided sizes, offsets, counts, strings, and similar fields before allowing them to drive allocation or execution behavior.

Malformed input must not cause uncontrolled memory allocation or silently fabricated data.

## D-029 — Extended local-first privacy

**Status:** Approved

Local-first privacy includes network behavior.

Without explicit user action/consent, EpicScope must not transmit log contents, tune contents, filenames, derived values, or analysis results to remote services or analytics systems.

Any future telemetry requires separate review and must not silently include tune/log content.

## D-030 — Capability-driven boost analyzer

**Status:** Approved

The Boost Analyzer must not be architecturally limited to the user's current upper/lower chamber setup.

It should support single-duty, dual-solenoid, upper/lower chamber, open-loop, and closed-loop arrangements where logged channels/context permit, while keeping the current upper/lower chamber system as an important first-class use case.

## D-031 — Current file tree is deliberately incomplete

**Status:** Approved

`FILE_ARCHITECTURE.md` defines approved currently known implementation areas, not a speculative complete future tree.

Linux, Android, sharing/backend, live-acquisition, or other new platform areas require explicit approval before their directories/layers are introduced.

This does not permit deviation from the current map; it requires deliberate extension of the map first.

## D-032 — Domain session and workspace state are separate

**Status:** Approved

`Session` is the top-level domain analysis context and must not become a general UI-state container.

Presentation/application workspace state may be persisted alongside a session artifact, but it remains conceptually separate so Web, Linux, and Android can use different workspace representations without changing core session semantics.

`core/persistence/` may serialize both through a versioned persisted artifact while preserving that separation.

## D-033 — EpicScope UI reference authority

**Status:** Approved

`docs/UI_REFERENCE.md` is the authoritative EpicScope interpretation of the reviewed EpicHub Logger/Analyzer reference.

The authoritative prototype inspected during `WEB-REFERENCE` is `EpicHub-Tablet-Landscape-0.0.45(2).html`, together with current EpicHub UI architecture. It supersedes the older `EpicHub-1.12.1_TabletLandscape.html` prototype for EpicScope UI-reference purposes.

EpicScope inherits the Logger/Analyzer graph, timeline, channel, Scatter, Histogram/Table, Math Channels, comparison, range/marker, workspace, sensor/timeline visibility, and related analysis interaction concepts, but not the broader EpicHub application shell or Android implementation architecture.

Approved EpicScope refinements include:

- a dedicated EpicScope shell rather than EpicHub's module switcher;
- consistent right-side analysis/detail controls on wide layouts, including moving Scatter/Histogram/Table control responsibility from the prototype's left side to the right;
- preserve 0.0.45's explicit loaded-log identity and sensor/timeline edge-control concepts where applicable;
- offline/imported-log focus for initial Web development;
- Trigger Logger deferred unless deliberately added later;
- performance and memory requirements may simplify visual implementation while preserving capability.

Prototype demo/localStorage/JSON machinery is not production architecture. The 0.0.45 `REC` control is a UI/reference concept only until EpicScope live acquisition/recording architecture is explicitly approved.

Future changes to this UI reference require explicit review and a superseding decision where they alter these approved semantics.

## D-034 — WEB-BOOT Web toolchain

**Status:** Approved

The initial EpicScope Web bootstrap uses:

- npm with a committed lockfile;
- Vite 8.x;
- vanilla TypeScript 7.x;
- browser-native HTML/CSS/DOM APIs;
- Chromium/Brave as the primary development/smoke-test target.

No frontend framework, graph/chart library, state-management framework, CSS framework, or general UI component library is approved as part of WEB-BOOT.

TypeScript checking and Vite production-build validation are required bootstrap checks. A dedicated automated test framework is intentionally deferred until parser/core logic requires it, at which point the relevant task must review and document the choice before implementation.

The Web-development Node.js requirement imposed by Vite is a build-tool requirement only and does not redefine the eventual Linux end-user platform baseline.

`docs/WEB_BOOT_PLAN.md` is the detailed authority for the initial bootstrap task split and exact files.

## D-035 — GitHub-hosted Web delivery

**Status:** Approved

During the Web stage, the normal project-owner workflow must not require a local clone, Node.js, npm, or a development environment.

GitHub Actions is the authoritative automated Web build/type-check path and GitHub Pages is the normal hosted browser test/distribution surface. Local development remains optional for contributors.

The Pages-hosted application is still local-first: selecting a local log/tune file for analysis must not upload its contents merely because the application itself is hosted by GitHub Pages.

The initial repository Pages path is `/EpicEFI-EpicScope/`, and Vite build configuration must respect that base path.

`web-ci.yml` owns branch/PR validation. `pages.yml` owns `main` build/deployment. Pages source may require the one-time repository setting **Settings → Pages → Source: GitHub Actions**.


## D-036 — Web workspace persistence v1

**Status:** Approved

The Phase 1 Web application persists presentation/workspace state locally per matching source log using a versioned `epicscope.web-workspace` v1 artifact.

Rules:

- Web WorkspaceState remains presentation/application state and is not promoted into the domain `Session`;
- storage-independent versioning/compatibility handling belongs under `core/persistence/`;
- browser storage is a Web adapter and must not leak browser APIs into core persistence;
- the Web persistence key uses the existing source identity, which includes filename, file size and last-modified identity for local MLG files;
- persisted workspaces may include graph-workspace state, selected channels, viewport/cursor state, annotations/ranges, inspector state and Web settings;
- raw log bytes and decoded channel arrays are not persisted;
- unknown/malformed artifact versions are rejected explicitly and must not be silently overwritten during automatic restore/save;
- the user must have an explicit local **Forget saved workspace** action;
- persistence remains local-first and does not authorize network transmission or cloud storage.


## D-037 — INI-backed channel catalog and log binding

**Status:** Approved

EpicScope will use normalized INI information as the preferred source of stable known runtime/output-channel definitions independently of any one opened log.

Rules:

- raw INI syntax decoding belongs under `core/parsers/ini/`;
- stable logical channel identity/catalog responsibilities belong under approved channel/source-context services, not the Web UI;
- an opened MLG remains authoritative for recorded sample values and source validity;
- EpicScope binds logical catalog channels to matching MLG channels when data exists;
- a catalog channel may remain visible as **known, no data** when absent from the current log;
- usable **log-only** channels remain available even when the loaded INI does not define them;
- MLG field position/index may remain a source-local identifier but must not be the sole long-term persisted workspace identity once catalog binding is available;
- INI remains optional for ordinary log analysis.

This decision intentionally allows TUNE-INI/channel-catalog work to proceed before the deferred CSV importer. D-008 still defines CSV as the secondary log format; it no longer implies that CSV must be the next implementation task after MLG.

## D-038 — Persistent application workspace is independent of exact log identity

**Status:** Approved

The long-term workspace model separates reusable application configuration from recording-specific analysis state.

Reusable application workspace state may persist:

- named workspaces;
- fixed/freeform pane layout and geometry;
- stable logical channel assignments;
- favorites and presentation preferences;
- other configuration that should exist before a log is opened.

Recording-specific state remains associated with the relevant log/session, including viewport/cursor position, A/B state, source-specific markers/ranges, and similar navigation context.

The current `epicscope.web-workspace` v1 exact-log persistence from D-036 remains valid implemented behavior until a versioned migration/replacement lands. Future persistence must not silently reinterpret incompatible v1 artifacts.

## D-039 — MSQ is optional tune-value enrichment, not the runtime-channel catalog

**Status:** Approved

MSQ support follows the INI-backed channel/source-context foundation.

Rules:

- raw MSQ syntax decoding belongs under `core/parsers/msq/`;
- MSQ supplies actual tune/calibration values, tables, curves, and scalar settings through normalized tune context;
- MSQ does not replace INI as the preferred stable runtime/output-channel definition source;
- MSQ does not replace MLG as the authority for recorded runtime samples;
- compatibility between loaded INI, MSQ, and logs must be surfaced explicitly rather than guessed or silently coerced.

## Superseding decisions

A decision is not removed merely because it becomes obsolete. A later entry should explicitly state that it supersedes the older decision and explain the approved replacement.
