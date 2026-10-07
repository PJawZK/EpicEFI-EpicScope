# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative branch: `main`

Repository baseline immediately before this handoff/documentation refresh:

`0a91dfc29eaac91477225a80c6005496b2cac2f4`

That baseline is the cleaned authoritative main after removal of the temporary branch-cleanup workflow.

Hosted recorded-log application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older current-state wording elsewhere conflicts with this handoff, use this handoff plus current `main`/CI state.

## Repository hygiene state

The repository was deliberately cleaned before this handoff refresh:

- **260 stale branches** were removed in the first safe pass because they were already contained in `main`;
- the remaining **15 branches** were reviewed individually;
- nothing needed recovery into `main`;
- old technically unmerged/superseded branches were confirmed obsolete against later merged implementations;
- those remaining branches were removed;
- the temporary cleanup workflow was then removed;
- final Web CI passed on the cleaned main;
- **0 open pull requests** remained;
- the repository had exactly **one branch: `main`**.

Do not infer unfinished work from old branch names or closed PR history. Current `main` is authoritative.

## Current project position

**Phases 1 through 4 remain complete for the originally approved Web scope.** Current work is maturity/refinement inside those existing modes.

Two active maturity tracks now coexist:

1. **Analyzer usefulness / evidence-driven tuning workflows**;
2. **EpicEFI `ts_shim` live logging/analysis integration** using the same normalized source architecture.

Do not begin Phase 5 unless the project owner explicitly asks.

Approved workflow remains:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Logger, Histogram and Analyzer are real active EpicScope modes.

## Recorded-log architecture — preserve

The established MLG path remains authoritative and must not be destabilized by shim work.

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

Idle now distinguishes outer RPM control from inner actuator/control behavior.

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

Idle aligned evidence now uses two panes:

- **Engine response**;
- **Controller / actuator response**.

Trace line and 10–90% envelope visibility are independently toggleable. Idle defaults to RPM envelope only; controller traces begin line-only to avoid the earlier overlapping triangular shading problem.

Each aligned trace is vertically autoscaled independently. Compare timing/shape, not apparent vertical magnitude between unlike channels.

### Inline help and typography

Idle controls/results include `i` help explaining what each signal/metric means and how to interpret it for tuning.

Settings contain application-wide font-size sliders:

- Interface text — default 100%;
- Information / help text — default **120%**;
- Data / results text — default 100%;
- Graph / legend text — default **115%**.

These apply across Logger, Analyzer and Histogram, including canvas text where applicable.

## Analyzer comparison/refinement sequence

Relevant merged work after the previous handoff:

- #242 — refreshed shared Analyzer comparison/qualification primitive onto corrected main;
- #243 — richer numeric/controller-effort metrics and DC tracking diagnostics;
- #244 — Idle presentation rewritten around RPM Control vs DC Valve Control and firmware-correct runtime roles;
- #245 — split Idle evidence panes and interactive line/envelope visibility;
- #246 — detailed inline tuning help;
- #247 — adjustable font-size controls;
- #248 — application-wide typography scope and defaults (help 120%, graph 115%).

Do not recreate parallel one-off analyzer infrastructure when shared comparison/qualification/evidence utilities already exist.

## ts_shim integration — current authority

The integration-design rationale lives in [`TS_SHIM_INTEGRATION.md`](TS_SHIM_INTEGRATION.md).

The present implementation/runtime-test state lives in [`TS_SHIM_STATUS.md`](TS_SHIM_STATUS.md) and should be read before continuing shim work.

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
- #259 — same-origin Vite development proxy for testing the native Windows shim.

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

The next typed HTTP slice requires **real responses from a running native shim**.

No tune writes, burns, firmware flashing, mocks, ECU commands or CAN injection are part of current EpicScope shim work.

## Windows shim development proxy — current test path

The public GitHub Pages site is still correct for normal recorded-log use, but it cannot directly satisfy the native shim's same-origin browser rule.

