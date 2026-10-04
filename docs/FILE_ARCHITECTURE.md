<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. Use the handoff plus current `main`/CI state for present-tense continuation.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope File Architecture

## Purpose

EpicScope treats repository/file structure as controlled architecture.

New production files must belong to an approved responsibility/location. If work does not fit the current structure cleanly, architecture must be reviewed and intentionally extended first.

Architectural evolution is allowed. Silent deviation is not.

## Current performance-sensitive ownership

Large-log hot paths currently live in approved areas:

- `core/parsers/mlg/` — source parsing/indexing/decoding and parser-level performance accounting;
- `core/channels/` — channel catalog/binding and source-facing channel services;
- `apps/web/src/adapters/` — browser Blob/File access, OPFS sidecar/native-column storage, persistent cache adapters;
- `apps/web/src/components/graph-viewport.ts` — Web graph presentation lifecycle;
- `apps/web/src/pages/logger-page.ts` — Logger/workspace orchestration and graph/timeline/data-source integration.

The active optimized Web path is session RAM → OPFS MLG sidecar → sparse native per-channel OPFS cache → original row-reader fallback.

The earlier opportunistic predecode path is removed. Do not invent a new preload/hot-set subsystem without explicit architecture review.

The performance campaign is done for now; these ownership boundaries remain stable while UI/analysis work proceeds.

## Current physical Web ownership after the repository audit

Important existing files include:

```text
apps/web/src/
├── app/
│   └── app-shell.ts
├── pages/
│   └── logger-page.ts
├── panels/
│   ├── inspector-panel.ts
│   ├── inspector-channel-view.ts
│   └── channel-value-search-panel.ts
├── components/
│   ├── graph-viewport.ts
│   ├── timeline-shell.ts
│   ├── parser-diagnostics-indicator.ts
│   ├── performance-diagnostics.ts
│   ├── performance-diagnostics-report.ts
│   ├── bug-report-health.ts
│   └── bug-report-formatter.ts
├── state/
│   ├── logger-pane-layout.ts
│   ├── workspace-state.ts
│   ├── workspace-persistence.ts
│   ├── application-workspace-persistence.ts
│   ├── ini-catalog-persistence.ts
│   └── workspace-channel-identity.ts
├── adapters/
│   ├── blob-byte-source.ts
│   ├── mlg-file-import.ts
│   ├── mlg-staged-import.ts
│   ├── mlg-column-sidecar.ts
│   ├── mlg-column-sidecar-v1.ts
│   ├── mlg-column-sidecar-storage.ts
│   ├── persistent-channel-cache.ts
│   └── browser-local persistence adapters
├── workers/
│   ├── mlg-import.worker.ts
│   ├── mlg-crc.worker.ts
│   └── mlg-worker-protocol.ts
└── styles/
```

This reflects the cleanup completed through PR #169. The audit is now paused; large source files are not to be split merely for line-count aesthetics.

## Authoritative logical tree

The following remains the approved logical structure for currently known implementation areas. Directories should be created only when a real task requires them.

```text
EpicEFI-EpicScope/
├── README.md
├── LICENSE
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── .github/
│   └── workflows/
│       ├── web-ci.yml
│       └── pages.yml
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
├── apps/
│   └── web/
│       ├── index.html
│       └── src/
│           ├── main.ts
│           ├── app/
│           ├── pages/
│           ├── panels/
│           ├── components/
│           ├── state/
│           ├── adapters/
│           ├── workers/
│           └── styles/
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
├── analyzers/
│   ├── boost/
│   ├── idle/
│   ├── ae/
│   ├── fueling/
│   ├── ignition/
│   ├── fuel-pressure/
│   └── trigger-sync/
├── shared/
│   ├── types/
│   ├── constants/
│   ├── units/
│   └── utilities/
├── tests/
└── tools/
```

Future Linux, Android, sharing/backend, live-acquisition, or other top-level application areas require explicit architecture approval before introduction.

## GitHub workflow responsibilities

### `.github/workflows/web-ci.yml`

Authoritative branch/PR validation. It installs from the lockfile and runs the current type-check/test/production-build gates. It must not become a permanent source-code mutation mechanism.

### `.github/workflows/pages.yml`

Authoritative `main` → GitHub Pages build/deploy path.

Temporary maintenance workflows/scripts are acceptable only for narrow repository tasks and must not remain in the final PR unless intentionally part of project tooling.

## Documentation responsibilities

### `docs/HANDOFF.md`

Present-tense continuation authority. It records current main state, active milestone, recent validated changes and exact next task.

### `docs/UI_REFERENCE.md`

