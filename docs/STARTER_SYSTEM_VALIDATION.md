# Starter system validation close-out

This document records the validation boundary for the current Logger starter-template track after PR #370.

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

It does **not** claim every EpicEFI-specific control strategy has been exercised on a running engine. Those starters are schema/capability validated and remain subject to user feedback from real feature use.

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

## Validation matrix

| Area | Status | Evidence / invariant |
| --- | --- | --- |
| Generic catalog count/order | PASS | Automated catalog tests; exactly 12 portable starters. |
| Fresh-state seeding | PASS | Browser-tested after clearing site-local state; all generic workspaces materialized. |
| Existing state not re-seeded | PASS / guarded | D-055 lifecycle and Logger fresh-state guard; user-owned state remains authoritative. |
| EpicEFI starters excluded from fresh seed | PASS | `GENERIC_STARTER_WORKSPACE_TEMPLATES` filters specialized tier. |
| Capability discovery | PASS | Specialized starters require semantic `allOfRoleIds`; empty/nonmatching schemas hide them. |
| INI-only workspace editing | PASS | Established in PR #350 and subsequent starter work. |
| Template flyout reachability | PASS | PR #368 adds viewport-bounded vertical scrolling. |
| Single layout readouts | PASS | PR #369 restores normal overlay labels and NOW / MIN / MAX context. |
| Generic channel suitability | PASS for current baseline | Reviewed through PR #370; Boost/Ignition/Cooling assumptions corrected. |
| MAP/WW semantic suitability | PASS for current EpicEFI baseline | PR #370 uses Instant/Fallback/Effective MAP and mass-domain wall correction. |
| Materialized ownership | PASS | D-055: normal editable/deletable `graph-*`; no persistent starter owner. |
| Recorded MLG + INI identities | PASS | Existing semantic and source-binding coverage. |
| Shim raw identities | PASS | Existing source-normalization coverage and prior real Shim validation. |
| MLG/INI ↔ Shim transition | PASS | Prior real runtime validation plus `workspace-channel-identity` tests. |
| Unavailable channels | PASS | Missing roles remain explicit; no fabricated fallback data. |
| Full type-check/tests/build | PASS | Green through PR #370; close-out PR must repeat all three. |
| Every specialized strategy on real engine | NOT REQUIRED FOR CLOSE-OUT | Await field/user feedback; do not block architecture close-out. |

## D-055 regression checklist

A future change fails the starter-system contract if any of these become true:

- a starter remains attached to a workspace after materialization;
- changing source silently restores a removed channel;
- deleting a generic default causes it to reappear in an established workspace collection;
- a specialized starter is auto-created merely because its capability appears;
- board names such as `Mega144H7` are used instead of semantic capability detection;
- a configuration/table channel satisfies a runtime capability gate;
- raw and `ini:*` forms of the same logical channel render as duplicate traces;
- template definition updates rewrite existing user workspaces.

## Current manual smoke result

The project owner tested the current fresh-state behavior in the browser after clearing site-local browser state. The full generic baseline appeared as intended, and the corrected Single-layout presentation was accepted.

The broader workspace/source behavior was also exercised during the preceding starter development and no visible failure was reported before this close-out.

## Recommended regression sequence

If starter behavior is touched again, test in this order:

1. INI-only catalog → confirm 12 generic fresh-state workspaces and capability-gated template discovery;
2. edit/delete/rename a seeded workspace → refresh → confirm exact user state survives;
3. open representative MLG + INI → confirm assigned semantic channels render;
4. transition to `ts_shim` → confirm stable assignments map to raw runtime IDs without reapplying templates;
5. return to MLG + INI → confirm canonical `ini:*` identities and no duplicate traces;
6. create one specialized starter → edit it → repeat source transition and verify it remains ordinary user-owned state.

## Track status

The starter-template track is **closed for feature expansion** unless:

- field feedback exposes a concrete starter defect;
- a new ECU family demonstrates a portability gap;
- a genuinely new diagnostic workflow warrants a starter;
- indexed semantic channel-family support unlocks per-cylinder/EGT work cleanly.

Otherwise, development should move to the next product capability rather than continue growing the starter catalog.
