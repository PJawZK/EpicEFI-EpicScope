# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production branch: `main`

Current authoritative product merge baseline:

`a7e08bfa3a8b5f451fd4b8710b1f956b8f3635cd`

That squash merge is PR #370, **Refine generic starter channels and MAP wall-wetting diagnostics**.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older wording elsewhere conflicts, use current `main`, this handoff and current CI/runtime evidence.

## Current project position — 2026-10-13

EpicScope Web remains the functional reference/validation implementation for Logger, Histogram and Analyzer behavior.

The semantic Logger starter-template track is now **feature-complete for the current validation phase**:

- 12 portable generic starters;
- 12 capability-gated EpicEFI-specific starters;
- all 12 generic starters seed a genuinely fresh Logger state as ordinary editable workspaces;
- ECU-specific starters remain opt-in under **New graph → From template**;
- template discovery is viewport-bounded and scrollable;
- Single layout uses the normal overlay readout presentation with channel names plus NOW / MIN / MAX;
- starter materialization is one-time and never creates persistent template ownership.

Do not continue adding starter templates by default. Staged Injection and Closed-loop Fuel / STFT / LTFT remain secondary future candidates. Per-cylinder/EGT work remains deferred until the semantic layer can represent indexed channel families cleanly.

The next larger product track should be chosen deliberately. The strongest current candidate is richer Histogram Scatter region selection/evidence navigation.

## Product/workflow invariant

The approved visible workflow remains:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

For generic Histogram analysis:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

Shared concepts should keep shared names and semantics.

## Validated runtime topology

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

Local development command used on JZ-Main:

```bash
cd ~/EpicEFI-EpicScope
EPICSCOPE_SHIM_TARGET='http://192.168.186.181:29002' npm run dev:shim
```

Browser:

`http://localhost:5173/`

## Source ownership model

One Logger source family is authoritative at a time:

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Loaded INI and MSQ are independent application resources and survive source transitions.

Stable workspace assignments normalize between canonical `ini:*` identities and matching raw Shim identities. Source transitions must never reapply a starter template, resurrect deleted channels, or create raw + `ini:*` duplicate traces.

## Starter/workspace architecture

Starter templates are defined in terms of semantic channel roles, not one ECU's raw channel names.

```text
semantic role
      ↓
logical ECU channel
      ↓
current source identity
```

Resolution order:

1. explicit user/schema override;
2. exact EpicEFI/native alias;
3. ECU-family/cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

Missing channels remain explicit. Required/preferred/optional roles degrade gracefully rather than fabricating data.

### D-055 ownership invariant

Layout, starter and workspace remain separate concepts:

- **Layout** — graph geometry only;
- **Starter template** — task-oriented recipe using semantic role slots;
- **Workspace** — ordinary user-owned materialized state.

Lifecycle:

```text
starter template
      ↓ resolve once against current catalog
ordinary editable graph-* workspace
```

Once materialized, a workspace may be edited, renamed, duplicated or deleted. Template updates affect future materializations only. Source transitions normalize channel identities only. Historical `built-in:*` IDs are compatibility data and do not imply protected ownership.

## Fresh-state behavior

A genuinely fresh Logger state seeds these 12 generic workspaces when the first usable channel catalog becomes available:

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

Existing/restored workspace state is never re-seeded. If a user deletes or edits a default workspace, EpicScope must preserve that decision.

## Current generic starter intent

- **General** — broad engine overview.
- **Idle** — speed/load plus idle actuator/combustion context.
- **Boost** — RPM, MAP, TPS, IAT plus ignition/fueling/electrical context; no closed-loop boost, wastegate or EMAP assumption.
- **Fuel** — actual/target mixture, injection demand, pressure and total correction.
- **Ignition** — timing, dwell, battery and thermal context; no knock-hardware assumption.
- **Cooling** — temperatures, RPM/speed, binary fan-active state, oil/coolant pressure and battery context.
- **Transient / AE** — TPS/MAP transient context, effective MAP, Lambda + target, injector PW, AE and wall-fuel correction.
- **Fuel System** — delivery-system pressure, injector demand, pump state and mixture context.
- **Trigger / Sync** — sync/error counters/phase plus battery context.
- **Startup / Warmup** — cranking/after-start/warmup corrections plus actual injector PW and mixture context.
- **Electrical** — charging/load/sensor-supply overview including binary fan activity.
- **Vehicle / Driveline** — road speed, driver inputs, gear, clutch/brake, wheel speeds and longitudinal acceleration.

