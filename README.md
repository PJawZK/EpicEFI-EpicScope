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
- Dependencies must justify their runtime, memory, compatibility, maintenance or complexity cost.
- Source transitions must preserve unrelated application state.
- Stable user/workspace channel identity must survive source changes.
- Built-in task workspaces describe **semantic channel roles**, not one ECU's raw channel names.
- Compatibility aliases never dictate EpicScope's preferred user-facing terminology.

## Technology direction

- Web: lightweight TypeScript, Chromium/Brave-first.
- Recorded log format: MegaLogViewer / TunerStudio `.mlg`.
- Live source: EpicEFI `ts_shim` telemetry.
- INI channel catalog/binding plus optional MSQ tune enrichment.
- Linux target baseline: Debian 13 Stable.
- License: Apache License 2.0.

## Current Web state

EpicScope Web has mature functional foundations across Logger, Histogram and Analyzer and continues as the product-semantics/reference implementation.

Implemented foundations include:

- MLG v1/v2 import, indexing, staged CRC validation and source-integrity diagnostics;
- INI-backed channel catalog/binding and optional MSQ tune enrichment;
- reusable named graph workspaces plus exact-log navigation persistence;
- multi-pane fixed/freeform graphs, Single/Dual layouts, timeline/cursor, A/B ranges, markers and saved ranges;
- persistent/retained channel reuse plus OPFS column-sidecar/native-column access;
- semantic channel-role resolution and capability-gated workspace starters;
- 12 generic starter workspaces that seed only a genuinely fresh state and remain fully editable/deletable;
- 12 capability-gated EpicEFI-specific starters exposed through **New graph → From template**;
- Histogram surfaces for Table Generator, Distribution, Scatter and Math Channels at the current research-parity checkpoint;
- Analyzer surfaces for Range Compare, Tune Table, Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel / Injector and Trigger / Sync;
- evidence navigation back to Logger;
- runtime-health, parser, retained-memory and performance diagnostics;
- `ts_shim` protocol/binary decoding, schema discovery, reconnect/lifecycle handling and selected-channel series recording;
- live/retained Shim captures exposed through the same normalized source path used by recorded analysis;
- read-only Shim HTTP inspection for INIs, tune objects and trigger-log routes;
- same-origin Vite proxy for local/LAN Shim testing.

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

### Recorded MLG → Shim

**Connect Shim** while an MLG is active detaches the recorded source **in-process**. There is no browser reload.

EpicScope retains:

- loaded INI;
- loaded MSQ / TuneModel;
- reusable graph/workspace assignments;
- runtime error/report history;
- performance history.

The Shim's decodable schema then becomes the temporary Channel Browser catalog.

### Shim → recorded MLG

Opening a recorded MLG makes Shim relinquish temporary catalog ownership first. The loaded INI catalog is restored, then the MLG/INI binding proceeds normally.

Stable workspace identities migrate back to canonical `ini:*` IDs.

## Stable channel identity

A recorded INI-bound workspace may contain:

```text
ini:coolant
ini:intake
ini:MAPValue
ini:RPMValue
ini:TPSValue
```

The Shim schema publishes matching raw IDs:

```text
coolant
intake
MAPValue
RPMValue
TPSValue
```

While Shim is authoritative, stable `ini:*` assignments resolve to matching raw runtime channels. When an INI-bound recorded source returns, the workspace returns to canonical `ini:*` identities.

This avoids duplicate raw + `ini:*` traces and keeps graph presets reusable across source families.

## Semantic starter workspaces

The starter architecture adds a semantic layer above raw/source channel IDs:

```text
semantic role
      ↓
logical ECU channel
      ↓
current source identity
```

Example:

```text
engine.rpm → RPMValue → ini:RPMValue  (recorded MLG + INI)
engine.rpm → RPMValue → RPMValue      (ts_shim)
```

Starters describe what a workspace **needs**, not what one ECU happens to call a field.

Resolution preference is:

1. explicit user/schema override;
2. exact EpicEFI/native alias;
3. ECU-family/cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

Missing channels stay explicit and do not cause values to be fabricated.

Compatibility aliases are separate from display names. For example, legacy/MLV `TP` may resolve the throttle-position role, but EpicScope displays **TPS**.

