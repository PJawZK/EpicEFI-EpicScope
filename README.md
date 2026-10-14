# EpicEFI – EpicScope

**EpicScope** is a high-performance ECU log analysis and tuning-diagnostics project for EpicEFI and compatible tuning workflows.

Its purpose is not only to display channels. EpicScope is intended to **scope a tune**: inspect ECU behaviour, find faults and weak areas, compare changes, and turn recorded/live evidence into useful tuning decisions.

## Project direction

EpicScope is developed in three deliberate stages:

1. **Web** — functional reference and feature-validation platform.
2. **Linux** — primary production application target for speed, low RAM use, very large logs and native file handling.
3. **Android / EpicHub** — later reuse of proven analysis concepts and core logic.

The Web implementation establishes **what EpicScope should do** and is also the validated reference client for the EpicEFI `ts_shim` live telemetry contract.

## Core principles

- Performance and log-reading speed take priority over visual effects.
- Local analysis stays local unless the user explicitly chooses to share/publish data.
- Supported source families normalize into common internal models before analysis/presentation.
- Logger, Analyzer and Histogram should not grow separate live-only logic where a normalized source contract already exists.
- Source transitions must preserve unrelated application state.
- Stable user/workspace channel identity must survive source changes.
- Built-in task workspaces describe semantic channel roles, not one ECU's raw channel names.
- Compatibility aliases never dictate EpicScope's preferred user-facing terminology.
- Missing/ambiguous evidence should degrade a capability visibly rather than fabricate a result.
- Analysis/proposal state must remain separate from tune/ECU state.

## Technology direction

- Web: lightweight TypeScript, Chromium/Brave-first.
- Recorded log format: MegaLogViewer / TunerStudio `.mlg`.
- Current MLG production support: v1/v2.
- Live source: EpicEFI `ts_shim` telemetry.
- INI channel catalog/binding plus optional MSQ tune enrichment.
- Linux target baseline: Debian 13 Stable.
- License: Apache License 2.0.

## Current Web state — 2026-10-14

EpicScope Web has mature functional foundations across Logger, Histogram and Analyzer and remains the product-semantics/reference implementation.

Implemented foundations include:

- MLG v1/v2 import, indexing, staged CRC validation and source-integrity diagnostics;
- INI-backed channel catalog/binding and optional MSQ tune enrichment;
- reusable named graph workspaces plus exact-log navigation persistence;
- multi-pane fixed/freeform graphs, Single/Dual layouts, timeline/cursor, A/B ranges, markers and saved ranges;
- semantic channel-role resolution and capability-gated workspace starters;
- 12 generic starter workspaces plus 12 capability-gated EpicEFI-specific starters;
- Histogram surfaces for Table Generator, Distribution, Scatter and Math Channels at the current research-parity checkpoint;
- Analyzer surfaces for Range Compare, Tune Table, Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel Pressure / Injector and Trigger / Sync;
- unit-aware Analyzer and Histogram channel selectors;
- evidence navigation back to Logger;
- runtime-health, parser, retained-memory and performance diagnostics;
- `ts_shim` protocol/binary decoding, schema discovery, reconnect/lifecycle handling and selected-channel series recording;
- live/retained Shim captures exposed through the same normalized source path used by recorded analysis;
- same-origin Vite proxy for local/LAN Shim testing.

Current maturity summary:

- **Logger:** mature functional reference.
- **Histogram:** generic research-parity checkpoint reached.
- **Fueling / Ignition:** mature experimental Analyzer checkpoints.
- **Boost:** strong experimental foundation.
- **Idle / AE:** useful but thinner.
- **Fuel Pressure / Injector:** active maturity track.
- **Trigger / Sync:** next broad-coverage Analyzer target.
- **VE Analyzer:** researched and specified in `docs/VE_ANALYZER.md`, not yet implemented.
- **MLG v3:** researched compatibility extension, not yet implemented.

## Current source model

EpicScope has one authoritative Logger source family at a time:

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Loaded INI and MSQ resources are independent application state and survive source transitions.

The Load Data menu follows the setup/use order:

```text
Load INI
Load MSQ
Open Log
Unload Log
Connect Shim
```

## Stable channel identity

A recorded INI-bound workspace may contain canonical `ini:*` identities while the Shim exposes matching raw runtime IDs. During source transitions, EpicScope resolves those identities without duplicating raw + `ini:*` traces and restores canonical recorded identities when the INI-bound source returns.

