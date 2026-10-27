# Native Idle Analyzer — stage completion status

This uses the seven stages in [the integration implementation plan](INTEGRATION_IMPLEMENTATION_PLAN.md), not the count of incremental implementation checkpoints. A working Stability slice does not establish completion for every diagnostic mode. Update this table at each subsequent implementation checkpoint and include stage completion status in the user-facing report.

| Stage | Completion status | Remaining closure work |
| --- | --- | --- |
| 1 — Fixtures and numerical contracts | Partial overall; current Stability fixture/contracts closed | Source/corruption matrix and Stability/Base Airflow numerical tests recorded. Other mode gates still need executable tests, especially recovery continuity/dwell and controller alignment/units. |
| 2 — Native session/source ownership | Existing primary-source foundation complete; Viewed extension pending | Source/lifecycle acceptance verified. Tune-dependent and independent-B extensions remain gates for the capabilities that consume them; those capabilities are not claimed implemented. |
| 3 — Shared core analysis | Partial; Stability/qualification and Base Airflow core working | Base Airflow context integrated; remaining mode metrics, recovery, controller/tune-derived evidence and event identity stay open. |
| 4 — Native single-source UI | Partial; Stability and Base Airflow recorded-context workflows working | Additional diagnostic modes, supported read-only tune context and justified reference parity gaps. |
| 5 — Independent B/comparison | Not started natively | Transactional independent recording ownership, source-specific selections and qualified descriptive comparison. Existing Logger A/B means bounds inside one recording. |
| 6 — Persistence/plans/Logger workflow | Partial; real-source Logger handoff working | Versioned Idle session persistence, source rebind policy and validated plan round-trip. |
| 7 — Final acceptance/freeze | Open; full browser gate passed; manual/hardware acceptance pending | Full-feature production/browser acceptance, manual UI acceptance, justified full-log hardware checks and final audit. No main merge authorized. |

Latest checkpoint: [full regression gate investigation and pass](NATIVE_REGRESSION_GATE_CHECKPOINT.md). [Closure checklist and numerical gates](NATIVE_CONTRACT_CLOSURE.md) distinguish completed current behavior from remaining-mode prerequisites.

Next: implement the [Viewed region scope plan](VIEWED_REGION_IMPLEMENTATION_PLAN.md) as one bounded functional checkpoint before another diagnostic mode. Broad layout/candidate-feedback cleanup waits until HTML features are incorporated; shared in-app help follows Idle Analyzer. Recovery and controller gates are documented explicitly; do not treat legacy functions as accepted parity. Original unavailable recordings/tune/firmware must remain explicitly unavailable; the private prefix and synthetic scale test do not replace their provenance.
