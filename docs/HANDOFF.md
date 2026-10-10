# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative branch: `main`

Authoritative application baseline before this documentation checkpoint:

`d955c4f963f13c0ccff32b036340fb9a1f19f477`

That commit includes PR #262, which fixed shim UI bootstrap ordering so **Load Data → Connect Shim…** is visible again on current main.

Hosted recorded-log application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older current-state wording elsewhere conflicts with this handoff, use this handoff plus current `main`/CI state.

## Project-move checkpoint — 2026-10-10

EpicScope is being moved into its own ChatGPT Project instead of continuing inside the broader EpicEFI Firmware project.

The next chat should begin by reading this file and then current `main`. No conversational state from the old project should be required to continue normal EpicScope development.

Current development priority has changed deliberately:

1. **Pi Zero 2 W / real-ECU `ts_shim` runtime work is paused** until the required USB adapter arrives;
2. **browser-only EpicScope maturity is now the active track**;
3. use recorded MLG/INI/MSQ sources for codebase audits, optimization, polishing and Analyzer refinement;
4. do not add speculative shim protocol work merely because real hardware validation is temporarily blocked.

No application-code change is implied by this checkpoint; it is a development-priority/handoff update.

## Repository hygiene state

The repository was deliberately cleaned before the previous handoff refresh:

- 260 stale branches were removed in the first safe pass because they were already contained in `main`;
- the remaining 15 branches were reviewed individually;
- nothing needed recovery into `main`;
- old technically unmerged/superseded branches were confirmed obsolete against later merged implementations;
- those remaining branches were removed;
- the temporary cleanup workflow was then removed;
- final Web CI passed on the cleaned main;
- 0 open pull requests remained;
- the repository had exactly one branch: `main`.

Subsequent shim/runtime work used normal short-lived PR branches. Treat current `main` as authoritative; do not infer unfinished work from historical branch names or closed PRs.

## Current project position

**Phases 1 through 4 remain complete for the originally approved Web scope.** Current work is maturity/refinement inside those existing modes.

Two maturity tracks exist, but only the first is active while hardware is unavailable:

1. **Web-product maturity / Analyzer usefulness / evidence-driven tuning workflows** — ACTIVE;
2. **EpicEFI `ts_shim` live logging/analysis integration** — IMPLEMENTED FIRST PASS, RUNTIME VALIDATION PAUSED PENDING HARDWARE.

Do not begin Phase 5 unless the project owner explicitly asks.

Approved workflow remains:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Logger, Histogram and Analyzer are real active EpicScope modes.

## Immediate next work — browser-only maturity pass

Start with a repository-wide static/performance audit before broad new feature work.

Priority sequence:

1. **Codebase maturity/static audit**
   - duplicate state/DOM handling;
   - avoidable direct DOM lookups and listener lifecycle risks;
   - dead/unreachable branches and accidental global leaks;
   - repeated expensive channel scans;
   - oversized modules and responsibility concentration, especially `apps/web/src/app/app-shell.ts`;
   - opportunities to simplify without changing established behavior.
2. **Recorded-log performance pass**
   - initial UI population;
   - channel list/search/filter work;
   - graph setup/rendering and invalidation;
   - Analyzer evidence generation;
   - Histogram/Table Generator calculations;
   - large-log viewport/navigation;
   - memory churn/cache behavior.
3. **Existing-feature polish**
   - Logger;
   - Analyzer;
   - Histogram/Table Generator;
   - workspace handling;
   - navigation;
   - settings/help;
   - error/empty states;
   - interaction consistency and visual hierarchy.
4. **Shared Analyzer refinement**
   - continue shared comparison/qualification/evidence primitives;
   - do not create analyzer-specific parallel infrastructure.
5. **Regression/sanity pass**
   - preserve all invariants documented below.

Prefer small, reviewable/testable batches rather than one large refactor.

## Recorded-log architecture — preserve

The established MLG path remains authoritative and must not be destabilized by shim or cleanup work.

Current recorded foundations include:

