# VE Analyzer specification

## Status

VE Analyzer is implemented and real-log/browser validated. This document is the current algorithm/evidence/product contract. `VE_ANALYZER_WORKBENCH.md` is the companion UI/workflow contract.

The current accepted runtime lineage is PR #462 merged to `main` at `2fdce3a4fc2a8759a45058c0ebc06dba0ed4739b`. The exact pre-merge runtime accepted by owner browser testing was `b435702412642f039a8a7f49d33037c309bef9d8`.

Browser behavior remains the acceptance authority for VE lifecycle/render/state changes; green CI alone is insufficient.

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

Missing optional safeguards must remain visible/unavailable rather than silently fabricated.

`Custom` qualification semantics remain a later debt area: future advanced formula support must not make Custom silently disable normal safety/state exclusions.

## Lambda-delay model

The accepted working model is **RPM × load delay table only**. Scalar/single-delay and RPM-curve modes are historical/rejected options unless a new explicit decision reopens them.

Delay is expressed in time, not record count.

The expensive scan runs only when the user presses **Grab lambda delays from log**. Discovery produces recommendation/provenance; the working table remains a distinct explicit state that may be loaded, edited or activated from the recommendation.

Each working cell should retain provenance such as measured, interpolated or insufficient where available. A valid interpolated delay is a real Result View metric even when a VE cell itself has no retained fueling evidence.

Timestamp alignment must map observed mixture response back to the earlier engine/fuel state by time rather than by fixed sample count.

## Evidence model

VE evidence is accumulated against selected VE-table geometry. The implementation uses robust weighted evidence rather than simple rectangular averaging.

Current evidence includes:

- qualifying sample count;
- cumulative spatial evidence weight;
- robust correction estimate;
- P10/P90 correction spread;
- confidence/evidence state;
- source provenance for review/navigation.

The starting VE table is the prior/authority anchor. Proposal safeguards are independent of evidence collection: out-of-authority cells are withheld rather than silently clamped into a plausible-looking value.

Weak/withheld/evidence-only/no-evidence states must remain distinguishable from measured proposal state.

## Fuel-correction handling

Known fuel-correction channels may be incorporated only with explicit semantics. The analyzer must not assume that every logged correction is equivalent to base-VE error. Missing correction context must remain visible rather than fabricated.

## Result Views

Result Views are presentation over retained authoritative analysis state. They must never use whichever text is currently rendered in a cell as the source of truth for the next view.

Accepted behavior:

- **Proposed VE** — displays proposal where one exists and original VE otherwise; uses normal VE-table heat.
- **VE change / change %** — derived from the original authoritative VE plus retained proposal/candidate evidence.
- **Mixture error %** — retained robust correction evidence where available.
- **Samples / Evidence weight / Confidence / Spread** — retained evidence metrics where available.
- **Lambda delay** — valid interpolated/working delay where available.
- a cell without the selected alternate metric keeps its original VE value but uses neutral alternate-view heat rather than carrying Proposed VE coloring.

Repeated view switching must preserve the same underlying VE values, retained primary-analysis identity and trace-load count.

## Session and ownership semantics

Points 1–11 merged through PR #462 establish the accepted ownership model:

- semantically unchanged context/tune/navigation preserves the completed VE session, working delay, primary result and proposal;
- genuine source/catalog/sample-count/validity/tune/scope changes invalidate conservatively;
- asynchronous generations reject stale completion/error publication;
- only the active Analyzer domain receives expensive work;
- cell evidence consumes retained primary analysis rather than running a second full-log VE analysis;
- VE work is cooperatively batched with progress and explicit Cancel;
- persistence/load failures are surfaced and recoverable;
- MSQ replacement is transactional and latest-selection-wins.

Do not restore historical wrapper/controller stacks to change presentation.

## Browser-accepted regression behavior

Owner acceptance on `b435702412642f039a8a7f49d33037c309bef9d8` confirmed:

- repeated Result View cycling preserves VE values;
- heat-map behavior matches intended semantics;
- Lambda Delay values remain correct;
- weak/evidence-only/no-evidence cells remain sensible;
- completed VE analysis survives switching analyzers and leaving/re-entering Analyzer when semantics are unchanged;
- responsiveness is substantially improved versus the problematic pre-Codex state.

## Remaining debt

`readDelaySurface()` still reconstructs the working delay surface from rendered headers/cells/datasets even though the VE owner has authoritative working-delay state. This is later ownership cleanup and is not a current blocker.

Future review/application-strength/export/diff work remains separate from evidence authority.

## Safety boundary

The original VE table is analysis input. Running analysis must never mutate tune/ECU state.

Never automatically write or Burn to the ECU. Original tune/VE data, Analyzer evidence/proposal and any user-reviewed application result remain distinct states.
