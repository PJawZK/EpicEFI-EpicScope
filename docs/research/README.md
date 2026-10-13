# EpicScope research index

This directory preserves external behavioral research that materially informed EpicScope design. It exists so design rationale does not depend on chat history or on access to third-party binaries.

The research policy is:

- treat mature third-party tools as behavioral/stability references, not design authorities;
- do not copy proprietary source or architecture;
- distinguish observed behavior from inference;
- convert useful behavior into EpicScope requirements, regression tests and explicit design decisions;
- prefer EpicScope's evidence-first, source-provenance and semantic-channel architecture when it can improve on the reference behavior.

## Research records

### `MLV_BEHAVIORAL_RESEARCH.md`

MegaLogViewer HD 4.6.14 research covering:

- Histogram / Table Generator weighting, thresholds, persistence and evidence behavior;
- calculated fields / math channels, history semantics, smoothing and dependency resolution;
- Scatter aggregation and evidence navigation;
- compare / playback / alignment behavior;
- MLG reader reliability, corruption recovery and partial-tail behavior;
- VE Analyze safeguards, confidence/prior behavior, delay handling and limitations.

### `VE_AUTOTUNE_REFERENCE_RESEARCH.md`

Cross-tool VE/autotune research comparing MegaLogViewer HD and ECUMaster EMU PRO VE Tuner, with explicit EpicScope design conclusions for qualification, lambda-delay discovery, correction authority, confidence and evidence presentation.

### `MLG_V3_RESEARCH.md`

Bounded MLG v3 compatibility investigation using TunerStudio 3.6.00.06 Beta, MLV 4.6.14 and controlled fixture testing. Records what is confirmed, what remains unresolved and the exact compatibility implications for EpicScope.

## Related product specifications

- `../VE_ANALYZER.md` — EpicScope VE Analyzer behavior contract derived from this research.
- `../FUELING_ANALYZER.md` — current Fueling Analyzer maturity and reusable delay/qualification foundations.

## Research status

The broad MLV investigation is considered complete enough for product work. Future MLV/EMU PRO inspection should be triggered by a concrete EpicScope behavior question, regression or compatibility need rather than open-ended reverse engineering.
