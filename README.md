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
- Literal INI/MSQ/channel/table names remain authoritative presentation data; semantic roles guide selection but must not rename source data.

## Technology direction

- Web: lightweight TypeScript, Chromium/Brave-first.
- Recorded log format: MegaLogViewer / TunerStudio `.mlg`.
- Current MLG production support: v1/v2.
- Live source: EpicEFI `ts_shim` telemetry.
- INI channel catalog/binding plus optional MSQ tune enrichment.
- Linux target baseline: Debian 13 Stable.
- License: Apache License 2.0.

## Current Web state — 2026-10-16

EpicScope Web has mature functional foundations across Logger, Histogram and Analyzer and remains the product-semantics/reference implementation.

Current maturity:

- **Logger:** mature functional reference; broad optimization paused unless a measured regression appears.
- **Histogram:** generic research-parity checkpoint closed for the approved scope.
- **Fueling / Ignition:** mature experimental Analyzer checkpoints.
- **Boost:** strong experimental foundation.
- **Idle / AE:** useful but thinner.
- **Fuel Pressure / Injector:** substantially improved; remaining work is targeted maturity.
- **Trigger / Sync:** thinner and a later maturity target.
- **VE Analyzer:** implemented, real-log/browser validated and stable at the current maturity checkpoint.
- **Analyzer points 1–11:** merged and browser-accepted through PR #462.
- **UI polish:** immediate next work.
- **Unified observability / diagnostics:** D-058 architecture approved and queued after UI polish.
- **MLG v3:** researched compatibility extension, not yet implemented.

PR #462 merged the accepted Analyzer ownership/correctness/performance work into `main` at `2fdce3a4fc2a8759a45058c0ebc06dba0ed4739b`. The exact pre-merge runtime accepted by owner browser testing was `b435702412642f039a8a7f49d33037c309bef9d8`.

Browser behavior remains the acceptance authority for VE lifecycle/render/state changes; CI is necessary but not sufficient.

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

## Workspace/starter model

EpicScope distinguishes:

- **Layout** — graph geometry only;
- **Starter template** — task-oriented semantic role recipe;
- **Workspace** — ordinary user-owned materialized state.

Starters resolve once into editable/deletable workspaces. Source transitions normalize identities only; they do not reapply starter ownership.

## Histogram checkpoint

The generic Histogram maturity/research-parity track is closed for the currently approved scope.

Current mature behavior includes Table Generator, Distribution, Scatter and Math Channels with shared scope/Qualification, provenance, Logger evidence navigation and export where appropriate.

Future Histogram work should be correctness/regression maintenance or deliberate UI polish unless a concrete field-use gap appears.

## Analyzer checkpoint

Fueling and non-knock Ignition are mature experimental checkpoints and should remain frozen unless a concrete defect appears. Boost remains a strong foundation. Fuel Pressure / Injector and Trigger / Sync retain specific maturity gaps documented in `docs/ANALYZER.md`.

VE Analyzer now includes:

- VE/target table correlation from tune metadata;
- strict actual-mixture semantics and AFR/Lambda scale handling;
- explicit qualification and Run readiness;
- **RPM × load lambda-delay table only** as the accepted working model;
- explicit **Grab lambda delays from log** discovery;
- measured/interpolated/insufficient delay provenance;
- direct delay-cell editing and reusable saved delay tables;
- timestamp-aligned mixture evidence;
- optional known fuel-correction compensation;
- robust weighted-median VE evidence with P10/P90 spread, cumulative evidence and confidence;
- starting-table prior authority and withheld out-of-authority proposals;
- source-authoritative Result View modes;
- retained completed analysis across semantically unchanged navigation;
- retained-primary cell evidence reuse;
- cooperative bounded analysis with progress/cancel;
- transactional MSQ replacement and recoverable analysis/persistence failures.

The earlier Result View value-loss/heat-map and Logger → Analyzer continuity regressions are closed and browser-accepted. Remaining DOM-derived working-delay ownership is later cleanup, not a current blocker.

Never automatically write or Burn to the ECU.

## Unified observability / diagnostics

D-058 and `docs/OBSERVABILITY.md` define the next substantial architecture track after UI polish.

The target is one bounded local observability/session authority with Health, Performance, Parser/Source Integrity, Resources, Errors, Previous Session and report/export as projections. Existing useful probes remain in their natural owners and are migrated incrementally.

Key constraints: bounded low-overhead flight-recorder behavior, explicit session/operation correlation, event-storm coalescing/backpressure, batched persistence, no silent telemetry/raw log upload, no competing application-state authority and no automatic runtime self-repair from anomaly detection.

## MLG v3 research

`docs/research/MLG_V3_RESEARCH.md` records the bounded TunerStudio/MLV investigation. Production support remains v1/v2 until the extension is implemented and regression-tested.

## Repository state

`main` is the only product/continuation authority. Historical development branches and closed PRs are provenance, not knowledge authorities. The `browser-previews` branch is deployment infrastructure rather than product state.

The available connector used for the 2026-10-16 cleanup could close obsolete PRs and classify remote refs but did not expose branch deletion. Superseded refs are listed in `docs/BRANCH_CLEANUP_2026-10-15.md` and may be deleted with normal Git/GitHub controls.

## Recommended continuation

1. focused UI polish from the accepted `main` baseline;
2. CI plus browser sanity checks for interaction-affecting polish;
3. staged D-058 observability implementation beginning with baseline benchmarks and record/session/operation/retention ownership;
4. lower-priority Analyzer or MLG v3 work only where evidence/demand justifies it;
5. Web functional maturity review;
6. Linux production implementation.

## Documentation

Start with:

- `docs/HANDOFF.md` — authoritative present-tense continuation state;
- `docs/DOCUMENTATION_MAP.md` — document authority/maintenance map;
- `docs/ROADMAP.md` — sequencing and phase status;
- `docs/PRODUCT.md` — product contract;
- `docs/UI_REFERENCE.md` — current UI hierarchy/polish constraints;
- `docs/ANALYZER.md` — Analyzer family behavior/maturity;
- `docs/HISTOGRAM.md` — Histogram contract/maturity;
- `docs/VE_ANALYZER.md` — VE Analyzer product/behavior contract;
- `docs/VE_ANALYZER_WORKBENCH.md` — VE workbench UI/workflow contract;
- `docs/OBSERVABILITY.md` — approved diagnostics/observability architecture;
- `docs/research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md` — observability performance implementation research;
- `docs/research/STATUS.md` — living research-to-product disposition;
- `docs/TS_SHIM_STATUS.md` — live-source validation authority;
- `docs/LOG_MLG_PLAN.md` — MLG support/compatibility policy.
