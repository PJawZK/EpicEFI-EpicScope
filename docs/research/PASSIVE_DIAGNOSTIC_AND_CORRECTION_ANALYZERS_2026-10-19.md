# EpicScope — Passive diagnostic and correction analyzers (research proposal)

**Status:** Proposal / requires further investigation. Not an approved implementation plan.
**Date:** 2026-10-19
**Scope:** EpicScope only. This document captures product direction for later review; it does not authorize implementation, branch merges, new write paths, or changes to existing analyzers.

## Motivation and intended outcome

EpicScope's primary value should be **reducing the time needed to identify and correct ECU and engine problems from already-recorded logs**. The user should not need to know in advance which traces to combine, manually search for telling channels, or drive a special calibration route every time a question arises.

Prefer **passive, offline analysis of ordinary driving logs** with the matching tune and ECU definitions when available. Active, guided vehicle testing remains useful when passive data cannot distinguish causes or support a defensible correction, but it consumes substantial time and should be requested only for a specific unresolved evidence gap.

A desired user flow:

1. Import MLG log and, where available, the matching MSQ and INI.
2. Resolve qualified channel roles and relevant operating states/events.
3. Run applicable analyzers without the user first selecting every channel combination.
4. Present prioritized findings, quantified deviations, evidence strength and uncertainty.
5. When supported by sufficient evidence, offer **reviewable calibration change proposals** similar in spirit to VE Analyzer; otherwise offer diagnostic explanations and next checks, not fabricated numeric corrections.
6. Link each finding to original log intervals and the relevant tune values.
7. Compare later logs to evaluate whether reviewed changes improved the measured behavior.

Analysis remains read-only. No automatic tune mutations, ECU writes or Burns.

## Candidate domains (inventory, not implementation order)

- **VE / general fueling:** extend qualified steady-state mixture evidence and VE proposal concepts to related fueling deviations; avoid conflating injector, pressure, correction-layer or transient causes with VE.
- **Idle:** subsystem-aware stabilization, return-to-idle, headroom, duty/bias, ignition interaction, oscillation and controller behavior; consider bounded proposals only where the model is identifiable.
- **Boost:** open/closed-loop operating modes, targets, duty and response, overshoot/undershoot, settling, RPM dependence and repeatability, including dual-chamber setups. Never infer plumbing polarity from duty alone.
- **AE / MAP Predict / Wall Wetting:** passive detection of natural tip-in/tip-out events, mixture response and repeatable error; seek targeted active tests when parameter effects cannot be separated.
- **Electrical / ECU fault states / Trigger-Sync:** unexpected shutdowns, supply-voltage issues, RPM/sync anomalies, error and cut states, sensor plausibility, pre/post event context and ranked diagnostic paths.
- **Fuel pressure / injectors:** differential-pressure behavior where measurable, sag/recovery, pump/injector limits, battery/deadtime context and transient pressure events.
- **Ignition:** commanded/final advance, dwell, corrections, attribution and regions to review. Do not claim knock detection, MBT timing or safe timing increases without validated independent evidence.
- **Cross-domain:** correlate findings across analyzers without presenting temporal association as proven causation.

Additional areas can be considered during investigation, not assumed as required scope.

## Shared product behavior to investigate

- **Whole-log analysis:** determine which analyzers apply from actual available data and capabilities; no silent channel substitutions.
- **Evidence contract:** event windows, source provenance/continuity, sample qualification, uncertainty, repeatability, comparison baselines and direct Logger navigation.
- **Finding severity versus confidence:** distinguish potentially serious behavior from strong evidence or model certainty.
- **Output authority tiers:** observation → diagnosis/possible causes → suggested checks → quantitative correction proposal when justified → later measured verification. Not every domain can support the same tier.
- **Correction proposal contract:** explicit source tune/version, scoped original/proposed values, calculation and exclusions, evidence strength, limits and reasons for withholding a proposal.
- **Cross-analyzer interaction:** recognize overlaps and conflicts (e.g. mixture error from fuel pressure versus VE) without duplicating or competing semantic owners.
- **Performance:** bounded, cancellable, large-log-safe execution; reuse existing parsed data and analysis infrastructure instead of multiplying full-log scans.
- **Passive-first validation:** when evidence is insufficient, specify the minimum additional data or controlled test needed, rather than issuing speculative corrections.
- **Review and verification:** export/report ideas and before/after comparisons without claiming improvement from the same evidence used to create the correction.

## Existing implementation and compatibility considerations

EpicScope already has specialized experimental analyzers and a substantive VE Analyzer. The scope of this proposal is to **investigate extension and consolidation of existing foundations**, not to introduce a parallel analysis subsystem or restart mature work. Review current owner documentation first, including:

- `docs/ANALYZER.md`
- `docs/VE_ANALYZER.md` and `docs/VE_ANALYZER_WORKBENCH.md`
- `docs/FUELING_ANALYZER.md`
- `docs/SPECIALIZED_WORKSPACE_COVERAGE.md`
- `docs/HANDOFF.md` and current branch-specific VE v50 authority

Existing Logger/channel-role, MSQ/INI, evidence navigation, source-integrity and qualification contracts should remain the starting point. Preserve domain-specific safety constraints and the difference between observational detection and identifiable calibration adjustments.

In particular, the active VE Analyzer v50 work and its manual-acceptance/merge boundary **must not be changed or bypassed as part of this document**. This note does not alter the existing roadmap's currently authorized implementation sequence.

## Further investigation required before any development

1. Audit each existing analyzer for actual inputs, qualification, events, evidence, causal limits, outputs and reusable proposal primitives; separate already-implemented behavior from gaps.
2. Compare useful passive features against the existing VE Analyzer and AE Tuner *conceptually* without copying AE Tuner runtime architecture into EpicScope.
3. Determine which specific corrections are mathematically identifiable from an ordinary log and matching tune versus those needing active perturbation, new sensors or validated physical models.
4. Define common finding/proposal/evidence contracts only after checking existing ownership and performance architecture.
5. Select a **small, measurable first-use case** (potentially electrical/trigger event discovery or a bounded Idle/Boost evidence-to-proposal path), with test logs, explicit success criteria and failure/withholding cases.
6. Produce an independently reviewed phased implementation plan with time-saving value, risk, regression scope and safety gates. Obtain explicit authorization before implementation.

## Decision boundary

**Recorded idea, not approved work.** Resume only when the broader vehicle-project prioritization allows it. No current feature, branch, tune or firmware is modified by adopting this research note.