## Current EpicEFI-specific starter tier

Capability-gated starters are offered only when their defining runtime semantic bundle resolves. They are not gated by ECU board name.

Current production set:

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

The MAP Predict + Wall Wetting starter now emphasizes the actual MAP-model and wall-film signals: measured MAP, Instant MAP, fallback/predicted MAP, Effective MAP, wall fuel amount and the mass-domain `wallFuelCorrectionValue`, with fueling/mixture context. It no longer centers generic TPS-AE triggering or the simple map-prediction-active flag.

## Recent starter-track milestones

- #348 — explicit Blank / From template creation and first-class Dual layout.
- #349 — dual workspace persistence validation.
- #350 — INI-only workspace editing.
- #351 — generic Boost starter.
- #352 — right-side template flyout.
- #356 — Trigger / Sync and Startup / Warmup.
- #358 — Electrical and Vehicle / Driveline; 12 generic starters complete.
- #359 — capability-gated EpicEFI-specific tier foundation + MAP Predict / Wall Wetting.
- #360 — Fuel Rail Diagnostics + ETB Control.
- #362 — Dual Chamber Boost + Trigger / Sync Detailed.
- #363 — Injector + Ignition Timing + Engine Protection.
- #365 — VVT Control.
- #366 — Anti-Lag.
- #367 — Launch, Traction and Transmission; 12 specialized starters complete.
- #368 — scrollable template flyout.
- #369 — fresh-state generic seeding + Single-layout readout fix.
- #370 — generic channel audit refinements + MAP/WW semantic correction.

## Validation status

The following are established:

- full branch/main type-check, test and production-build validation through PR #370;
- real browser confirmation of fresh-state generic workspace seeding after site-local storage/cache reset;
- user confirmation that the fresh baseline and Single layout presentation look correct;
- prior real MLG + INI ↔ `ts_shim` source-transition validation;
- automated coverage for semantic resolution, capability gating, workspace identity normalization and starter definitions.

`docs/STARTER_SYSTEM_VALIDATION.md` records the close-out matrix for this track.

## Logger checkpoint

Mature behavior includes:

- MLG v1/v2 staged import, CRC/source diagnostics and large-log reuse;
- INI-backed channel catalog/binding;
- optional MSQ tune enrichment;
- reusable named graph workspaces and exact-log navigation persistence;
- fixed/freeform multi-pane Logger plus Single and Dual layouts;
- A/B ranges, markers and saved ranges;
- stable channel identity across recorded and Shim transitions;
- semantic starter resolution and capability gating;
- fresh-state generic workspace seeding;
- explicit Blank / From template creation;
- fully editable/deletable materialized starter workspaces;
- explicit unavailable-channel handling;
- retained-memory, parser, performance and runtime-health diagnostics.

Do not resume broad Logger/performance micro-optimization without a concrete measured problem.

## Histogram checkpoint / next likely track

Histogram coherence remains complete through the shared Scope, Qualification, Math Channels and help work. Current surfaces are Table Generator, Distribution, Scatter and Math Channels.

The most useful next extension remains **richer Scatter region selection and evidence navigation**. Saved setups/exports for Distribution and Scatter are also valid later work. Do not restart a broad Histogram rewrite.

## Analyzer checkpoint

Analyzer feature expansion remains paused after useful maturity checkpoints in Fueling and non-knock Ignition. Prefer practical coverage of less-mature analyzers before deepening mature Fueling/Ignition again.

## Before new work from a local clone

```bash
cd ~/EpicEFI-EpicScope
git switch main
git pull
npm run typecheck
npm test
```

Recommended continuation:

1. use `docs/STARTER_SYSTEM_VALIDATION.md` if a starter regression appears;
2. otherwise treat the starter-template track as closed for now;
3. begin the next deliberate product track, currently expected to be richer Scatter region selection/evidence navigation.
