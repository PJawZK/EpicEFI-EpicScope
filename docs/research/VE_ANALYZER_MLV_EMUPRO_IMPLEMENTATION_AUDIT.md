# VE Analyzer implementation audit against MLV and EMU PRO

Date: 2026-10-14

> **Status: historical implementation snapshot.**
>
> This audit recorded EpicScope VE maturity at the time of the MLV/EMU PRO comparison pass. Several items that were “missing/incomplete” here were implemented later the same development cycle. Do not use this file as present-tense status.
>
> Current authority: `../VE_ANALYZER.md`, `../VE_ANALYZER_WORKBENCH.md`, `STATUS.md`, and `../HANDOFF.md`.

## Purpose

The audit compared EpicScope's then-current VE Analyzer against preserved MegaLogViewer HD VE Analyze and ECUMaster EMU PRO VE Tuner behavior so mature safeguards/workflows would not be lost while EpicScope added stronger evidence/provenance semantics.

Reference research remains in:

- `MLV_VE_ANALYZE_WORKFLOW_PASS.md`;
- `VE_AUTOTUNE_REFERENCE_RESEARCH.md`;
- `MLV_BEHAVIORAL_RESEARCH.md`.

## Findings that remain durable

The 2026-10-14 pass established or reinforced these requirements, which remain valid:

- two-table VE + target-mixture workbench;
- explicit Run Analysis rather than automatic heavy computation;
- literal source/table/channel identity preserved;
- AFR/Lambda scale awareness;
- spatial/bilinear VE-node evidence weighting;
- starting-table prior authority;
- cumulative evidence/minimum evidence;
- independent absolute and percentage proposal safeguards;
- out-of-authority recommendations withheld rather than silently clamped;
- original tune table immutable as analysis input;
- correction-layer context/compensation only when semantics are explicit;
- state qualification and recovery/stability handling;
- robust evidence statistics/spread/confidence;
- timestamp-based mixture-response delay;
- explicit user-triggered delay discovery;
- delay recommendation and working table are distinct lifecycle states;
- saved reusable delay tables do not become “measured in this log” merely because they are loaded;
- user-edited delay values are tuner authority and must not be presented as measured evidence;
- proposal review/application is explicit and separate from analysis;
- Run Analysis never implies tune/ECU mutation.

## Historical gaps from this snapshot

At the time of this audit, work still called for better quick qualification, tuner-facing Cell Change authority, multiple Result Views and richer proposal review lifecycle.

Since then:

- practical quick qualification and explicit Run readiness were implemented;
- tuner-facing Cell Change authority presets were implemented;
- Result View modes were implemented;
- RPM×load delay discovery/editing/save/load matured substantially;
- cell evidence and strongest contiguous Logger-visit navigation were implemented.

Therefore those sections from the original audit are no longer current missing-feature lists. Git history preserves the exact original audit text if needed for archaeology.

## Current changes relative to the old research options

One important product decision now deliberately narrows the earlier reference/spec options:

- accepted lambda-delay working model is **RPM × load table only**;
- scalar/single-delay and RPM-curve modes are historical/rejected options unless explicitly reopened by a future decision.

See `../decisions/2026-10-15-ve-runtime-and-delay-authority.md` (D-056).

## Current unresolved maturity work

Current VE debt is different from the 2026-10-14 missing-feature list:

- Result View fallback/precision behavior;
- Logger → Analyzer result/session persistence;
- destructive lifecycle rebuilds;
- duplicate analysis in cell-evidence review;
- working delay state partly reconstructed/controlled through rendered DOM;
- Custom qualification semantics needing redesign before advanced formula support.

These should be addressed one isolated structural change at a time from the PR #449 browser-known-good runtime, with browser validation after each lifecycle/render/input change (D-057).

## Research invariant

MLV and EMU PRO remain behavioral references, not implementation authorities. EpicScope should retain mature tuner expectations where useful while preserving stronger evidence/provenance/safety semantics and avoiding proprietary code/architecture copying.
