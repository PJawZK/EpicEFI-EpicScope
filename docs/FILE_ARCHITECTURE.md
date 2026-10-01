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
├── docs/
│   ├── PRODUCT.md
│   ├── ARCHITECTURE.md
│   ├── FILE_ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── UI_REFERENCE.md
│   ├── PERFORMANCE.md
│   ├── PLATFORMS.md
│   ├── ROADMAP.md
│   ├── WORKFLOW.md
│   ├── DECISIONS.md
│   └── HANDOFF.md
│
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── pages/
│       │   ├── panels/
│       │   ├── components/
│       │   ├── state/
│       │   └── styles/
│       └── tests/
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

## Documentation responsibilities

### `docs/UI_REFERENCE.md`

Authoritative EpicScope interpretation of the approved EpicHub Logger/Analyzer interaction/layout reference.

It records:

- which EpicHub Logger/Analyzer concepts EpicScope inherits;
- which unrelated EpicHub application concepts are excluded;
- deliberate EpicScope UI deviations;
- reference behavior that implementation must preserve unless explicitly superseded.

It is a product/presentation contract, not permission to copy prototype implementation machinery into production code.

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

### `core/log-model/`

Normalized session/log/channel/sample contracts that form the neutral boundary between importers and consumers.

Parsers depend on these contracts to produce normalized data. Analysis and higher-level services depend on these contracts to consume normalized data.

### `core/parsers/`

Source-format decoders/importers.

Initial approved parser ownership includes:

- `mlg/` — MLG log decoding;
- `csv/` — CSV log decoding;
- `ini/` — INI source decoding needed for firmware/tune context;
- `msq/` — MSQ source decoding needed for tune context.

Parser modules own format-specific syntax/structure only. They produce approved normalized contracts and must not own analyzer semantics.

### `core/channels/`

Channel discovery, units, aliases, grouping, derived/math channel infrastructure, and channel-level transformations that are not domain-specific analysis.

### `core/timeline/`

Time navigation, ranges, markers, cursor-related model behaviour, indexing contracts, and view-oriented time queries that are shared beyond presentation.

### `core/analysis/`

Generic reusable analysis primitives such as filters, statistics, aggregation, histogram/heatmap preparation, scatter preparation, resampling, and qualification.

### `core/events/`

Reusable event definitions and detection services.

### `core/tune/`

Normalized firmware/tune context, table representations, axis/cell mapping, relationships between source settings and normalized tune structures, and tune-aware correlations.

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
