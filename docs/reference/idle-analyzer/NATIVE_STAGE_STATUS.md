# Native Idle Analyzer — stage completion status

This uses the seven stages in [the integration implementation plan](INTEGRATION_IMPLEMENTATION_PLAN.md), not the count of incremental implementation checkpoints. A working Stability slice does not establish completion for every diagnostic mode. Update this table at each subsequent implementation checkpoint and include stage completion status in the user-facing report.

| Stage | Completion status | Remaining closure work |
| --- | --- | --- |
| 1 — Fixtures and numerical contracts | Partial; Stability contracts implemented and tested | Close the source/provenance inventory; map canonical corruption/timing fixtures to the required cases; document and test numerical/capability contracts for remaining modes, especially recovery and controller signals. |
| 2 — Native session/source ownership | Partial; primary-source Stability foundation and declared region purposes working | Close the role/capability contracts needed by upcoming modes and explicitly document/test tune-dependent invalidation when tune context is introduced. Verify these against the stage acceptance checklist before marking the whole stage complete. |
| 3 — Shared core analysis | Partial; descriptive Stability and selected qualification working | Remaining mode metrics, event/recovery contracts, controller/tune-derived evidence and consistent event identity. |
| 4 — Native single-source UI | Partial; Stability workflow working, including purpose-aware interpretation | Additional diagnostic modes, supported read-only tune context and justified reference parity gaps. |
| 5 — Independent B/comparison | Not started natively | Transactional independent recording ownership, source-specific selections and qualified descriptive comparison. Existing Logger A/B means bounds inside one recording. |
| 6 — Persistence/plans/Logger workflow | Partial; real-source Logger handoff working | Versioned Idle session persistence, source rebind policy and validated plan round-trip. |
| 7 — Final acceptance/freeze | Open; individual checkpoint regression gates passing | Full-feature production/browser acceptance, manual UI acceptance, justified full-log hardware checks and final audit. No main merge authorized. |

Latest bounded feature: [declared region purposes and purpose-aware Stability interpretation](NATIVE_PURPOSE_CHECKPOINT.md).

The next bounded closure task is the stage 1–2 fixture/contract checklist. Inventory existing production coverage first, add only verified missing prerequisites, and avoid converting more modes in the same checkpoint. Original unavailable recordings/tune/firmware must remain explicitly unavailable; the private prefix and synthetic scale test do not replace their provenance.