## Workspace/starter model

EpicScope distinguishes:

- **Layout** — graph geometry only;
- **Starter template** — task-oriented semantic role recipe;
- **Workspace** — ordinary user-owned materialized state.

Starters resolve once into editable/deletable workspaces. Source transitions normalize identities only; they do not reapply starter ownership.

## Histogram checkpoint

The generic Histogram maturity/research-parity track is closed for the currently approved scope.

Current mature behavior includes:

- Table Generator with shared scopes/Qualification, tune/custom geometry, weighted breakpoint-node behavior, Median and broader statistics, aligned evidence, Logger navigation and export;
- Distribution with fixed repeatable geometry, comparisons, saved setups, export and bin evidence;
- Scatter with point/box evidence, density, strongest contiguous Logger navigation, saved setups and export;
- Math Channels with arithmetic, logic, lazy conditionals, historical references and temporal helpers;
- unit-aware channel labels.

Future Histogram work should be maintenance/cleanup unless a concrete field-use gap appears.

## Analyzer checkpoint

Fueling and non-knock Ignition are mature experimental checkpoints and should remain frozen unless a concrete defect appears.

Fuel Pressure / Injector has recently gained:

- source-continuity-correct threshold events;
- injector duty headroom/saturation evidence;
- calibrated low-side/high-side pressure-role separation;
- exclusion of CEL and raw electrical pressure channels from engineering pressure evidence;
- explicit Conventional / port-injection versus GDI / high-pressure modes;
- unit-aware selectors and summaries.

Trigger / Sync remains thinner and is the next broad-coverage target after Fuel / Injector.

## VE Analyzer research/specification

The preserved MegaLogViewer and ECUMaster EMU PRO research is now part of the repository under `docs/research/`.

`docs/VE_ANALYZER.md` specifies a planned evidence-first VE Analyzer with:

- semantic qualification presets;
- explicit user-triggered lambda-delay discovery;
- single / RPM-curve / RPM×load delay models;
- timestamp-based delay alignment;
- bilinear VE-node evidence;
- confidence/prior authority;
- measured/interpolated/weak/withheld/no-evidence result states;
- source provenance;
- recommendation authority separate from user apply percentage;
- explicit diff-first application only if future tune-write integration is approved.

The feature is **specified, not implemented**.

## MLG v3 research

`docs/research/MLG_V3_RESEARCH.md` records the bounded TunerStudio/MLV investigation.

Current conclusion:

- v3 extends the v2-style container rather than requiring a parser rewrite;
- little-endian scalar IDs 9..14 are confirmed;
- descriptor IDs 8/15 must not be guessed as F64;
- extended bitfield mapping still requires fixture validation;
- current EpicEFI logs may remain v2 under a v3-capable TunerStudio.

Production support therefore remains v1/v2 until the extension is implemented and regression-tested.

## Research preservation

Historical behavioral research lives under `docs/research/`.

- `docs/research/README.md` explains the research policy.
- `docs/research/STATUS.md` maps research conclusions to current EpicScope state: Implemented, Improved in EpicScope, Partial, Planned, Deferred or Not applicable to EpicScope.

The original observations are preserved even when EpicScope later implements a stronger behavior.

## Recommended continuation

1. finish Fuel Pressure / Injector maturity;
2. mature Trigger / Sync;
3. implement VE Analyzer;
4. add MLG v3 compatibility when remaining mapping is verified or real demand appears;
5. refine AE / MAP Predict and Idle;
6. run the deliberate cleanup/consolidation phase;
7. perform the Web functional maturity review;
8. then move toward Linux production implementation.

## Documentation

Start with:

- `docs/HANDOFF.md` — authoritative current continuation state;
- `docs/ROADMAP.md` — sequencing and phase status;
- `docs/PRODUCT.md` — product contract;
- `docs/ANALYZER.md` — Analyzer family behavior/maturity;
- `docs/HISTOGRAM.md` — Histogram contract/maturity;
- `docs/VE_ANALYZER.md` — planned VE Analyzer specification;
- `docs/research/README.md` — research index;
- `docs/research/STATUS.md` — research-to-product disposition;
- `docs/LOG_MLG_PLAN.md` — MLG support/compatibility policy.