MegaLogViewer HD `FieldMaps/*.properties` were inspected as cross-ECU alias evidence. EpicScope uses that material as a compatibility/reference dataset rather than copying its historical normalized vocabulary directly.

### Fresh-state generic workspaces

A genuinely fresh Logger state seeds these ordinary editable workspaces once a usable channel catalog exists:

```text
General
Idle
Boost
Fuel
Ignition
Cooling
Transient / AE
Fuel System
Trigger / Sync
Startup / Warmup
Electrical
Vehicle / Driveline
```

They are not locked system presets. Users may edit, rename, duplicate or delete them, and EpicScope must not recreate them after user-owned state exists.

### EpicEFI-specific starter tier

Capability-gated starters are offered only when their runtime semantic requirements resolve:

```text
EpicEFI · MAP Predict + Wall Wetting
EpicEFI · Fuel Rail Diagnostics
EpicEFI · ETB Control
EpicEFI · Dual Chamber Boost
EpicEFI · Trigger + Sync Detailed
EpicEFI · Injector + Ignition Timing
EpicEFI · Engine Protection
EpicEFI · VVT Control
EpicEFI · Anti-Lag
EpicEFI · Launch Control
EpicEFI · Traction Control
EpicEFI · Transmission Control
```

Detailed authority:

- [`docs/PREPOPULATED_WORKSPACES.md`](docs/PREPOPULATED_WORKSPACES.md) — workspace catalog, role contents and implementation status;
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — semantic/capability layer and source-aware materialization boundaries;
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — semantic role/template entities;
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — approved naming, identity and workspace rules.

## Histogram research-parity checkpoint

The generic Histogram suite is closed at its current maturity checkpoint.

### Table Generator

Current mature behavior includes:

- Full Log / Current A/B / Saved Range;
- shared Qualification and Math Channels;
- automatic/custom/MSQ-derived geometry;
- Count, Mean, Median, Min, Max, Sum, Standard Deviation, Variance and Weighted Mean;
- Z-reference/subtraction;
- MLV-style weighted breakpoint-node behavior;
- exact cell evidence with X/Y/Z/reference/delta values;
- Logger navigation and CSV/provenance.

### Distribution

Current mature behavior includes:

- shared scopes/Qualification/Math Channels;
- Count / % Samples / Time;
- Histogram/Cumulative;
- two-scope comparison on shared geometry;
- saved setups and CSV export;
- exact Fixed Min/Max/Width geometry for repeatable tests;
- outside-geometry evidence reported explicitly rather than clamped to edge bins;
- bin → Logger navigation.

### Scatter

Current targeted maturity includes:

- shared scopes/Qualification/Math Channels;
- Single/Dual and Dots/Lines;
- density heat and bounded large-log rendering;
- point and box-region evidence;
- strongest contiguous selected-region visit → Logger;
- saved setups;
- complete qualified/selected-region CSV export.

### Math Channels

Current expression support includes:

- arithmetic;
- comparisons and logical expressions;
- lazy `if()`;
- exact-name-first MLV-style `[Channel-N]` historical references;
- `lag()`, `delta()`, moving `avg()` and timestamp-based `rate()`.

Math Channels remain based on physical source dependencies; nested saved Math Channel references are deliberately unsupported.

The Table Generator, Distribution and expanded Math Channel behavior have passed practical browser testing after the parity implementation.

## Shared Histogram timeline UI

Logger owns the authoritative timeline component. Table Generator, Distribution and Scatter reuse the complete Logger `.timeline-wrap`.

This is an explicit invariant from PR #381. The Hide/Show controls edge tab must appear in the same centered position on the upper edge of the timeline/control panel in all four surfaces.

Do not move `.timeline-shell` and `.edge-toggle--timeline` independently when docking Histogram views; doing so breaks the positioning context and can place the control inside or behind the analysis surface.

## Validated real-ECU Shim baseline

The source workflow was validated against the real chain:

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
      ↓
ts_shim
      ↓ LAN
EpicScope same-origin Vite proxy
      ↓
