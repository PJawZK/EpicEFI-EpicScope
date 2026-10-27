# Native Idle Analyzer — stage completion status

This uses the seven stages in [the integration implementation plan](INTEGRATION_IMPLEMENTATION_PLAN.md), not the count of incremental implementation checkpoints. A working Stability slice does not establish completion for every diagnostic mode. Update this table at each subsequent implementation checkpoint and include stage completion status in the user-facing report.

| Stage | Completion status | Remaining closure work |
| --- | --- | --- |
| 1 — Fixtures and numerical contracts | Partial overall; current Stability fixture/contracts closed | Source inventory and corruption/timing matrix recorded. Documented remaining-mode numerical/capability gates still need executable implementation tests, especially recovery continuity/dwell and controller alignment/units. |
| 2 — Native session/source ownership | Complete for current primary-source Stability boundary | Source/lifecycle acceptance verified. Tune-dependent and independent-B extensions remain gates for the capabilities that consume them; those capabilities are not claimed implemented. |
| 3 — Shared core analysis | Partial; descriptive Stability and selected qualification working | Remaining mode metrics, event/recovery contracts, controller/tune-derived evidence and consistent event identity. |
| 4 — Native single-source UI | Partial; Stability workflow working, including purpose-aware interpretation | Additional diagnostic modes, supported read-only tune context and justified reference parity gaps. |
| 5 — Independent B/comparison | Not started natively | Transactional independent recording ownership, source-specific selections and qualified descriptive comparison. Existing Logger A/B means bounds inside one recording. |
| 6 — Persistence/plans/Logger workflow | Partial; real-source Logger handoff working | Versioned Idle session persistence, source rebind policy and validated plan round-trip. |
| 7 — Final acceptance/freeze | Open; individual checkpoint regression gates passing | Full-feature production/browser acceptance, manual UI acceptance, justified full-log hardware checks and final audit. No main merge authorized. |

Latest checkpoint: [fixture/contract and primary-source acceptance](NATIVE_CONTRACT_CHECKPOINT.md). [Closure checklist and numerical gates](NATIVE_CONTRACT_CLOSURE.md) distinguish completed current behavior from remaining-mode prerequisites.

Next: select one stage 3 analytical capability, implement its independent numerical/alignment/availability tests and complete that bounded core capability before activating its native UI. Recovery and controller gates are documented explicitly; do not treat legacy functions as accepted parity. Original unavailable recordings/tune/firmware must remain explicitly unavailable; the private prefix and synthetic scale test do not replace their provenance.
