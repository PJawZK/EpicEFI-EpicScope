# VE Analyzer implementation audit against MLV and EMU PRO

Date: 2026-10-14

## Purpose

This audit compares the current EpicScope VE Analyzer implementation with the preserved MegaLogViewer HD VE Analyze and ECUMaster EMU PRO VE Tuner research. Its purpose is to prevent newer evidence/provenance work from accidentally making the tool less accurate, less useful or less familiar to tuners.

The reference behavior remains documented in:

- `docs/research/MLV_VE_ANALYZE_WORKFLOW_PASS.md`;
- `docs/research/VE_AUTOTUNE_REFERENCE_RESEARCH.md`;
- `docs/VE_ANALYZER.md`;
- `docs/VE_ANALYZER_WORKBENCH.md`.

## Preserved or improved behavior

EpicScope currently preserves or improves these mature behaviors:

- two-table VE + target-mixture workbench;
- explicit Run Analysis rather than automatic heavy computation;
- source table/channel identity shown literally;
- tune target table as first-class target authority;
- AFR/Lambda scale awareness without silent relabeling;
- spatial/bilinear VE-node evidence weighting;
- starting-table prior authority;
- cumulative evidence weighting;
- minimum evidence threshold;
- independent absolute and percentage change safeguards;
- out-of-authority recommendations withheld rather than silently clamped;
- original MSQ table remains immutable analysis input;
- explicit STFT/EGO correction source and safe compensation;
- state exclusions for DFCO/fuel cut/AE/decel when semantic channels exist;
- trailing-window stability/recovery rather than adjacent-record derivative gating;
- robust weighted-median correction with P10/P90 spread and confidence;
- timestamp-based AFR/Lambda delay rather than record offsets;
- explicit on-demand delay discovery;
- RPM × load delay model with measured/interpolated/insufficient states;
- sparse delay evidence no longer rendered as globally complete evidence;
- touch/click access to VE proposal detail in addition to mouse hover.

These changes are improvements over important MLV/EMU limitations and should not be removed merely for visual parity.

## Delay-table lifecycle decision

Lambda delay is affected by sensor placement, exhaust transport, operating point, hardware and potentially the circumstances represented by a specific log. EpicScope should therefore support both:

1. **current-log discovery** — evidence derived from the log currently being analyzed;
2. **saved reusable delay table** — a portable working model from a previous well-covered log or deliberate calibration session.

The two must not be conflated.

A saved delay table is a working calibration asset. Loading it in a later session does **not** mean its cells were measured in the current log.

Delay cells must retain separate concepts:

- evidence state: measured / interpolated / insufficient;
- working value;
- working provenance: measured recommendation / interpolated recommendation / user edited;
- table origin: current-log discovery / saved file;
- direct source-event summaries where available.

User edits are valid tuner authority and must be visibly marked as such. They must never be presented as measured evidence.

## Mature behavior still missing or incomplete

The following items remain required before VE Analyzer should be considered mature:

### Quick qualification controls

MLV and EMU PRO make common qualification obvious. EpicScope still needs first-class quick controls for:

- minimum coolant temperature;
- TPS range or equivalent throttle qualification where available;
- custom filter state/expression;
- clearer selected time/start-stop controls in addition to general Scope;
- explicit transient/recovery controls or an equally understandable preset explanation.

### Tuner-facing prior authority

The current raw `Prior weight` input preserves the mathematics but is less approachable than MLV's Cell Change control.

EpicScope should provide a simple tuner-facing authority choice such as Conservative / Normal / Responsive (or similarly clear language) while keeping the numeric prior available under Advanced settings.

The friendly control must map to the same underlying prior model rather than replacing it with a fixed correction percentage.

### Result views

EMU PRO and MLV demonstrate the value of multiple table-coordinate result views. EpicScope should expose switchable views/overlays for at least:

- Proposed VE;
- absolute VE change;
- percent VE change;
- measured mixture / mixture error;
- sample/hit count;
- cumulative evidence weight;
- confidence/spread;
- delay used;
- qualification/exclusion provenance.

The VE table must remain the primary spatial surface rather than moving these results into a separate report.

### Proposal review lifecycle

MLV's selective revert/manual-edit/Accept New Table workflow remains important.

EpicScope still needs:

- proposal-surface cell/range editing;
- revert selected cells to original;
- explicit user apply percentage independent of evidence authority;
- diff-first review;
- export/apply as a separate explicit transition;
- exit/reject without mutating the loaded tune.

No ECU/tune write should be implied by Run Analysis.

### Target-table review/editing

The target mixture table is correctly first-class, but eventual analysis-only target editing/review can be useful. Any such editing must be explicit and must not silently mutate the loaded MSQ.

### Exact evidence navigation

EpicScope's source-index architecture should eventually allow a VE/delay cell to navigate to contributing log evidence. Delay discovery now retains source-event summaries as the first step toward this.

## Accuracy safeguards to preserve

Future VE Analyzer changes must retain these invariants:

1. Actual mixture must be a true AFR/Lambda measurement, never an error/target/correction channel.
2. Source names from ECU/INI/MSQ remain literal presentation identities.
3. Tune target mixture and logged target mixture remain separate authorities/context.
4. AFR/Lambda conversion must never be hidden; explicit units/scale authority are required.
5. Delay alignment is time-based.
6. Insufficient delay coverage must produce unavailable VE evidence, not a global fallback delay.
7. Interpolated delay is not measured delay.
8. User-edited delay is not measured delay.
9. STFT/EGO compensation must use known semantics only.
10. Weak evidence should move VE less through prior authority rather than an arbitrary fixed percentage.
11. Edge/corner table behavior requires regression tests.
12. Original tune values remain immutable until explicit review/apply/export.

## Current direction

The current EpicScope direction remains stronger than either reference tool when all planned pieces are completed:

```text
current-log / saved delay authority
  -> explicit qualification
  -> timestamp alignment
  -> correction-layer compensation
  -> spatial weighted evidence
  -> robust consistency/confidence
  -> starting-table prior
  -> guarded recommendation
  -> reviewable proposal
  -> independent user apply percentage
  -> explicit export/apply
```

The next implementation steps should complete delay provenance/persistence and then return to the missing mature workbench items above rather than adding more hidden estimator complexity.
