<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. If a status statement in this document describes an older milestone, use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

<!-- CURRENT_STATE:current-performance-ownership:START -->
## Current performance-sensitive ownership

Current large-log hot paths remain inside approved areas:

- `core/parsers/mlg/` — MLG source access, indexing, bounded/multi-channel decoding and source-level performance accounting;
- `core/channels/` — stable channel/data-source binding and forwarding such as time→sample mapping;
- `apps/web/src/adapters/` — browser `File`/`Blob` access and the bounded persistent decoded-channel cache adapter;
- `apps/web/src/components/graph-viewport.ts` — Web-only graph activation/presentation lifecycle;
- `apps/web/src/pages/logger-page.ts` — workspace restore coordination, graph/timeline propagation and performance diagnostics integration.

The opportunistic predecode experiment was removed in PR #130 and does not authorize a new hot-set/preload subsystem. The persistent decoded-column cache remains bounded (128 columns) and user-clearable; it is reuse infrastructure, not the first-use architecture.

The next performance investigation must first try to reduce repeated source traversal within these existing boundaries. A new persistent columnar/indexed store, worker-owned long-lived data service, or other new subsystem requires explicit architecture review before introduction.
<!-- CURRENT_STATE:current-performance-ownership:END -->

<!-- CURRENT_STATE:current-performance-ownership:END -->

# EpicScope File Architecture

## Purpose

EpicScope treats repository/file structure as controlled architecture.

New source files must belong to an approved architectural area and responsibility. If a required implementation does not fit the current structure cleanly, the architecture must be reviewed and intentionally extended before that implementation is added.

Architectural evolution is allowed. Silent deviation is not.

## Authoritative logical tree

The structure below is the approved architecture for currently defined implementation areas. It is not a claim that all future Linux/Android directories can be predicted today.

Directories should be created physically only when their first legitimate task requires them; empty placeholder trees are discouraged.

```text
EpicEFI-EpicScope/
├── README.md
├── LICENSE
├── .gitignore                  # created by WEB-BOOT
├── package.json                # created by WEB-BOOT
├── package-lock.json           # generated/committed by WEB-BOOT
├── tsconfig.json               # created by WEB-BOOT
├── vite.config.ts              # created by WEB-BOOT
├── .github/
│   └── workflows/
│       ├── web-ci.yml          # Web validation
│       └── pages.yml           # main → GitHub Pages
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── FILE_ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── UI_REFERENCE.md
│   ├── WEB_BOOT_PLAN.md
│   ├── LOG_MLG_PLAN.md
│   ├── PERFORMANCE.md
│   ├── PLATFORMS.md
│   ├── ROADMAP.md
│   ├── WORKFLOW.md
│   ├── DECISIONS.md
│   └── HANDOFF.md
│
├── apps/
│   └── web/
│       ├── index.html
│       ├── src/
│       │   ├── main.ts
│       │   ├── app/
│       │   │   └── app-shell.ts
│       │   ├── pages/
│       │   │   └── logger-page.ts
│       │   ├── panels/
│       │   │   └── inspector-panel.ts
│       │   ├── components/
│       │   │   └── timeline-shell.ts
│       │   ├── state/          # approved area; create only when a real state task needs it
│       │   └── styles/
│       │       ├── tokens.css
│       │       └── app.css
│       └── tests/              # approved area; create only when a real test task needs it
│
├── core/
│   ├── log-model/
│   ├── parsers/
│   │   ├── mlg/
│   │   ├── csv/
│   │   ├── ini/
│   │   └── msq/
│   ├── channels/
│   ├── timeline/
│   ├── analysis/
│   ├── events/
│   ├── tune/
│   ├── compare/
│   ├── session/
│   └── persistence/
│
├── analyzers/
│   ├── boost/
│   ├── idle/
│   ├── ae/
│   ├── fueling/
│   ├── ignition/
│   ├── fuel-pressure/
│   └── trigger-sync/
│
├── shared/
│   ├── types/
│   ├── constants/
│   ├── units/
│   └── utilities/
│
├── tests/
│   ├── fixtures/
│   ├── logs/
│   ├── regression/
│   └── performance/
│
└── tools/
```

Future Linux, Android, sharing/backend, live-acquisition, or other application areas require an explicit architecture decision before their directories are added.

This tree is a controlled guideline with approval requirements, not permission to place code approximately where it seems convenient.

## GitHub workflow responsibilities

### `.github/workflows/web-ci.yml`

Authoritative Web branch/PR validation. It installs from the committed lockfile, type-checks, and performs the production Vite build. It must not deploy production Pages or become a source-code mutation mechanism.

Parser/core/persistence automated tests are now implemented with Vitest and this workflow is the required CI gate for them unless a separate workflow is deliberately approved.

### `.github/workflows/pages.yml`

Authoritative `main` → GitHub Pages build/deployment workflow. It builds the same Web application and deploys `dist/web` through GitHub Pages actions. Hosting must not weaken local-first privacy or imply a backend/upload path.

