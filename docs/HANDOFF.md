# EpicScope Handoff

## Continuation authority

Repository: `PJawZK/EpicEFI-EpicScope`

Authoritative production and continuation branch: `main`.

PR #462 — **Integrate Analyzer ownership and correctness fixes through point 11** — is merged.

Merge commit:

`2fdce3a4fc2a8759a45058c0ebc06dba0ed4739b`

The exact runtime build accepted in browser before merge was:

`b435702412642f039a8a7f49d33037c309bef9d8`

The later `7d0be605ecd11a35f46ea8552893842fbb1fedb4` commit was documentation-only. The merge commit incorporated that accepted runtime lineage. The observability architecture/research was then ported onto the accepted `main` baseline without runtime changes in `aa92d48f2671a1cd2f75f3b4fbcfb66e4dc35f19`.

Hosted application:

`https://pjawzk.github.io/EpicEFI-EpicScope/`

This file is the present-tense continuation authority. If older documentation conflicts, use current `main`, this handoff, the relevant subsystem authority, and current browser/runtime evidence.

## Current project position — 2026-10-16

- **Logger** — mature functional reference. Broad optimization remains paused unless a measured regression appears.
- **Histogram** — generic research-parity checkpoint is closed for the approved scope. Table Generator, Distribution, Scatter and Math Channels are mature unless field use exposes a concrete gap.
- **Analyzer** — ownership/correctness/performance cleanup through points 1–11 is merged into `main` and browser-accepted.
- **VE Analyzer** — stable current maturity checkpoint. The Result View source-authority and heat-map regressions are closed; session retention, retained-primary evidence reuse, semantic invalidation, active-domain routing and cooperative analysis are accepted.
- **UI** — immediate next work is a focused polish/consistency pass. Keep this visual/workflow-focused and avoid reopening accepted ownership architecture without a concrete defect.
- **Diagnostics / observability** — D-058 is approved and the architecture/research now lives on `main`. This is the next substantial implementation track after UI polish.
- **Point 12 telemetry async conversion/socket identity** — still reproduction-gated and lower priority.
- **MLG v3** — researched compatibility extension, not yet implemented; v1/v2 remain production support.
- **Linux production implementation** — future work after Web functional maturity and observability consolidation.

## Accepted Analyzer / VE baseline

Points 1–11 are complete on `main`:

1. large-log correctness and >320k-sample regression coverage;
2. VE session authority and navigation retention;
3. retained-primary evidence reuse;
4. semantic cell-detail invalidation;
5. selector/DOM ownership cleanup;
6. active Analyzer routing and stale hidden-work rejection;
7. measured CPU/correctness cleanup;
8. cooperative VE batching/progress/cancel;
9. visible/recoverable persistence failures;
10. controller-owned analysis trace-load errors;
11. transactional MSQ replacement with latest-generation authority.

Do not restore older controller/wrapper stacks or redo these points from historical branches.

### Result View acceptance

The prior defect used mutable rendered cell text as the source for later Result Views. Current behavior resolves source VE from retained authoritative analysis/model state instead.

Owner browser acceptance confirmed on the exact preview runtime SHA `b435702412642f039a8a7f49d33037c309bef9d8`:

- VE values remain stable through repeated Result View switching;
- Proposed VE uses normal VE heat;
- alternate views scale cells that have a real selected metric;
- untouched/fallback cells in alternate views keep the VE value but use neutral heat;
- Lambda Delay values remain correct;
- weak/evidence-only/no-evidence presentation remains sensible;
- completed VE analysis survives switching analyzers and leaving/re-entering Analyzer;
- no additional trace loading is caused by presentation-only view changes;
- Analyzer responsiveness is substantially improved compared with the problematic pre-Codex state.

### Remaining VE ownership debt

`readDelaySurface()` still reconstructs working delay information from rendered DOM even though the VE owner has authoritative working-delay state. This is later cleanup, not a current blocker. Do not broaden UI polish into this refactor unless a concrete issue makes it worthwhile.

## Approved visible workflows

Primary:

