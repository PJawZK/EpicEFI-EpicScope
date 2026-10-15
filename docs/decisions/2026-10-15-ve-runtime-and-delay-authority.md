# 2026-10-15 — VE runtime validation and lambda-delay authority

Status: **accepted**

This decision records two durable VE Analyzer rules established during the PR #442–#449 regression investigation and subsequent browser validation.

## D-056 — VE lambda-delay working model is RPM × load table only

**Status:** Approved

EpicScope VE Analyzer uses an **RPM × load lambda-delay table** as its working delay model.

Earlier research/specification considered:

- one scalar delay;
- RPM → delay curve;
- RPM × load delay table.

The scalar and RPM-curve options are no longer accepted product direction. They remain historical research possibilities only and must not be reintroduced as supported modes without a new explicit project-owner decision.

Reasons:

- table representation preserves the operating-point dependence the feature is intended to measure;
- it avoids parallel UI/state paths for lower-fidelity modes;
- table editing/save/load/provenance is already the implemented and validated workflow;
- one authoritative delay-state shape reduces lifecycle/ownership complexity.

Discovery remains explicit through **Grab lambda delays from log**. Recommendation and working table remain distinct lifecycle states; user edits must remain explicit.

## D-057 — VE browser behavior is required acceptance evidence

**Status:** Approved

For VE Analyzer lifecycle, rendering, state-continuity and direct-edit interaction changes, automated CI is necessary but not sufficient.

The browser-known-good runtime boundary is the #441-era cell-evidence composition (`fd21e4d4a390a4f6607d0290ef273749fc7fd915`) restored by PR #449 (`86357400be6971b1f8edfe98d70816fa55b3bec5`).

PRs #442–#447 demonstrated that green automated validation can coexist with an Analyzer-entry browser freeze caused by lifecycle/render/state wrappers.

Therefore:

- make one structural VE change at a time;
- run typecheck/tests/build as normal;
- also verify the affected browser behavior before describing the change as fixed/validated;
- do not stack new continuity/lifecycle wrappers or MutationObservers around the workbench to compensate for unclear state ownership;
- prefer explicit authoritative controller/session/result state over rendered-DOM state bridges;
- preserve the known-good direct lambda-delay editing behavior while state ownership is refactored.

## Related invariants

These decisions do not change the existing product-safety contract:

- original VE/tune state is separate from Analyzer evidence/proposal;
- user-reviewed/application result is a third explicit state;
- running analysis never mutates tune state;
- any future apply/write is explicit and diff-first;
- EpicScope never automatically writes or Burns a VE proposal to the ECU.

## Current next sequence

At the time of this decision:

1. preserve the PR #449 browser-known-good runtime;
2. fix Result View fallback/precision as an isolated browser-verified change;
3. fix Logger → Analyzer result/session persistence as an isolated browser-verified change;
4. then consolidate authoritative VE session/result/proposal/working-delay ownership;
5. remove duplicate cell-evidence analysis and DOM-derived delay ownership after the state API exists.