Temporary bootstrap workflows are allowed only for a narrowly defined repository-establishment task and must be removed before merge.

## Documentation responsibilities

### `docs/UI_REFERENCE.md`

Authoritative EpicScope interpretation of the approved EpicHub Logger/Analyzer interaction/layout reference.

It records:

- which EpicHub Logger/Analyzer concepts EpicScope inherits;
- which unrelated EpicHub application concepts are excluded;
- deliberate EpicScope UI deviations;
- reference behavior that implementation must preserve unless explicitly superseded.

It is a product/presentation contract, not permission to copy prototype implementation machinery into production code.

### `docs/WEB_BOOT_PLAN.md`

Historical task/file authority for the completed initial Web bootstrap batch.

It defines:

- approved Web bootstrap dependencies;
- approved repository-root tooling files;
- exact first physical Web source files;
- responsibilities and prohibited ownership for each bootstrap task;
- validation and completion criteria;
- explicit deferral of graph-library and parser/core test-framework decisions.

It is not blanket approval to add arbitrary dependencies or files in later Web tasks.

### `docs/LOG_MLG_PLAN.md`

Historical implementation authority for the completed first MLG import/parser batch. It remains the format/safety reference for v1/v2 parser behavior and future maintenance, but current implementation order is governed by `ROADMAP.md` and `HANDOFF.md`.

It defines:

- v1/v2 format authority and initial support scope;
- unsupported-version behavior for unverified newer MLG versions;
- corruption/untrusted-input requirements;
- bounded/random-access source-access requirements;
- minimal normalized log-model responsibilities needed by the parser;
- fixture and real-log validation strategy;
- the proposed parser/core automated-test strategy and its approval gate;
- exact LOG-MLG task ordering and completion criteria.

It does not authorize graph rendering, analyzer logic, tune parsing, CSV parsing, cloud upload, or speculative MLG v3 decoding.

## Repository-root tooling responsibilities

The following root files are approved specifically by WEB-BOOT:

### `.gitignore`

Generated dependency/build/editor artifact exclusions only.

### `package.json`

Minimal Web development scripts and approved development dependencies. It must not become a substitute for platform architecture.

### `package-lock.json`

Committed npm lockfile generated from the approved dependency set.

### `tsconfig.json`

Shared TypeScript compiler/type-check policy for currently implemented TypeScript source. Cross-area path aliases or project-reference complexity require a real need before introduction.

### `vite.config.ts`

Web build/dev-server configuration only. It must not contain domain/parser/analyzer logic.

## Directory responsibilities

### `apps/web/`

Web-specific application composition and presentation.

Allowed:

- application bootstrap;
- pages/workspaces;
- panels/components;
- Web state orchestration;
- Web-specific adapters;
- styling and interaction logic.

Not allowed:

- independent source-file parsers duplicated from `core/parsers/`;
- hidden domain analysis that should belong to `core/` or `analyzers/`;
- authoritative tune interpretation embedded only in UI components.

The exact initial physical files authorized for WEB-BOOT are listed in `docs/WEB_BOOT_PLAN.md`. Other approved logical areas under `apps/web/` remain uncreated until a legitimate task requires them.

LOG-MLG may create a Web-specific adapter under `apps/web/src/adapters/` only for browser `File`/`Blob` source access and import orchestration; binary MLG decoding remains in `core/parsers/mlg/`.

### `core/log-model/`

Normalized session/log/channel/sample contracts that form the neutral boundary between importers and consumers.

Parsers depend on these contracts to produce normalized data. Analysis and higher-level services depend on these contracts to consume normalized data.

LOG-MLG created the first physical contracts here for source identity/provenance, channel definitions, time/sample validity, markers/diagnostics, and bounded data access. Future INI-backed catalog work may extend normalized channel/source-context contracts only through the approved architecture and decisions.

### `core/parsers/`

Source-format decoders/importers.

Initial approved parser ownership includes:

- `mlg/` — MLG log decoding;
- `csv/` — CSV log decoding;
- `ini/` — INI source decoding needed for firmware/tune context;
- `msq/` — MSQ source decoding needed for tune context.

Parser modules own format-specific syntax/structure only. They produce approved normalized contracts and must not own analyzer semantics.

A format-neutral bounded byte-source contract may live directly under `core/parsers/` when needed by LOG-MLG and later binary parsers. Browser APIs must remain in the Web adapter layer.

### `core/channels/`

Channel discovery, units, aliases, grouping, stable logical channel identity/catalog services, source-to-log channel bindings, derived/math channel infrastructure, and channel-level transformations that are not domain-specific analysis.

For the approved INI-backed catalog workflow:

- `core/parsers/ini/` owns raw INI syntax;
- normalized known-channel definitions feed `core/channels/`;
- `core/channels/` owns matching/binding between logical channels and source-local MLG channels;
- sample arrays remain owned by the log data source rather than copied into the catalog.