- MLG v1/v2 loading, indexing and deferred/full CRC validation;
- optional INI catalog/binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces/presets;
- multi-pane fixed/freeform graph layouts;
- shared viewport/cursor/timeline;
- A/B selection, markers and saved ranges;
- exact-log persistence separated from reusable workspace state;
- session/cache/OPFS large-log architecture;
- retained-memory/runtime-health diagnostics.

### Graph preset invariant

> **Visible pane + assigned available channel = active rendered trace.**

Unavailable channels remain assigned but are not falsely activated. Reconciliation must understand pending/loading state and must not use user-style toggles as generic `ensure active` / `ensure absent` primitives.

## Histogram / Table Generator authority

Current Histogram modes:

- Table Generator;
- Distribution;
- Scatter;
- Math Channels.

Table Generator invariants:

- visible weighted statistic label is **Weighted Mean**;
- standalone Size button is removed; **Table Size** owns geometry settings;
- Auto, Custom and Loaded MSQ are geometry sources;
- **Loaded MSQ is geometry-only** and must not silently rewrite selected runtime X/Y/Z channels;
- breakpoint-node Weighted Mean behavior from PR #213 remains authoritative;
- presets/filters/Math Channels remain reusable analysis inputs;
- source evidence/provenance must not be silently discarded.

## Analyzer — current state

Analyzer is no longer just summary-only UI. It is being shaped around event evidence, tuning interpretation and source navigation.

### Shared foundation

Current shared behavior includes:

- semantic channel-role suggestions with visible manual overrides;
- Full Log / Current A-B / Saved Range scopes;
- event→Logger navigation;
- reusable aligned-event evidence;
- median traces plus 10–90% envelopes;
- comparison/qualification groundwork;
- controller-effort/tracking metrics;
- tuning-oriented inline help.

### Idle analyzer

Idle distinguishes outer RPM control from inner actuator/control behavior.

Current system choices:

- Combined;
- RPM Control;
- DC Valve Control;
- IAC Valve;
- ETB;
- Ignition.

Common required inputs remain RPM and Idle Target. Canonical runtime RPM matching strongly prefers `RPMValue`.

Current useful metrics include:

- RPM error MAE / RMSE;
- worst sag;
- median recovery;
- base / closed-loop / final idle position;
- mean-absolute and RMS controller effort;
- signed I-term bias where diagnostically useful;
- DC target-vs-position MAE / RMSE;
- positive/negative position-error extrema;
- runtime DC Bias/feed-forward contribution;
- inner DC-position PID effort/output.

Interpretation rule retained from current work:

- RPM poor + valve tracking good → investigate outer RPM/base/feed-forward logic;
- RPM poor + valve tracking poor → inner valve control / bias / actuator response is suspect;
- persistent signed inner I correction with eventual good tracking is evidence that DC Bias/feed-forward is carrying the wrong steady value.

**DC Bias calibration curve/table is calibration data, not a scalar log channel.** Runtime DC Bias/feed-forward output is valid runtime evidence. Actual calibration-curve/current-point analysis belongs to tune/MSQ or future typed shim tune-object context.

### Idle evidence graph

Idle aligned evidence uses two panes:

- **Engine response**;
- **Controller / actuator response**.

Trace line and 10–90% envelope visibility are independently toggleable. Idle defaults to RPM envelope only; controller traces begin line-only to avoid overlapping triangular shading.

Each aligned trace is vertically autoscaled independently. Compare timing/shape, not apparent vertical magnitude between unlike channels.

### Inline help and typography

Idle controls/results include `i` help explaining what each signal/metric means and how to interpret it for tuning.

Settings contain application-wide font-size sliders:

- Interface text — default 100%;
- Information / help text — default 120%;
- Data / results text — default 100%;
- Graph / legend text — default 115%.

These apply across Logger, Analyzer and Histogram, including canvas text where applicable.

## Analyzer comparison/refinement sequence

Relevant merged work:

