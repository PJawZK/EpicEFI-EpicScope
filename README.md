# EpicEFI – EpicScope

**EpicScope** is a high-performance ECU log analysis and tuning-diagnostics project for EpicEFI and compatible tuning workflows.

Its purpose is not only to display channels. EpicScope is intended to **scope a tune**: inspect ECU behaviour, find faults and weak areas, compare changes, and turn recorded/live evidence into useful tuning decisions.

## Project direction

EpicScope is developed in three deliberate stages:

1. **Web** — functional reference and feature-validation platform.
2. **Linux** — primary production application target for speed, low RAM use, very large logs and native file handling.
3. **Android / EpicHub** — later reuse of proven analysis concepts and core logic.

The Web implementation establishes **what EpicScope should do** and is now also the validated reference client for the EpicEFI `ts_shim` live telemetry contract.

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

EpicScope Web has functional foundations through the existing Logger / Histogram / Analyzer scope and continues as a maturity/refinement platform.

Implemented foundations include:

- MLG v1/v2 import, indexing, staged CRC validation and source-integrity diagnostics;
- INI-backed channel catalog/binding and optional MSQ tune enrichment;
- reusable named graph workspaces plus exact-log navigation persistence;
- multi-pane fixed/freeform graphs, timeline/cursor, A/B ranges, markers and saved ranges;
- persistent/retained channel reuse plus OPFS column-sidecar/native-column access;
- Histogram surfaces for Table Generator, Distribution, Scatter and Math Channels;
- Analyzer surfaces for Range Compare, Tune Table, Boost, Idle, AE / MAP Predict, Fueling, Ignition, Fuel / Injector and Trigger / Sync;
- evidence navigation back to Logger;
- runtime-health, parser, retained-memory and performance diagnostics;
- `ts_shim` protocol/binary decoding, schema discovery, reconnect/lifecycle handling and selected-channel series recording;
- live/retained Shim captures exposed through the same normalized source path used by recorded analysis;
- read-only Shim HTTP inspection for INIs, tune objects and trigger-log routes;
- same-origin Vite proxy for local/LAN Shim testing;
- semantic channel-role resolution and reserved built-in workspace identities on the current pre-population feature branch;
- the validated one-pane semantic workspace path used as the basis for the first production **General · Single** preset.

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

## Semantic pre-populated workspaces

The current pre-population architecture adds a semantic layer above raw/source channel IDs:

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

Built-ins therefore describe what a workspace **needs**, not what one ECU happens to call a field.

Resolution preference is:

1. explicit user/schema override;
2. exact EpicEFI/native alias;
3. ECU-family/cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

Missing channels stay explicit and do not cause values to be fabricated.

Compatibility aliases are separate from display names. For example, legacy/MLV `TP` may resolve the throttle-position role, but EpicScope displays **TPS**.

MegaLogViewer HD `FieldMaps/*.properties` were inspected as cross-ECU alias evidence. EpicScope uses that material as a compatibility/reference dataset rather than copying its historical normalized vocabulary directly.

### Layouts vs workspaces

- **Layout** describes graph geometry only: Single, Dual, Triple, Quad, Focus + 2, Focus + 3, Six Pane.
- **Workspace** describes a tuning/diagnostic task and assigns semantic roles to one of those layouts.

Initial generic workspace targets include General, Idle, Fuel, Ignition, Boost, Transient / AE, Cooling, Fuel System, Trigger / Sync, Startup / Warmup, Electrical and Vehicle / Driveline.

EpicEFI-specific workspaces may coexist where schema capabilities justify them.

Detailed authority:

- [`docs/PREPOPULATED_WORKSPACES.md`](docs/PREPOPULATED_WORKSPACES.md) — workspace catalog, role contents and implementation status;
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — semantic/capability layer and source-aware materialization boundaries;
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — semantic role/template entities;
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — approved naming, identity and built-in workspace rules.

## Validated Single semantic-workspace baseline

The first implementation deliberately used the one-pane **Single · Resolver Test** fixture to remove multi-pane geometry as a variable.

The same reserved built-in workspace was validated through:

