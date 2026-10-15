<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. `docs/DOCUMENTATION_MAP.md` defines document authority.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope File Architecture

## Purpose

EpicScope treats repository/file structure as controlled architecture. New production files must have an approved responsibility/location; architecture may evolve, but silent drift is not allowed.

This document describes ownership boundaries rather than requiring an empty speculative directory tree to exist.

## Current major ownership

### `core/parsers/`

Raw untrusted format decoding/import:

- MLG;
- INI;
- MSQ;
- other approved source formats when implemented.

Parsers do not own UI behavior or domain Analyzer conclusions.

### `core/log-model/`

Normalized source/channel/time/validity/provenance contracts.

### `core/channels/`

Stable logical channel catalog/binding, aliases/identity resolution and source-facing channel services that are not domain-specific Analyzer conclusions.

### `core/analysis/`

Reusable analysis primitives and cross-analyzer calculations such as qualification, statistics, Table/Scatter/Distribution support, VE evidence/delay alignment/statistics and other domain-neutral evidence operations.

A calculation may be used primarily by VE today and still belong in `core/analysis/` when its responsibility is reusable evidence/math rather than Web presentation state.

### `core/tune/`

Normalized tune/firmware/table semantics and operating-point correlation. Raw INI/MSQ syntax stays under parsers.

### `core/events/`, `core/compare/`, `core/session/`, `core/persistence/`

Reusable event, comparison, domain-session and storage-independent persistence/versioning responsibilities.

### `apps/web/src/app/`

Global Web shell/mode orchestration, source transitions, application-level menus/settings/status and live-source orchestration.

Current examples include `app-shell.ts`, source-transition helpers and Shim catalog/live UI integration.

### `apps/web/src/pages/`

Mode/page-level orchestration and Web workbenches.

Current important ownership includes:

- `logger-page.ts`;
- Histogram/analysis pages;
- VE Analyzer workbench/controller enhancement layers and focused VE helpers.

The current VE implementation has historical layered files such as `ve-analyzer-view-v2.ts` … `v9.ts`. Their existence is known architecture debt, not a naming pattern to continue indefinitely. Do not add another wrapper layer merely to patch state ownership. Consolidation should happen only through staged browser-verified ownership work.

### `apps/web/src/panels/`

Right-side browser/detail/tool surfaces such as Inspector/channel search/detail interaction.

### `apps/web/src/components/`

Reusable Web presentation components: graph/timeline, diagnostics, report/health and other focused UI pieces.

Current diagnostics/report components remain production until the approved observability migration reaches parity. They are migration sources, not the target long-term ownership model.

### `apps/web/src/observability/` — approved future ownership

D-058 approves a bounded Web observability subsystem. Create this directory incrementally when implementation begins; do not scaffold empty files merely to match the plan.

Approved responsibility map:

```text
apps/web/src/observability/
├── record.ts          # versioned event/metric/snapshot envelope
├── recorder.ts        # bounded current-session record stream
├── session.ts         # session lifecycle/summary
├── operation.ts       # operation + parent-operation correlation
├── retention.ts       # count/time/byte limits
├── persistence.ts     # versioned recent-session local persistence
├── anomaly-detector.ts
├── snapshots.ts
├── producers/         # adapters from existing owners into observability
└── reports/           # Health/Performance/Source/Session/export projections
```

Boundary rules:

- parser/source/cache/analysis code keeps ownership of the measurements or domain evidence it produces;
- observability producers publish compact correlated records from those owners;
- observability must not parse raw MLG/INI/MSQ, own tune/session domain truth, or replace application state management;
- report views should consume observability/session projections rather than maintain duplicate long-lived stores;
- old `performance-diagnostics*`, `bug-report-*` and related report-only ownership should be removed only after the replacement reaches parity and browser validation.

### `apps/web/src/state/`

Web-specific presentation/application state and persistence coordination, including workspace/template/semantic-role state. Domain Session remains conceptually separate.

Observability history does not belong here; it has its own bounded/versioned persistence boundary and must not become a hidden general state store.

### `apps/web/src/adapters/`

Browser-specific file/storage/runtime adapters, including Blob/File access, OPFS sidecar/native-column caches and `ts_shim` transport/source adapters.

