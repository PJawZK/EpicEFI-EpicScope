<!-- CURRENT_STATE:handoff-pointer:START -->
> Current implementation/continuation state is authoritative in `docs/HANDOFF.md`. `docs/DOCUMENTATION_MAP.md` defines document authority.
<!-- CURRENT_STATE:handoff-pointer:END -->

# EpicScope Architecture

## Objective

EpicScope separates product semantics from platform execution so the Web implementation can validate behavior without locking the future Linux production implementation to browser-specific internals.

Development order remains Web functional reference → Linux production implementation → later Android/EpicHub reuse.

## Primary layers

```text
Source files / platform data sources
              ↓
           Parsers
              ↓
      Normalized source models
      ├─ samples/time/validity
      ├─ channel catalog/bindings
      └─ tune/firmware context
              ↓
 Semantic roles / capabilities
              ↓
    Generic analysis primitives
              ↓
   Event / tune / compare services
              ↓
      Specialized analyzers
              ↓
        Presentation / UI
```

`core/log-model/` remains a neutral contract boundary. Semantic roles/capabilities are metadata/identity logic; they do not duplicate sample arrays or replace provenance.

Observability is a cross-cutting Web/runtime concern that records compact lifecycle/state/performance/error evidence about these layers without becoming authoritative domain state.

## Source and parser ownership

Parsers decode/validate untrusted source syntax and produce normalized contracts. They do not own Analyzer conclusions, tune recommendations or UI behavior.

Current source/context responsibilities:

- MLG v1/v2 — recorded samples and validity;
- INI — channel/catalog/firmware metadata and stable logical identities;
- MSQ — tune/calibration values, tables, curves and scalars;
- `ts_shim` — live/capture source adapter and temporary live catalog authority.

MLG v3 remains researched but not implemented. CSV and other formats remain secondary/future unless explicitly prioritized.

## Source ownership and identity

Only one Logger sample/catalog source family is authoritative at a time:

```text
Recorded MLG + optional INI binding
              ↕
         INI catalog only
              ↕
      ts_shim live/capture
```

Loaded INI/MSQ survive source transitions.

Stable workspace identities normalize between canonical `ini:*` IDs and matching raw Shim IDs. Identity translation must not create duplicate traces, reapply starter templates or resurrect user-deleted channels.

The Mega144H7 → Pi Zero 2 W → `ts_shim` → LAN → browser path and MLG/INI ↔ Shim round trip are real-runtime validated.

## Semantic channel roles

Starter templates and analyzers express intent through semantic roles rather than hard-coded one-ECU channel lists.

Resolution preference:

1. explicit user/schema override;
2. exact native/known alias;
3. ECU-family/cross-ECU compatibility alias;
4. conservative normalized-name fallback;
5. unresolved.

Compatibility aliases do not define display authority. Literal source names remain preserved. A legacy alias such as `TP` may resolve throttle position while EpicScope presents its preferred semantic label where appropriate; source identity itself remains inspectable and unchanged.

## Starter-template materialization

EpicScope separates:

- **Layout** — geometry;
- **Starter template** — semantic diagnostic recipe;
- **Workspace** — ordinary user-owned materialized state.

Materialization resolves semantic roles once against the current catalog. After creation, template logic has no continuing ownership. User rename/delete/channel/layout choices remain authoritative. Template updates affect future materializations only.

Current production catalog: 12 generic + 12 capability-gated EpicEFI starters. The starter expansion track is closed unless field evidence justifies a new workflow.

## Generic analysis primitives

Reusable core analysis includes qualification/filtering, statistics, aggregation, interpolation where explicitly approved, Histogram/Table/Scatter geometry and other domain-neutral evidence operations.

Generic analysis must not contain ECU-system-specific conclusions.

## Specialized analyzers

Current Analyzer family includes:

- Range Compare and Tune Table support surfaces;
- Boost;
- Idle;
- AE / MAP Predict;
- Fueling;
- Ignition;
- Fuel Pressure / Injector;
- Trigger / Sync;
- VE Analyzer.

Specialized analyzers compose normalized source/tune context and reusable analysis primitives. They do not parse raw source files directly.