- #242 — refreshed shared Analyzer comparison/qualification primitive onto corrected main;
- #243 — richer numeric/controller-effort metrics and DC tracking diagnostics;
- #244 — Idle presentation rewritten around RPM Control vs DC Valve Control and firmware-correct runtime roles;
- #245 — split Idle evidence panes and interactive line/envelope visibility;
- #246 — detailed inline tuning help;
- #247 — adjustable font-size controls;
- #248 — application-wide typography scope and defaults.

Do not recreate parallel one-off analyzer infrastructure when shared comparison/qualification/evidence utilities already exist.

## ts_shim integration — implemented, runtime work paused

The integration-design rationale lives in [`TS_SHIM_INTEGRATION.md`](TS_SHIM_INTEGRATION.md).

The present implementation/runtime-test state lives in [`TS_SHIM_STATUS.md`](TS_SHIM_STATUS.md). Read it before resuming shim work.

### Implemented shim sequence

- #249 — integration design;
- #250 / SHIM-1 — protocol-v1 parser/types and `epicefi-f64-v1` binary decoder;
- #251 / SHIM-2 — WebSocket telemetry/session state machine and reconnect/backoff;
- #252 / SHIM-3 — shim schema adapter and rich quality model;
- #253 / SHIM-4 — live capture/session buffer + `NumericChannelDataSource`;
- #254 / SHIM-5 — live recording/session coordinator;
- #255 / SHIM-6 — first Logger UI integration;
- #256 / SHIM-7 — retained shim captures become normal Logger/Analyzer/Histogram sources;
- #257 / SHIM-8 — live Logger View Live / Follow mode;
- #258 / SHIM-9 slice 1 — strict read-only HTTP inspector;
- #259 — same-origin Vite development proxy for native Windows shim testing;
- #262 — fixed shim UI bootstrap order after navigation refinement.

### Current live source architecture

```text
ECU
  ↓
ts_shim
  ↓
/telemetry WebSocket
  ↓
ShimTelemetryClient
  ↓
ShimLiveSession / ShimCaptureSession
  ↓
ShimLiveNumericChannelDataSource
  ↓
Logger / Analyzer / Histogram
```

The shim path converges at `NumericChannelDataSource`; it does not create separate live-only analyzers.

### Current shim behavior

- browser shim connection is same-origin;
- telemetry is read-only;
- schema channel names are exact live INI output-channel identities;
- selected-channel capture currently uses one stream bounded by `maxChannelsPerStream`;
- logging uses `series` mode;
- acquisition rate uses `welcome.limits.maxRateHz`, never a hard-coded 50/60 Hz assumption;
- stream IDs/generation are validated;
- lifecycle/schema changes invalidate streams and trigger resubscription;
- reconnects create explicit capture segments;
- timestamps from different `clockId` origins are never directly subtracted;
- delivery loss and rich quality are preserved;
- connecting to shim does not silently replace a loaded MLG;
- **View Live/Open Capture** explicitly chooses the shim capture as the Logger source;
- Follow mode tracks a rolling latest-data window while recording continues;
- stopped captures remain normal Logger/Analyzer/Histogram sources.

### Rich shim quality

Additive quality model:

- 0 valid;
- 1 invalid;
- 2 stale;
- 3 unavailable;
- 4 reserved/lost compatibility value.

Existing MLG consumers continue using legacy `validity`; live ranges may also expose richer `quality` bytes.

### Shim HTTP status

Current HTTP integration is intentionally GET-only and inspect-first:

- `/api/v1/inis`;
- `/api/v1/objects`;
- `/api/v1/triggerlog`.

The inspector shows status/timing/content type/JSON state/payload preview but does not invent unknown native response schemas.

The next typed HTTP slice requires **real responses from a running native shim with the ECU path available**.

No tune writes, burns, firmware flashing, mocks, ECU commands or CAN injection are part of current EpicScope shim work.

## Windows shim development proxy — known state

The public GitHub Pages site remains correct for normal recorded-log use, but it cannot directly satisfy the native shim's same-origin browser rule.

For native shim testing use [`TS_SHIM_DEVELOPMENT_PROXY.md`](TS_SHIM_DEVELOPMENT_PROXY.md).

