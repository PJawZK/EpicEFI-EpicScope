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

## Current Web state — 2026-10-15

EpicScope Web has mature functional foundations across Logger, Histogram and Analyzer and remains the product-semantics/reference implementation.

Implemented foundations include:

- MLG v1/v2 import, indexing, staged CRC validation and source-integrity diagnostics;
- INI-backed channel catalog/binding and optional MSQ tune enrichment;
- reusable named graph workspaces plus exact-log navigation persistence;
- multi-pane fixed/freeform graphs, Single/Dual layouts, timeline/cursor, A/B ranges, markers and saved ranges;
- semantic channel-role resolution and capability-gated workspace starters;
- 12 generic starter workspaces plus 12 capability-gated EpicEFI-specific starters;
- Histogram surfaces for Table Generator, Distribution, Scatter and Math Channels at the closed generic research-parity checkpoint;
- Analyzer surfaces for Range Compare, Tune Table, Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel Pressure / Injector, Trigger / Sync and VE Analyzer;
- unit-aware Analyzer and Histogram channel selectors;
- evidence navigation back to Logger;
- runtime-health, parser, retained-memory and performance diagnostics;
- `ts_shim` protocol/binary decoding, schema discovery, reconnect/lifecycle handling and selected-channel series recording;
- live/retained Shim captures exposed through the same normalized source path used by recorded analysis;
- same-origin Vite proxy for local/LAN Shim testing.

Current maturity summary:

- **Logger:** mature functional reference; broad optimization paused unless a measured regression appears.
- **Histogram:** generic research-parity checkpoint closed for the approved scope.
- **Fueling / Ignition:** mature experimental Analyzer checkpoints.
- **Boost:** strong experimental foundation.
- **Idle / AE:** useful but thinner.
- **Fuel Pressure / Injector:** substantially improved; remaining work is targeted maturity rather than broad expansion.
- **Trigger / Sync:** still thinner and remains a useful later maturity target.
- **VE Analyzer:** implemented and real-log/browser validated; currently the highest-value active maturity target.
- **MLG v3:** researched compatibility extension, not yet implemented.

The browser-known-good VE runtime is the #441-era composition restored by PR #449. Browser behavior, not CI alone, is the acceptance authority for VE changes.

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

Future Histogram work should be correctness/regression maintenance or deliberate cleanup unless a concrete field-use gap appears.

## Analyzer checkpoint

Fueling and non-knock Ignition are mature experimental checkpoints and should remain frozen unless a concrete defect appears. Boost remains a strong foundation. Fuel Pressure / Injector and Trigger / Sync retain specific maturity gaps documented in `docs/ANALYZER.md`.

VE Analyzer is now implemented with:

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
- Result View modes;
- cell evidence with strongest contiguous visit navigation to Logger.

Known remaining VE issues are Result View fallback/precision behavior and loss of Analyzer result state after a Logger round-trip. State ownership should be improved one browser-verified structural change at a time rather than by reintroducing the reverted post-#441 wrapper stack.

## MLG v3 research

`docs/research/MLG_V3_RESEARCH.md` records the bounded TunerStudio/MLV investigation.

Current conclusion:

- v3 extends the v2-style container rather than requiring a parser rewrite;
- little-endian scalar IDs 9..14 are confirmed;
- descriptor IDs 8/15 must not be guessed as F64;
- extended bitfield mapping still requires fixture validation;
- current EpicEFI logs may remain v2 under a v3-capable TunerStudio.

Production support therefore remains v1/v2 until the extension is implemented and regression-tested.

## Repository state

The historical remote-branch cleanup completed on 2026-10-15. The remote repository now has one authoritative branch, `main` (plus the normal `origin/HEAD -> origin/main` symbolic reference in clones). Historical implementation provenance remains available through Git history and merged PRs; old branch refs are not knowledge authorities.

## Research preservation

Historical behavioral research lives under `docs/research/`.

- `docs/research/README.md` explains the research policy and distinguishes historical research from current product authority.
- `docs/research/STATUS.md` maps research conclusions to current EpicScope state.

The original observations are preserved even when EpicScope later implements a stronger or deliberately different behavior.

## Recommended continuation

1. preserve the PR #449 browser-known-good VE runtime while improving state ownership;
2. fix Result View state/precision behavior and Logger → Analyzer result persistence one verified step at a time;
3. remove duplicate cell-evidence analysis and DOM-derived delay ownership when safe;
4. continue targeted Fuel / Injector and Trigger / Sync maturity work as useful;
5. add MLG v3 compatibility when remaining mapping is verified or real demand appears;
6. perform deliberate Web cleanup/consolidation without reopening closed Logger/Histogram feature tracks;
7. perform the Web functional maturity review;
8. then move toward Linux production implementation.

## Documentation

Start with:

- `docs/HANDOFF.md` — authoritative present-tense continuation state;
- `docs/DOCUMENTATION_MAP.md` — document authority/maintenance map;
- `docs/ROADMAP.md` — sequencing and phase status;
- `docs/PRODUCT.md` — product contract;
- `docs/ANALYZER.md` — Analyzer family behavior/maturity;
- `docs/HISTOGRAM.md` — Histogram contract/maturity;
- `docs/VE_ANALYZER.md` — current VE Analyzer product/behavior contract;
- `docs/VE_ANALYZER_WORKBENCH.md` — current VE workbench UI/workflow contract;
- `docs/research/README.md` — research index/policy;
- `docs/research/STATUS.md` — living research-to-product disposition;
- `docs/TS_SHIM_STATUS.md` — current live-source validation authority;
- `docs/LOG_MLG_PLAN.md` — MLG support/compatibility policy.