Logger / Analyzer / Histogram
```

Validated round trip:

```text
MLG + INI
→ Connect Shim
→ live schema
→ Record / live Logger view
→ Stop Recording
→ Open MLG
→ INI catalog restored
→ MLG/INI binding restored
→ canonical workspace IDs restored
```

## Current Shim Logger workflow

The normal Logger Channel Browser/graph assignments are authoritative for the first-stage Shim recording set.

```text
Connect Shim
→ assign channels in Logger
→ Record
→ live Logger view starts immediately
→ Follow / inspect history
→ Stop Recording
```

The Shim schema remains visible during a selected-channel capture; uncaptured schema channels are explicit unavailable channels rather than disappearing.

One narrow UI cleanup remains worth preserving in future/native implementations: **capture remains loaded** and **live refresh is paused** should be modeled as separate states.

## Read-only Shim boundary

EpicScope consumes the Shim's shared ECU snapshot and does not independently poll the ECU while Shim owns the connection.

Current read-only HTTP inspection covers:

- `/api/v1/inis`;
- `/api/v1/objects`;
- `/api/v1/triggerlog`.

No tune writes, burns, firmware flashing, sensor mocks, ECU commands or CAN injection are part of the current baseline.

## Development proxy

The browser Shim contract is same-origin. Local/LAN development uses:

```bash
EPICSCOPE_SHIM_TARGET='http://<shim-host>:29002' npm run dev:shim
```

Then open:

```text
http://localhost:5173/
```

See [`docs/TS_SHIM_DEVELOPMENT_PROXY.md`](docs/TS_SHIM_DEVELOPMENT_PROXY.md) for the validated Linux/Pi flow and Windows equivalents.

## Performance status

The intensive large-log architecture campaign is complete for now. Reopen performance work only for a concrete regression or measured new workload issue.

The long-used ~1.19 GB / 320,458-record MLG remains a useful reference workload. Its known source properties include recovered retry artifacts plus a small set of unrecovered CRC/counter anomalies; these are source-log properties, not Shim, workspace or Histogram regressions.

## Current product direction

The starter-template and generic Histogram feature tracks are closed at their current checkpoints.

When deliberate feature work resumes, prefer broader maturity of the thinner Analyzer surfaces — especially **Fuel / Injector** and **Trigger / Sync**, then remaining AE / MAP Predict and Idle gaps — rather than adding more generic Histogram features or deepening already-mature Fueling/Ignition without a concrete reason.

## Documentation authority

Current project documentation lives under [`docs/`](docs/).

Most important current-state documents:

- [`HANDOFF.md`](docs/HANDOFF.md) — **exact latest continuation state**.
- [`ROADMAP.md`](docs/ROADMAP.md) — staged implementation/refinement plan and current execution position.
- [`HISTOGRAM.md`](docs/HISTOGRAM.md) — current generic analysis behavior/invariants.
- [`PREPOPULATED_WORKSPACES.md`](docs/PREPOPULATED_WORKSPACES.md) — semantic-role/layout/starter catalog.
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system/dependency architecture.
- [`DATA_MODEL.md`](docs/DATA_MODEL.md) — normalized source/channel/event/session concepts.
- [`DECISIONS.md`](docs/DECISIONS.md) — approved architectural/project decisions.
- [`TS_SHIM_STATUS.md`](docs/TS_SHIM_STATUS.md) — validated live Shim implementation/runtime status.
- [`TS_SHIM_INTEGRATION.md`](docs/TS_SHIM_INTEGRATION.md) — Shim architecture/protocol/invariants.
- [`TS_SHIM_DEVELOPMENT_PROXY.md`](docs/TS_SHIM_DEVELOPMENT_PROXY.md) — local/LAN same-origin test flow.
- [`PRODUCT.md`](docs/PRODUCT.md) — product scope and feature map.
- [`ANALYZER.md`](docs/ANALYZER.md) — Analyzer semantics and maturity direction.
- [`PERFORMANCE.md`](docs/PERFORMANCE.md) — performance/memory requirements and evidence.
- [`UI_REFERENCE.md`](docs/UI_REFERENCE.md) — approved current interaction hierarchy/invariants.

When historical/current-state wording conflicts, use current `main` plus `docs/HANDOFF.md` and the latest verified test/runtime state.

## Web delivery

The public Web application is deployed from `main` to GitHub Pages:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

Recorded-log analysis remains client-side. Live Shim testing uses the same-origin development/hosted path rather than the GitHub Pages origin.