Expected setup:

```text
Browser → http://localhost:5173
           ├─ EpicScope
           ├─ /telemetry → proxy → 127.0.0.1:29002
           └─ /api/v1/*  → proxy → 127.0.0.1:29002
```

Current Windows test established that the Vite development page runs and, after PR #262, current main initializes shim UI in the correct order. A missing native shim still correctly produces a Vite WebSocket proxy `ECONNREFUSED 127.0.0.1:29002` error.

## Pi Zero 2 W / ECU-network bridge checkpoint

This work is intentionally paused until the ordered USB adapter arrives.

Target topology:

```text
Mega144H7 USB CDC
      ↓
Pi Zero 2 W
Raspberry Pi OS Lite
raw serial ↔ TCP bridge
      ↓ Wi-Fi / home LAN
Windows PC
      ↓
ts_shim.exe --upstream-tcp PI_HOST:PORT
```

The current EpicEFI/JZ-fork `ts_shim` supports `--upstream-tcp H:PORT`; therefore the Pi does **not** need to run `ts_shim`, Windows or an EpicEFI-aware service. Its only role is to expose the ECU USB CDC byte stream over plain TCP, planned with a minimal `ser2net` setup.

Pi preparation reached step 3 of the setup guide: Raspberry Pi OS Lite is installed/configured, but the ECU cannot yet be connected to the Pi because the USB adapter is missing.

When the adapter arrives, resume by:

1. connecting ECU USB to Pi;
2. confirming `/dev/ttyACM*`, `lsusb` and preferably a stable `/dev/serial/by-id/*` identity;
3. checking installed `ser2net` version and freezing the exact minimal raw-TCP configuration;
4. testing the Pi TCP endpoint from Windows;
5. starting Windows `ts_shim.exe --upstream-tcp PI_HOST:PORT`;
6. continuing the EpicScope real-runtime sequence from `TS_SHIM_STATUS.md`.

Do not spend active development time on this path until the hardware dependency clears.

## Analysis provenance rules — authoritative

Analysis must not silently discard or invent evidence. Where applicable retain/expose:

- input sample count;
- valid/invalid/stale/unavailable sample counts;
- rejected/outside-range counts;
- source sample indices;
- selected time/range scope;
- complete vs partial decoded coverage;
- explicit channel/role/filter semantics;
- explicit aggregation/event method;
- event thresholds/configuration;
- weighted hit count/weight where relevant;
- shim delivery loss / reconnect segment provenance where applicable.

If a trace does not fully cover the requested scope, do not present the result as complete.

## New standalone EpicScope Project — startup instructions

A new chat in the dedicated EpicScope Project should:

1. read `docs/HANDOFF.md` first;
2. verify current `main` and CI before changing code;
3. treat current `main` as authoritative;
4. **do not resume Pi/real-ECU shim runtime work until the user says the USB adapter/hardware is available**;
5. begin with the browser-only codebase maturity/static/performance audit described above;
6. use recorded MLG/INI/MSQ workflows for testing and optimization;
7. preserve the existing MLG/INI/MSQ path and explicit source-switching behavior;
8. preserve the graph preset invariant and Table Generator MSQ geometry-only rule;
9. do not treat DC Bias calibration as a scalar runtime channel;
10. keep shim integration read-only until a separately designed/approved write-safety scope exists;
11. continue shared Analyzer comparison/qualification/evidence infrastructure instead of parallel analyzer-specific frameworks;
12. keep Phase 5 gated on explicit owner approval.

Suggested first prompt in the new project:

> Read `docs/HANDOFF.md` in `PJawZK/EpicEFI-EpicScope`, verify current `main`, and continue from the browser-only maturity/static/performance audit. The Pi Zero 2 W / real-ECU `ts_shim` work is paused until I have the required USB adapter.

## Phase boundary

**Phases 1–4 are complete for the originally approved scope. Current active work is Web-product maturity/refinement. First-class read-only `ts_shim` integration exists but its remaining real-hardware validation is paused. Phase 5 is not authorized.**