### `core/timeline/`

Time navigation, ranges, markers, cursor-related model behaviour, indexing contracts, and view-oriented time queries that are shared beyond presentation.

### `core/analysis/`

Generic reusable analysis primitives such as filters, statistics, aggregation, histogram/heatmap preparation, scatter preparation, resampling, and qualification.

### `core/events/`

Reusable event definitions and detection services.

### `core/tune/`

Normalized firmware/tune context, table representations, axis/cell mapping, relationships between source settings and normalized tune structures, and tune-aware correlations.

INI may contribute firmware/table metadata to tune context, but stable runtime-channel catalog/binding concerns belong in `core/channels/`. MSQ later contributes actual tune/calibration values through `core/tune/`.

`core/tune/` must not become the raw INI/MSQ syntax parser. Raw source decoding stays in `core/parsers/ini/` and `core/parsers/msq/`.

### `core/compare/`

Session/event alignment, deltas, and comparison primitives.

### `core/session/`

Session composition/orchestration concepts that do not belong to presentation: relationships between logs, events, tune context, annotations, comparisons, and analyzer state.

This area must not become a second UI-state container.

### `core/persistence/`

Versioned serialization/deserialization, persistence contracts, migrations, and storage-independent persisted-artifact logic.

Platform-specific storage APIs stay behind application/platform adapters. Persistence logic must not assume that all sessions are cloud-backed or browser-backed.

### `analyzers/*/`

Domain-specific analyzers built on approved core services.

These modules interpret engine/tuning behaviour. They do not own source parsing or general UI state.

### `shared/`

Only genuinely cross-cutting, low-level definitions belong here.

`shared/` must not become a dumping ground. A helper that belongs to one subsystem stays with that subsystem.

### `tests/`

Cross-cutting test fixtures, regression data, representative log fixtures, and performance/benchmark suites.

Module-local tests may also live next to their implementation when that improves maintainability.

### `tools/`

Repository/development tooling that is not part of the shipped runtime application.

## Dependency direction

`core/log-model/` is a neutral contract boundary rather than merely the bottom of a simple linear stack.

Conceptually:

```text
source formats
     ↓
  parsers ───────→ log-model contracts ←────── core/analyzers consumers
```

Higher-level application flow remains:

```text
apps/web
   ↓
analyzers
   ↓
core services
   ↓
log-model contracts
```

Parsers are allowed to depend on `log-model` contracts because they produce normalized data. Consumers depend on the same contracts because they read normalized data.

Cross-cutting dependencies through `shared/` must remain small and justified.

Examples of prohibited coupling:

- `core/parsers/` importing `apps/web/`;
- `core/analysis/` depending on `analyzers/boost/`;
- `analyzers/idle/` reading MLG binary structures directly;
- `core/tune/` duplicating raw MSQ/INI decoding;
- UI components becoming the sole owner of calculations required by other analyzers.

## File creation rule

Before creating a production source file, the task should establish:

1. the architectural subsystem;
2. the file's responsibility;
3. its expected dependencies;
4. the corresponding test location/strategy where applicable.

A task should not create a new top-level architectural area incidentally.

## Architecture change rules

### FILE-ARCH-001 — Approved location required

All production source files must belong to an approved architectural area defined by this document.

### FILE-ARCH-002 — No feature-implied architecture changes

A new feature does not automatically authorize a new top-level directory, architectural layer, or cross-layer dependency.

### FILE-ARCH-003 — Review before deviation

If an implementation does not fit cleanly, stop at the design level and review the architecture first.

### FILE-ARCH-004 — Evolution is explicit

Approved architecture changes require:

1. project-owner approval;
2. an entry in `docs/DECISIONS.md`;
3. an update to this file;
4. an update to `docs/ARCHITECTURE.md` if system boundaries change;
5. roadmap/task adjustments where affected.

### FILE-ARCH-005 — No uncontrolled utility growth

Files or directories named generically such as `misc`, `stuff`, `temp`, `helpers2`, `new-utils`, or similar are not acceptable substitutes for deciding ownership.

Temporary development artifacts must not become production architecture.

## Task-to-file mapping

Roadmap/implementation tasks should identify their intended architectural location before coding.

Example:

```text
BOOST-001
Define boost analyzer data contract.
Location: analyzers/boost/

BOOST-002
Implement steady-state boost sample qualification.
Location: analyzers/boost/
Dependencies: core/analysis, core/events

BOOST-003
Implement boost presentation workspace.
Location: apps/web/src/pages/analyzer/boost/
```

The exact file names can evolve during implementation, but architectural ownership must remain explicit.

## Physical tree policy

Do not populate the repository with empty placeholder directories merely to mirror the logical tree. Create directories when their first approved task lands.

The documented structure remains authoritative for currently approved areas even when parts do not yet exist physically.