```text
MLG + INI
→ ts_shim live/capture
→ MLG + INI
```

Recorded source resolved:

```text
ini:RPMValue
ini:MAPValue
ini:TPSValue
ini:coolant
```

Shim resolved:

```text
RPMValue
MAPValue
TPSValue
coolant
```

In both source states the built-in remained `built-in:single-resolver-test`, all four assignments were renderable/active, unavailable assigned channels were zero, runtime health was `0 ISSUE / 0 WARN`, and runtime errors were zero.

Automated validation for that resolver/UI slice reached:

```text
npm run typecheck  → pass
npm test           → 71 test files / 362 tests passed
```

This proves the important part of the architecture: **semantic workspace identity survives while source-specific channel identities change underneath it**.

## General · Single production preset — feature branch status

Draft PR #343 on `feat/single-prepopulated-workspace` promotes the validated Single path to the first production preset, **General · Single**.

Target roles:

```text
Required:   RPM, MAP
Preferred:  TPS, Coolant Temp
Optional:   Intake Air Temp, Battery Voltage, Lambda, Ignition Advance
```

Current EpicEFI target mapping:

```text
MLG + INI                          ts_shim
ini:RPMValue                       RPMValue
ini:MAPValue                       MAPValue
ini:TPSValue                       TPSValue
ini:coolant                        coolant
ini:intake                         intake
ini:VBatt                          VBatt
ini:lambdaValue                    lambdaValue
ini:correctedIgnitionAdvance       correctedIgnitionAdvance
```

The eight-role expansion is implemented on the feature branch but must not be described as runtime-validated until the local typecheck/test and real MLG → Shim → MLG pass are completed.

The existing editable `General` workspace is intentionally preserved. The immutable production preset is therefore named **General · Single** for now so the two entries remain unambiguous.

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

The validated live-source implementation entered `main` through the squash merge:

`ad6d6a5ed26939ce7d27e4e4a018be8b2bd88bdc`

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

The long-used ~1.19 GB / 320,458-record MLG remains a useful reference workload. Its known source properties include 291 recovered retry artifacts, 8 unrecovered CRC records and 9 counter anomalies; these are source-log properties, not Shim or semantic-workspace regressions.

## Documentation authority

Current project documentation lives under [`docs/`](docs/).

Most important current-state documents:

- [`HANDOFF.md`](docs/HANDOFF.md) — **exact latest continuation state**.
- [`PREPOPULATED_WORKSPACES.md`](docs/PREPOPULATED_WORKSPACES.md) — semantic-role, layout and built-in workspace product/implementation target.
- [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system/dependency architecture, including semantic workspace materialization.
- [`DATA_MODEL.md`](docs/DATA_MODEL.md) — normalized source/channel/event/session and semantic-role/template concepts.
- [`DECISIONS.md`](docs/DECISIONS.md) — approved architectural/project decisions, including D-051–D-054 for semantic built-ins.
- [`TS_SHIM_STATUS.md`](docs/TS_SHIM_STATUS.md) — **validated live Shim implementation/runtime status**.
- [`TS_SHIM_INTEGRATION.md`](docs/TS_SHIM_INTEGRATION.md) — implemented Shim architecture/protocol/invariants.
- [`TS_SHIM_DEVELOPMENT_PROXY.md`](docs/TS_SHIM_DEVELOPMENT_PROXY.md) — local/LAN same-origin test flow.
- [`PRODUCT.md`](docs/PRODUCT.md) — product scope and feature map.
- [`ANALYZER.md`](docs/ANALYZER.md) — Analyzer semantics and maturity direction.
- [`PERFORMANCE.md`](docs/PERFORMANCE.md) — performance/memory requirements and evidence.
- [`ROADMAP.md`](docs/ROADMAP.md) — staged implementation/refinement plan.

When historical/current-state wording conflicts, use current `main`, `HANDOFF.md`, the active feature branch where applicable, and the latest verified test/runtime state.

## Web delivery

The normal public Web application is deployed from `main` to GitHub Pages:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

Recorded-log analysis remains client-side. Live Shim testing uses the same-origin development/hosted path rather than the GitHub Pages origin.