For current native shim testing use [`TS_SHIM_DEVELOPMENT_PROXY.md`](TS_SHIM_DEVELOPMENT_PROXY.md).

Expected setup:

```text
Browser → http://localhost:5173
           ├─ EpicScope
           ├─ /telemetry → proxy → 127.0.0.1:29002
           └─ /api/v1/*  → proxy → 127.0.0.1:29002
```

Current Windows flow:

1. run native `ts_shim`;
2. verify PowerShell `Test-NetConnection 127.0.0.1 -Port 29002` reports `TcpTestSucceeded : True`;
3. download/extract a **fresh current main ZIP**;
4. verify Node meets the repository engine requirement;
5. in PowerShell use `npm.cmd` if `npm.ps1` is blocked by execution policy;
6. run `npm.cmd install` before `npm.cmd run dev:shim`;
7. open `http://localhost:5173/` in Brave/Chromium;
8. verify **Load Data → Connect Shim…** is visible;
9. test connection, channels, Record, View Live, Follow, Stop/Open Capture and **Shim HTTP…**.

Important runtime lesson from the current test attempt: an older extracted main ZIP showed only the legacy file-loading UI. If **Connect Shim…** is absent, first assume the local ZIP/source copy is stale and download current `main` again.

## What the earlier shim work was for

The development proxy is only the transport bridge for local testing. The substantial earlier implementation is still required and is not replaced by the proxy:

```text
shim protocol/data
  ↓
EpicScope decoder/client
  ↓
live session/capture
  ↓
normalized data source
  ↓
Logger / Analyzer / Histogram
```

The proxy merely allows a browser page on port 5173 to reach the real shim on port 29002 while preserving the shim's same-origin security expectation.

Final intended deployment remains serving EpicScope static files directly from the shim host, using the same relative `/telemetry` and `/api/v1/*` paths.

## Current next work

### Immediate next task — runtime shim validation

Do **not** add more speculative shim protocol layers first.

Use a fresh current `main` ZIP on Windows and continue the real native-shim test:

1. establish the WebSocket connection;
2. capture `welcome`, schema and lifecycle behavior;
3. record a small selected-channel live capture;
4. verify View Live / Follow / Stop / Open Capture;
5. inspect `/api/v1/inis`, `/api/v1/objects` and `/api/v1/triggerlog`;
6. bring the real HTTP payloads back into development;
7. only then define typed read-only INI/tune-object/trigger-log integrations.

### Deferred until evidence justifies it

- multi-stream full-schema capture/joining;
- automatic all-channel live logging;
- direct shim-host static packaging;
- typed HTTP interpretation before real payloads are captured;
- any write path.

### Analyzer follow-on

Once shim runtime validation is no longer blocking, continue shared Analyzer comparison/qualification work rather than building analyzer-specific parallel frameworks.

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

## Next chat — continue from here

A new chat should:

1. read this file first;
2. verify current `main` because this handoff refresh itself advances the commit beyond the pre-refresh cleanup baseline `0a91dfc29eaac91477225a80c6005496b2cac2f4`;
3. treat `main` as the only authoritative branch; there are no stale development branches to recover;
4. for shim work, read `TS_SHIM_STATUS.md` and `TS_SHIM_DEVELOPMENT_PROXY.md` before changing code;
5. continue the Windows runtime test using a fresh current main ZIP;
6. preserve the existing MLG/INI/MSQ path and explicit source-switching behavior;
7. preserve the graph preset invariant and Table Generator MSQ geometry-only rule;
8. do not treat DC Bias calibration as a scalar runtime channel;
9. keep shim integration read-only until a separately designed/approved write-safety scope exists;
10. keep Phase 5 gated on explicit owner approval.

## Phase boundary

**Phases 1–4 are complete for the originally approved scope. Current work is Web-product maturity/refinement plus first-class read-only `ts_shim` live integration. Phase 5 is not authorized.**
