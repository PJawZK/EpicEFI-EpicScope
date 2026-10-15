# VE Analyzer specification

## Status

VE Analyzer is implemented and real-log/browser validated. This document is the current algorithm/evidence/product contract. `VE_ANALYZER_WORKBENCH.md` is the companion UI/workflow contract.

The browser-known-good runtime is the #441-era composition restored by PR #449 after later continuity/render wrappers froze Analyzer entry. Browser behavior is the acceptance authority for VE runtime changes; green CI alone is insufficient.

## Purpose

VE Analyzer turns recorded fueling evidence into a reviewable VE-table recommendation without silently treating every mixture deviation as a VE error.

The feature is deliberately **evidence-first**. Analysis output is a proposal, not tune state. EpicScope must preserve source provenance, expose qualification, keep measured evidence distinct from interpolation and preserve explicit user authority.

Research inputs include mature behavior observed in MegaLogViewer HD VE Analyze and ECUMaster EMU PRO VE Tuner. Those products are behavioral references, not implementation authorities.

## Product workflow

```text
Load INI + MSQ + Log
  -> select VE table / target table
  -> verify actual mixture / RPM / load
  -> qualify operating evidence
  -> discover or load lambda-delay table
  -> activate working delay table
  -> Run Analysis
  -> inspect Result View / cell evidence
  -> review proposal explicitly
```

Opening EpicScope, loading a log/MSQ or entering VE Analyzer must not automatically launch expensive delay discovery or VE analysis.

## Required inputs and source semantics

Primary roles:

- RPM;
- VE-table load coordinate;
- actual mixture, preferring lambda where appropriate;
- target mixture on a compatible scale;
- selected VE table and its RPM/load breakpoints;
- selected target mixture table and its matching breakpoints.

Useful qualification/context roles may include DFCO, fuel-cut reason, AE/decel state, coolant temperature, TPS, injector command, fuel corrections, injector duty/headroom, fuel pressure, engine-running/sync validity and limiter/protection state.

Literal INI/MSQ/channel/table names remain user-facing authority. Semantic roles may guide selection but must not rename source data.

Actual-mixture selection must reject derived/error/target channels masquerading as measured mixture. AFR/Lambda interpretation must remain explicit and scale-aware.

## Scope and qualification

VE Analyzer uses the shared source/scope model and practical visible operating filters.

Current normal-use qualification supports optional bounds such as RPM/load/CLT/TPS plus state/stability logic. Blank optional bounds mean no bound and must never become artificial Run blockers.

State exclusions and stability/recovery are conceptually separate:

1. **State exclusions** — DFCO, fuel cut, AE/decel activity, invalid running/protection states where semantic evidence exists.
2. **Stability/recovery** — sufficiently stable RPM/load/TPS context and recovery after transients.

Missing optional safeguards must remain visible/unavailable rather than being silently fabricated.

`Custom` qualification semantics remain an architectural debt area: future advanced formula support must not make Custom silently disable normal safety/state exclusions.

## Lambda-delay model

### Accepted working model

The current and accepted product model is **RPM × load delay table only**.

Scalar/single-delay and RPM-curve modes were considered during research/planning but are **not** current EpicScope product direction and must not be reintroduced as supported modes without a new explicit decision.

Delay is expressed in **time**, not record count.

### Explicit discovery

The expensive scan runs only when the user presses:

**Grab lambda delays from log**

No automatic discovery on startup/log load/analyzer open.

Candidate events should have a meaningful fuel-command change, valid mixture evidence, sufficient separation from conflicting changes, contiguous source samples and valid RPM/load context.

The result is observed mixture-response delay, not a claim of pure sensor delay. Combustion, exhaust transport, turbo/manifold volume, sensor/controller/filtering and logging latency may all contribute.

### Recommendation versus working table

Recommendation and working delay table are distinct states.

- discovery creates/replaces the **recommendation** for the current evidence;
- **Use recommendation** promotes reviewed recommendation into the working table;
- a loaded/saved working table remains independent from newly grabbed recommendation until explicitly replaced;
- user edits retain user provenance and must not destroy the raw recommendation/evidence underneath.

### Delay cell states

Delay-table cells distinguish:

- **Measured** — direct usable event evidence;
- **Interpolated** — bounded/local interpolation from supported measured regions;
- **Insufficient** — no trustworthy delay estimate;
- **User-edited/manual working value** where applicable.

Sparse evidence must not manufacture a full believable surface.

### Direct editing

Current browser-validated interaction supports selection/range selection, typing to replace, Enter commit, Escape cancel, Backspace edit and Delete clear to explicit no working delay (`—`). Repeated edits must remain reliable and focus/selection must survive re-render.

The old external apply/value editor is not the normal workflow.

### Saving/loading

Working delay tables use a versioned reusable JSON format. Saved/loaded origin remains distinct from current-log measured evidence.