Measurement probes in adapters remain owned here and may publish compact counters/timings through observability producers.

### `apps/web/src/workers/`

Browser Workers for approved parser/CRC/background operations.

### `apps/web/src/styles/`

Web presentation styles. CSS must not become authoritative domain state.

### `tests/`

Core/Web regression, parser, analysis, persistence and behavior tests. Browser acceptance testing remains separately required for VE lifecycle/render/input changes where automated DOM tests cannot prove real behavior.

Observability adds tests for bounded retention, operation correlation, anomaly sequences, report projections, versioned previous-session recovery and runtime overhead.

### `tools/`

Development/repository tooling not shipped as runtime product logic.

## Current large-log Web path

Performance-sensitive source access remains:

```text
session RAM
   ↓
OPFS MLG column sidecar
   ↓
sparse native per-channel OPFS cache
   ↓
original row-reader fallback
```

The removed opportunistic predecode path must not return without new measured evidence/decision. This Web architecture is not a Linux implementation mandate.

## Current documentation structure

Key current authorities:

```text
README.md
docs/
├── HANDOFF.md
├── DOCUMENTATION_MAP.md
├── PRODUCT.md
├── ROADMAP.md
├── ARCHITECTURE.md
├── FILE_ARCHITECTURE.md
├── DATA_MODEL.md
├── DECISIONS.md
├── OBSERVABILITY.md
├── WORKFLOW.md
├── UI_REFERENCE.md
├── ANALYZER.md
├── FUELING_ANALYZER.md
├── VE_ANALYZER.md
├── VE_ANALYZER_WORKBENCH.md
├── HISTOGRAM.md
├── PREPOPULATED_WORKSPACES.md
├── STARTER_SYSTEM_VALIDATION.md
├── SPECIALIZED_WORKSPACE_COVERAGE.md
├── TS_SHIM_STATUS.md
├── TS_SHIM_INTEGRATION.md
├── TS_SHIM_DEVELOPMENT_PROXY.md
├── LOG_MLG_PLAN.md
├── PERFORMANCE.md
├── PLATFORMS.md
├── research/
└── decisions/
```

Historical bootstrap/implementation notes such as `WEB_BOOT_PLAN.md` and `SHIM7_CAPTURE_BINDING.md` remain for provenance but are not current-state authorities. See `DOCUMENTATION_MAP.md`.

## Dependency direction

Conceptually:

```text
source formats
     ↓
  parsers ─────→ normalized contracts ←──── core/analyzer consumers
                                            ↑
                                         apps/web
                                            ↓
                                     observability records
```

Prohibited coupling includes:

- core parsers importing Web UI;
- generic analysis depending on presentation DOM;
- specialized domain logic parsing raw MLG binary directly;
- tune services duplicating raw INI/MSQ syntax parsing;
- rendered DOM becoming the only owner of reusable analysis truth;
- observability becoming the authoritative source/tune/analysis model;
- report formatters owning a second copy of long-lived runtime state once observability migration is complete.

## VE-specific ownership rule

The current browser-known-good VE workbench still contains DOM/state bridges and layered enhancement files. Future cleanup should move toward:

```text
explicit VE session/request state
        ↓
authoritative analysis result/proposal
        ↓
review/cell evidence consumers
        ↓
presentation rendering
```

rather than:

```text
rendered DOM
   ↕ parse/reconstruct/recompute
secondary wrapper layers
```

Do this one structural change at a time with browser verification. Do not destabilize the direct lambda-delay editor.

## File creation rule

Before creating a production file establish:

1. architectural subsystem;
2. responsibility;
3. expected dependencies;
4. test/validation strategy.

Do not use `new`, `final`, `helper2`, `temp` or ever-growing `vN` naming as a substitute for ownership design.

## Architecture change rules

- production files require an approved area;
- feature requests do not self-authorize new layers;
- if work does not fit, stop at design level and review architecture;
- approved changes require corresponding decision/document updates;
- shared/utility areas must not become dumping grounds.

## Future platform areas

Linux/Android/backend/direct-acquisition top-level structures remain intentionally undecided until their implementation architecture is explicitly approved. Create directories when real approved tasks require them, not as empty placeholders.