> **Load Data → Channels → Navigate → Select / qualify range → Analyze → Compare / Export**

Histogram:

> **Scope → Channels → Qualification → analysis-specific controls → evidence → Logger / Export**

VE Analyzer:

> **Load INI + MSQ + Log → select VE/target tables → verify actual mixture/RPM/load → qualify → discover/load lambda delay → activate working delay table → Run Analysis → review evidence/proposal**

Load Data order remains:

1. Load INI
2. Load MSQ
3. Open Log
4. Unload Log
5. Connect Shim

INI and MSQ are independent application resources and survive source transitions.

## Source/runtime topology

Validated topology:

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

The Pi Zero 2 W phone-hotspot workflow is validated: Pi and laptop can share the phone hotspot for `ts_shim`, and the Pi returns to the configured home network when the hotspot is disabled.

Stable workspace assignments normalize between canonical `ini:*` identities and matching raw Shim identities. Source transitions must never reapply starter templates, resurrect deleted channels or create raw + `ini:*` duplicate traces.

## Observability / diagnostics authority

D-058 establishes one bounded correlated observability/session architecture. Implementation authority is `docs/OBSERVABILITY.md`; performance-first implementation research is `docs/research/OBSERVABILITY_PERFORMANCE_IMPLEMENTATION_RESEARCH.md`.

Core constraints already accepted:

- one authoritative bounded observability/session stream;
- specialized diagnostics/reports are projections rather than parallel durable stores;
- existing useful probes stay in their natural owners;
- packed/efficient hot-path representation and separate critical/detail retention;
- pre-insertion coalescing/backpressure so event storms make recording cheaper rather than worse;
- stable machine IDs and explicit numeric operation correlation;
- owner-provided revisions/fingerprints, never arbitrary full-state hashing;
- event/boundary-driven snapshots, not broad polling;
- O(1)-amortized streaming anomaly state with expensive causal analysis deferred;
- batched/chunked structured persistence rather than one write per event;
- bounded previous-session tail plus anomaly/error context windows;
- recursion/self-observation protection;
- explicit minimal/off versus enabled overhead benchmarks;
- anomaly detection initially reports evidence and does not automatically mutate/repair runtime state;
- local-first behavior with no silent telemetry or raw log/tune upload.

## Repository cleanup state

PR #462 is merged and is the accepted runtime baseline. The old Codex/VE validation PRs and the stale observability PR are historical only and should be closed after their useful content is represented on `main`.

Remote branches are not knowledge stores. Git/merged PR history and current documentation preserve provenance. `browser-previews` remains an infrastructure/deployment branch; `main` is the only product authority.

The GitHub connector available in this session can close PRs and audit refs but does not expose remote-branch deletion. Any branch refs classified as superseded in `BRANCH_CLEANUP_2026-10-15.md` may be deleted manually or by normal Git tooling without losing current authority.

## Immediate continuation order

1. Complete a focused UI polish pass from current `main`: consistency, spacing, control hierarchy, visual rough edges and accessibility/interaction details. Preserve accepted runtime semantics.
2. Run normal CI and browser sanity checks after UI work, especially Logger/Analyzer/Histogram navigation and VE Result Views.
3. Begin D-058 observability implementation from the staged plan in `OBSERVABILITY.md`, starting with benchmark baseline plus record/session/operation/retention contracts rather than UI-first diagnostics work.
4. Migrate existing diagnostics/performance/runtime-error/report paths incrementally; delete old collectors/builders only after parity.
5. Keep point 12 reproduction-gated.
6. Resume lower-priority Analyzer maturity or MLG v3 only when justified after observability consolidation.
7. Perform Web functional maturity review before Linux becomes the primary implementation target.

## Acceptance and safety rules

For VE/Analyzer runtime work, CI is necessary but not sufficient; browser behavior on the integrated build remains acceptance authority.

UI polish must not silently alter analysis semantics, qualification, source/tune authority, persistence, or ECU interaction.

Never automatically write or Burn to the ECU. Original tune/VE data, Analyzer evidence/proposal and any user-reviewed application result remain distinct states.