## Delay application

VE correction aligns each mixture observation against the earlier engine/fuel state most plausibly responsible for it using timestamps.

Do not shift by integer record count. Delay is resolved in RPM/load operating space and applied through time-based sample alignment.

If delay is unavailable for an operating region, evidence is unavailable there. Do not silently fall back to a global delay.

## Fuel-correction compensation

Known correction layers may be compensated when their semantics are explicit. For example, a verified percent-fuel-applied STFT channel may be modeled as compensation; unknown correction semantics remain context-only unless explicitly declared.

The analyzer must never blindly attribute correction-layer behavior to base VE.

## VE evidence calculation

### Operating-point geometry

VE-table breakpoints are nodes, not rectangular buckets. Qualifying operating points contribute spatially to surrounding nodes using breakpoint/bilinear relevance.

Outside-axis behavior must remain explicit; silent extrapolation is not allowed.

### Robust evidence

Current VE evidence uses a robust weighted estimate rather than an outlier-sensitive arithmetic mean.

Per-node evidence retains/derives:

- contributing sample count;
- cumulative spatial weight;
- accepted source sample indices/provenance;
- robust central correction estimate;
- P10/P90 correction spread;
- confidence;
- delay used;
- qualification/proposal state.

A simple minimum-samples threshold is insufficient by itself.

## Prior authority and safeguards

The starting/current VE table acts as a prior. Weak evidence should move the proposal little or not at all; strong repeated evidence gains authority.

Current tuner-facing Cell Change authority maps to prior weight while Advanced exposes explicit controls when appropriate.

Independent safeguards include minimum evidence authority and absolute/percentage maximum VE change. When evidence exceeds configured proposal authority, the recommendation is **withheld**, not silently clamped.

## Result states and Result View

The workbench supports spatial result views including proposal, change, percent change, mixture-error/evidence perspectives, sample count, cumulative weight, confidence/spread and delay used.

Cells must distinguish meaningful evidence/proposal states and must not make unvisited cells look measured.

Per-cell evidence can navigate to the strongest contiguous source visit in Logger.

### Current known Result View defect

Result View fallback/precision behavior remains imperfect in the browser-known-good runtime. Fix it as an isolated change with browser validation; do not use the defect as justification to reintroduce the reverted post-#441 wrapper stack.

## Original tune and review authority

Maintain separately:

- original/current VE table;
- Analyzer evidence/proposal;
- user-reviewed/application result.

Running analysis must never mutate tune/ECU state.

Future review/application strength may support partial application, but application strength must remain separate from evidence authority.

Any eventual export/apply/write must be explicit and diff-first. EpicScope must never automatically Burn/write a VE proposal to the ECU.

## Current state-ownership debt

The current browser-known-good runtime intentionally retains older wrapper/DOM patterns because the later continuity/render redesign regressed Analyzer entry.

Known debt includes:

- destructive `setContext` / `setTuneModel` rebuild semantics;
- Logger → Analyzer result-state loss;
- cell-evidence review recomputing VE analysis rather than consuming retained primary results;
- working delay reconstruction/control partly through rendered DOM/synthetic handler paths;
- hidden one-shot qualification/load state;
- Result View rendering that consumes rendered presentation state in places where authoritative structured data should be used.

## Required next architecture direction

Proceed one structural change at a time from the current browser-known-good runtime:

1. fix Result View fallback/precision with isolated browser validation;
2. fix Logger → Analyzer result persistence with isolated browser validation;
3. expose explicit authoritative VE session/result/proposal/working-delay state;
4. make cell evidence consume retained primary results;
5. remove delay-table reconstruction from rendered DOM;
6. replace hidden one-shot analysis configuration with explicit request/session configuration;
7. only then continue broader review/application/export refinements.

Do not stack new lifecycle wrappers/MutationObservers around the current surface. Prefer one authoritative owner per structural area.

## Edge/regression requirements

Maintain regression coverage for table breakpoints/corners/edges, sparse evidence, invalid mixture data, source-index discontinuities, variable sample rate, timestamp delay interpolation, fuel-state exclusions, correction-layer presence/absence, proposal limits and delay-table provenance/editing.

Browser testing is mandatory for lifecycle/render/input changes.

## Performance requirements

No VE-specific full-log work during ordinary app/log load.

- VE analysis runs only from explicit **Run Analysis**.
- lambda-delay discovery runs only from explicit **Grab lambda delays from log**.
- cache/reuse safe artifacts where practical.
- changing settings may mark results stale but must not automatically trigger expensive recomputation.

## Product invariant

> EpicScope may recommend a VE change only when it can show what log evidence produced it, what operating-state rules qualified that evidence, what lambda-delay table aligned it, how strong/confident the evidence is, and why the requested change is inside or outside configured authority.