Fueling and non-knock Ignition are mature experimental checkpoints; Boost is strong; Fuel/Injector and Trigger/Sync retain targeted gaps; VE Analyzer is the highest-value active maturity target.

## VE Analyzer ownership boundary

VE Analyzer currently spans core evidence/proposal calculations and Web workbench/controller composition.

Durable ownership rules:

- original VE/tune state is immutable analysis input;
- Analyzer evidence/proposal is separate state;
- user-reviewed/application result is separate state;
- accepted lambda-delay working model is **RPM × load table only**;
- delay discovery is explicit user-triggered work;
- no automatic tune write/Burn;
- cell evidence should consume authoritative retained analysis results rather than independently recompute them once the state API is stabilized;
- rendered DOM must not become long-term authoritative storage for proposal/result/working-delay state.

The browser-known-good runtime is the #441-era composition restored by PR #449. Future state-ownership cleanup must proceed one structural change at a time with browser verification.

## Tune services

Tune services own normalized tables/axes/cells/scalars and operating-point correlations. Raw INI/MSQ syntax remains parser ownership.

Tune context enriches analysis; it does not make EpicScope a live tune editor.

## Session and persistence

Domain Session composes source/tune/events/results without becoming a general UI state store.

Presentation/workspace persistence remains separate from log-specific navigation state. Persisted/public artifacts require versioning/migration or explicit unsupported-version behavior.

VE session/result persistence is currently incomplete across Logger → Analyzer navigation and is an active maturity issue, not a reason to collapse domain/presentation ownership.

## Observability ownership

EpicScope will converge the current fragmented diagnostics/performance/report ownership into one bounded Web observability/session architecture as defined in `OBSERVABILITY.md` and D-058.

Durable rules:

- observability records **what happened**, but does not become source/tune/analysis truth;
- existing measurement probes remain in their natural parser/core/adapter/UI owners and publish compact evidence into observability;
- events, metrics and snapshots share operation/session correlation;
- specialized Health, Performance, Parser / Source Integrity, Resources, Errors and export surfaces become projections over the shared observability data;
- current-session and previous-session history is bounded by time/count/bytes;
- no silent upload/telemetry or raw log/tune payload capture;
- redundant diagnostic stores/builders are deleted after migration parity rather than kept permanently beside the new path;
- instrumentation must not materially alter scheduling or create observer/render/event feedback loops.

Observability is Web/runtime infrastructure, not a new general application state store.

## Presentation/UI ownership

UI owns layout, interaction and navigation; it should not become the sole owner of reusable analysis truth.

Current workflow:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

The EpicScope logo dropdown switches Logger / Analyzer / Histogram. Analyzer/Histogram use compact secondary selectors.

Logger owns the authoritative timeline; Histogram surfaces reuse the complete timeline wrapper rather than divergent copies.

## Current Web large-log path

Current optimized Web access path:

1. session/RAM full-range cache;
2. OPFS MLG column sidecar;
3. sparse native per-channel OPFS cache;
4. original row-reader fallback.

This is a Web implementation strategy, not a Linux mandate. The broad Web performance campaign is paused unless measured regression appears.

## Error/missing-data policy

Missing/unavailable/invalid data must remain explicit. A missing semantic role should degrade only the affected capability where practical; it must not fabricate a value or silently broaden Qualification.

## Validation discipline

Architecture claims move from proposed to validated only with appropriate automated and runtime evidence.

For VE Analyzer lifecycle/render/input changes, browser behavior is required acceptance evidence; CI/typecheck/tests/build alone are insufficient after the PR #442–#447 regression experience.

Observability migration steps also require browser validation and representative performance comparison because instrumentation itself can perturb timing/lifecycle behavior.

## Privacy boundary

Local analysis remains local by default. Sharing/publishing/telemetry are separate explicit capabilities and must not silently transmit log/tune contents, filenames, derived values or results.

Observability follows the same boundary and should prefer IDs, revisions, counts, durations, hashes and compact deltas over raw payloads.

## Change control

New top-level subsystems, dependency directions or cross-layer responsibilities require project-owner approval and corresponding decision/file-architecture documentation before implementation.
