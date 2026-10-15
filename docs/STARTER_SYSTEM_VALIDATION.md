# Starter system validation close-out

Status: **closed current baseline, 2026-10-15**.

This document records the validation boundary for the Logger starter-template track. `PREPOPULATED_WORKSPACES.md` is the current catalog/product authority.

## Scope

The close-out covers:

- generic fresh-state seeding;
- template discovery and capability gating;
- one-time materialization semantics;
- persistence ownership;
- INI-only usability;
- recorded MLG + INI identity binding;
- `ts_shim` raw runtime identity binding;
- source-transition normalization;
- starter catalog size/content invariants;
- viewport usability of the template flyout;
- Single-layout readout presentation.

It does not claim every EpicEFI-specific control strategy has been exercised on a running engine. Those starters are schema/capability validated and remain subject to field feedback.

## Current catalog boundary

```text
12 generic starters
12 EpicEFI capability-gated starters
24 production starter definitions total
```

Generic:

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

EpicEFI-specific:

```text
MAP Predict + Wall Wetting
Fuel Rail Diagnostics
ETB Control
Dual Chamber Boost
Trigger + Sync Detailed
Injector + Ignition Timing
Engine Protection
VVT Control
Anti-Lag
Launch Control
Traction Control
Transmission Control
```

## Validated invariants

| Area | Status | Current invariant |
| --- | --- | --- |
| Generic catalog count/order | PASS | Exactly 12 portable generic starters. |
| Fresh-state seeding | PASS | Generic baseline materializes on genuinely fresh workspace state. |
| Existing state not re-seeded | PASS / guarded | User-owned state remains authoritative; deleted/edited defaults do not silently return. |
| EpicEFI starters excluded from fresh seed | PASS | Specialized tier is discovery-only, not auto-created. |
| Capability discovery | PASS | Specialized starters require semantic capability bundles; nonmatching schemas hide them. |
| INI-only workspace editing | PASS | Workspaces remain usable/editable without a loaded log when catalog context exists. |
| Template flyout reachability | PASS | Viewport-bounded scrollable template selection. |
| Single layout readouts | PASS | Normal overlay channel labels and NOW / MIN / MAX context. |
| Generic channel suitability | PASS for current baseline | Generic Boost/Ignition/Cooling assumptions were corrected before close-out. |
| MAP/WW semantic suitability | PASS for current EpicEFI baseline | Model-focused channels and mass-domain wall correction are used. |
| Materialized ownership | PASS | Normal editable/deletable `graph-*`; no persistent starter owner. |
| Recorded MLG + INI identities | PASS | Stable semantic/source binding retained. |
| Shim raw identities | PASS | Source normalization maps stable assignments to raw runtime IDs. |
| MLG/INI ↔ Shim transition | PASS | Real runtime/source-transition path validated. |
| Unavailable channels | PASS | Missing roles stay explicit; no fabricated fallback data. |
| Type-check/tests/build at close-out | PASS | Track closed with automated validation in place. |

## Ownership regression checklist

A future change fails the starter contract if any of these become true:

- a template remains attached as a hidden owner after materialization;
- changing source restores a user-removed channel;
- deleting a generic seeded workspace causes it to reappear in established state;
- a specialized starter is auto-created merely because its capability appears;
- board names are used instead of semantic capability detection;
- configuration/table values satisfy a runtime capability gate;
- raw and `ini:*` forms of the same logical channel render as duplicate traces;
- template updates rewrite existing user workspaces.

## Manual/browser evidence

The project owner browser-tested fresh-state behavior after clearing site-local state; the full generic baseline appeared as intended and the corrected Single-layout presentation was accepted.

The recorded MLG + INI ↔ `ts_shim` source path and stable identity normalization were also validated in the broader live-source work.

## Recommended regression sequence

If starter behavior changes again:

1. INI-only catalog → confirm 12 generic fresh-state workspaces and specialized discovery;
2. edit/delete/rename → refresh → confirm exact user state survives;
3. open representative MLG + INI → confirm semantic assignments render;
4. transition to `ts_shim` → confirm stable assignments map to raw IDs without template reapplication;
5. return to MLG + INI → confirm canonical `ini:*` identities and no duplicate traces;
6. materialize/edit one specialized starter and repeat the source transition.

## Track status

The starter-template track is **closed for feature expansion** unless field feedback exposes a concrete defect, a new ECU family demonstrates a portability gap, a genuinely new diagnostic workflow warrants a starter, or indexed semantic channel-family support unlocks high-value per-cylinder/EGT work cleanly.

Otherwise development should remain focused on higher-value Analyzer maturity rather than growing the starter catalog.