Presentation/interaction authority. It records the EpicHub-derived reference plus current EpicScope refinements, including the EpicScope-logo mode switcher and workflow hierarchy.

### `docs/LOG_MLG_PLAN.md`

Historical/maintenance format authority for MLG v1/v2 parsing/safety behavior. Present execution position is governed by `HANDOFF.md`/`ROADMAP.md`.

### `docs/WEB_BOOT_PLAN.md`

Historical bootstrap/file authority. It does not prevent later approved EpicScope mode switching inside the dedicated EpicScope product shell.

## Directory responsibilities

### `apps/web/`

Web-specific composition/presentation.

Allowed:

- shell/pages/panels/components;
- Web state orchestration;
- browser storage/file adapters;
- styling/interaction;
- Web diagnostics/report presentation.

Not allowed:

- duplicate independent source parsers;
- hidden domain analysis that belongs in core/analyzers;
- authoritative tune interpretation only in UI components.

### `apps/web/src/app/`

Global Web application shell/mode orchestration and application-level menus/settings/status.

The EpicScope logo mode switcher belongs here/presentation composition, not in core analysis.

### `apps/web/src/pages/`

Mode/page-level orchestration such as Logger. Pages compose approved state/components/services but do not become source parsers.

### `apps/web/src/panels/`

Right-side browser/detail/tool controls such as the channel browser and value-search surfaces.

### `apps/web/src/components/`

Reusable Web presentation components. The repository audit established legitimate focused components for parser diagnostics, performance report formatting, Bug report health/formatting, timeline and graph presentation.

### `apps/web/src/state/`

Web-specific UI/application state and persistence coordination. Domain Session remains conceptually separate.

### `apps/web/src/adapters/`

Browser-specific file/storage/runtime adapters. Current MLG sidecar/native-column persistence is a Web adapter concern, not analyzer/domain architecture.

### `core/log-model/`

Normalized log/channel/time/source contracts.

### `core/parsers/`

Raw format decoding/import. Browser APIs remain outside core parsers.

### `core/channels/`

Stable logical channel catalog/binding, units/aliases/groups/derived-channel infrastructure and channel-level transformations that are not domain-specific conclusions.

### `core/timeline/`

Reusable time/range/cursor/index/view-query logic beyond pure DOM presentation.

### `core/analysis/`

Generic filters, qualification, statistics, aggregation, histogram/heatmap/table/scatter preparation and other reusable analysis primitives.

### `core/events/`

Reusable event definitions/detectors.

### `core/tune/`

Normalized tune/firmware/table semantics and operating-point correlation. Raw INI/MSQ parsing remains under parsers.

### `core/compare/`

Alignment/delta/comparison primitives.

### `core/session/`

Domain analysis-session composition; not general UI state.

### `core/persistence/`

Storage-independent versioned artifact/migration/compatibility logic.

### `analyzers/*/`

Domain-specific tuning analysis built from approved core services.

### `shared/`

Only truly cross-cutting low-level definitions. It must not become a dumping ground.

### `tests/`

Cross-cutting fixtures/regression/performance tests plus current Web/core regression coverage.

### `tools/`

Development/repository tooling that is not shipped runtime application logic.

## Dependency direction

`core/log-model/` is a neutral contract boundary.

Conceptually:

```text
source formats
     ↓
  parsers ───────→ log-model contracts ←────── core/analyzer consumers
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

Examples of prohibited coupling:

- `core/parsers/` importing `apps/web/`;
- `core/analysis/` depending on specialized analyzer modules;
- specialized analyzers parsing MLG binary structures directly;
- `core/tune/` duplicating raw INI/MSQ syntax decoding;
- UI components becoming sole owners of reusable domain calculations.

## File creation rule

Before creating a production file, establish:

1. architectural subsystem;
2. responsibility;
3. expected dependencies;
4. test strategy/location where appropriate.

## Architecture change rules

### FILE-ARCH-001 — Approved location required

All production files must belong to an approved area.

### FILE-ARCH-002 — Features do not self-authorize architecture

A feature request does not automatically authorize a new top-level directory/layer/dependency direction.

### FILE-ARCH-003 — Review before deviation

If work does not fit cleanly, stop at design level and review architecture first.

### FILE-ARCH-004 — Evolution is explicit

Approved architectural changes require project-owner approval and corresponding decision/document updates.

### FILE-ARCH-005 — No uncontrolled utility growth

Generic dumping-ground names/areas are not substitutes for ownership.

## Physical tree policy

Do not populate empty placeholder directories merely to mirror the logical tree. Create them when their first approved task lands.
