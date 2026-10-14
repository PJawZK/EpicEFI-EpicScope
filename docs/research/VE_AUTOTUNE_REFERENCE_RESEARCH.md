# VE / autotune reference research

## Purpose

This document preserves the cross-tool research that informed EpicScope VE Analyzer behavior. The goal is not to clone another product; it is to extract mature safeguards, known workflow weaknesses and regression ideas.

Primary references:

- MegaLogViewer HD 4.6.14 VE Analyze;
- ECUMaster EMU PRO VE Tuner, current 261.x beta-era behavior/documentation;
- existing EpicScope Fueling Analyzer and AFR-delay analysis.

The most important conclusion is that neither MLV nor EMU PRO provides the complete workflow EpicScope wants. MLV has stronger evidence weighting and prior-authority behavior; EMU PRO has stronger out-of-box qualification controls; EpicScope should combine those strengths and improve delay discovery, provenance and confidence transparency.

---

## MegaLogViewer HD VE Analyze

### Strengths observed

MLV VE Analyze provides:

- table-node spatial weighting rather than naïve rectangular binning;
- current/effective VE awareness at the operating point;
- lambda/AFR delay compensation;
- built-in and custom filtering;
- separate individual-hit and cumulative-evidence thresholds;
- starting-cell prior authority;
- maximum absolute and percentage cell-change safeguards;
- preservation of the original table separate from the analysis result.

The starting-cell prior is especially useful because it makes weak evidence move the tune less than strong repeated evidence rather than applying a fixed correction percentage regardless of evidence strength.

### Weaknesses observed

The main weaknesses are workflow/evidence preparation rather than the core correction arithmetic:

- users must determine suitable lambda-delay values manually;
- record-count delay workflows are fragile across logger rates;
- basic state exclusions still place too much burden on user-created filters/formulas;
- confidence is sophisticated internally but insufficiently explicit in the result UI;
- evidence provenance is weaker than EpicScope's source-index model;
- sparse/unvisited regions are not as clearly separated into measured/interpolated/no-evidence states as EpicScope should provide.

### EpicScope lesson

Keep:

- spatial weighting;
- prior authority;
- cumulative evidence;
- independent correction limits;
- rejection/withholding of out-of-authority proposals.

Improve:

- automatic on-demand lambda-delay discovery;
- timestamp-based delay alignment;
- semantic qualification presets;
- explicit confidence/evidence views;
- direct source-sample navigation.

---

## ECUMaster EMU PRO VE Tuner

### Reference package

Research used the uploaded beta installer:

- `EMU_PRO_Setup_261_3-beta.exe`;
- SHA-256 observed during the investigation: `08949a51b08328362ef27a2a6a47ee4e3b06dad1a20a8e20a4bf505815ce9b57`.

Public ECUMaster documentation/changelog behavior was used where the compressed installer did not expose enough implementation detail safely.

### Confirmed workflow

EMU PRO VE Tuner is log-based. The tuner:

- loads a project/log;
- selects the VE table and lambda source;
- applies qualification conditions;
- rejects transient data;
- waits a configurable recovery period after transients;
- calculates per-cell VE recommendations;
- exposes several result views;
- applies selected corrections explicitly, including 50% or 100% application choices.

### Built-in qualification strengths

Documented controls include:

- RPM range;
- efficiency-load range;
- TPS range;
- minimum coolant temperature;
- minimum samples per cell;
- maximum RPM rate;
- maximum load rate;
- lambda source;
- lambda delay;
- recovery delay;
- full-log or selected-range analysis.

This is stronger out-of-box usability than requiring users to write formulas for basic transient/cold-state exclusions.

### Result views

EMU PRO exposes result views including:

- Proposed VE;
- Measured Lambda;
- Number of Samples;
- Lambda Difference;
- VE Difference.

This validates the idea that a VE tool should expose more than a single corrected table.

EpicScope should go further with views for cumulative weighted evidence, confidence, delay used and exclusion reasons.

### Transient/recovery distinction

EMU PRO explicitly separates:

1. transient detection, such as RPM/load-rate limits;
2. post-transient recovery delay.

This is a valuable distinction. A transient should not merely reject one record and then immediately allow correction again; the operating point should remain ineligible until the configured recovery interval has passed.

EpicScope's existing trailing-window stability approach is even stronger because it avoids brittle adjacent-sample derivative gating at high logger rates.

### Correction-layer awareness

EMU PRO can account for Short Term Trim context and expects the appropriate trim channel to be logged at sufficient rate. Its documentation also advises dealing with learned/long-term trim before VE tuning.

This reinforces an EpicScope requirement: base VE should not be adjusted while pretending STFT/LTFT/total fuel correction do not exist. Correction layers must be visible and, where mathematically safe, accounted for.

### Lambda delay limitation

EMU PRO still expects lambda delay to be configured rather than discovering it from the loaded log automatically. This is the same fundamental user burden seen in MLV.

EpicScope's planned **Grab lambda delays from log** operation is therefore a genuine product improvement rather than a standard feature already solved elsewhere.

### Minimum samples limitation

EMU PRO exposes minimum samples per cell, which is useful but simpler than MLV's weighted-evidence approach.

EpicScope should use both:

- raw/independent observation count;
- cumulative spatial evidence weight;

plus spread/consistency and delay confidence where useful.

### Unvisited areas

EMU PRO documentation tells users to manually blend/equalize unvisited cells after correcting visited areas.

EpicScope should not make interpolated/fill behavior look like measured evidence. Result state should explicitly distinguish:

- Measured;
- Interpolated;
- Weak/observational;
- Withheld;
- No usable evidence.

### Apply authority

EMU PRO offers 50% and 100% application. This is simple and understandable, but it combines two different questions:

- what does the evidence recommend?;
- how much of that recommendation does the user want to apply?

EpicScope should keep these separate. The evidence engine computes a recommendation using confidence/prior authority; the review layer can independently apply 25/50/75/100% or custom authority without changing the evidence result itself.

### Historical bugs worth converting to regression tests

Recent EMU PRO history includes fixes around:

- incorrect/large negative Proposed VE values;
- VE Tuner calculations at table edges;
- external lambda-controller support.

Independent mature tools having table-edge issues reinforces the need for explicit breakpoint, first/last row/column and corner regression tests in EpicScope.

### 4D limitation

Current public support information indicates VE Tuner has limitations around 4D/switched VE tables.

EpicScope's first implementation can remain 2D, but internal evidence structures should not hard-code an assumption that every future tune surface is only RPM x load with no contextual dimension.

---

## Cross-tool comparison

| Capability | MLV | EMU PRO | EpicScope target |
|---|---|---|---|
| Offline log VE analysis | yes | yes | yes |
| Table-aware analysis | yes | yes | yes |
| Spatial/bilinear evidence weighting | confirmed | not required for design decision | yes |
| Minimum sample evidence | weighted/cumulative | count | count + weighted evidence |
| RPM/load transient limits | available/filterable | built in | built-in semantic qualification |
| Post-transient recovery | configurable behavior | built in | built in |
| Coolant/TPS qualification | yes | built in | semantic presets |
| STFT/EGO awareness | yes | yes | yes, with explanation |
| LTFT context | limited/manual workflow | explicit workflow consideration | explicit context |
| Lambda delay | manual/table | manual/configured | auto-derived on demand + editable |
| Delay model | fixed/table | configured delay | single + RPM curve + RPM x load table |
| Confidence | implicit | mostly sample count | explicit |
| Exact source provenance | limited | limited | required |
| Apply strength | prior-like internal authority | 50/100% | separate evidence authority + user apply % |
| Edge-case maturity | mature | active fixes | regression-driven |
| 4D/switched future | limited | currently limited | architecture should not preclude it |

---

## EpicScope qualification modes

A major conclusion from both products is that common exclusions should be predefined rather than requiring formulas.

### Recommended VE Analysis

Default goal: steady-state base-fueling evidence from a warmed engine in normal operation.

Where semantic channels exist, exclude or guard against:

- DFCO;
- other fuel cuts;
- AE-active state;
- decel enrichment/enleanment;
- cold engine state;
- active warm-up enrichment;
- unstable RPM;
- unstable load;
- strong TPS transient;
- invalid/not-ready lambda;
- limiter/protection activity;
- sync/not-running state;
- injector/fuel-pressure limitation when safely detectable.

### Lambda Delay Discovery

This must be a separate preset because delay discovery needs controlled command changes rather than steady-state operation.

Require:

- meaningful final fuel-command/injector-PW change;
- valid mixture response;
- event spacing;
- no hard cut;
- no overlapping strong command change before response;
- contiguous source data;
- valid RPM/load context.

AE/decel events can remain usable when their fueling command is explicit and isolated; they should be shown as context rather than blindly discarded.

---

## Lambda-delay design conclusion

EpicScope should support:

- single-value delay;
- RPM -> delay curve;
- RPM x load delay table, as the primary/full model.

The expensive discovery pass must only run when the user explicitly presses **Grab lambda delays from log**. It should not run on application startup, log load or merely opening VE Analyzer.

Discovery output should retain:

- recommended delay;
- user working delay;
- difference;
- event count;
- spread;
- confidence;
- Measured/Interpolated/Insufficient state;
- source events for inspection.

Recommendations should be cached by log/source identity, scope, channels and analysis settings. Changes mark the recommendation stale; they should not silently trigger another expensive scan.

All alignment should be in time, not integer record offsets.

---

## Correction-authority conclusion

The strongest combined model is:

```text
qualified measurement
  x spatial relevance
  x data quality / consistency
  x delay confidence
  x starting-table prior
  -> evidence recommendation
  -> authority/safety limits
  -> reviewable proposal
  -> independent user apply percentage
```

Out-of-authority proposals should be withheld and explained rather than silently clamped.

The original tune table must remain immutable analysis input until the user explicitly reviews and applies/exports a diff.

---

## What was deliberately not pursued further

The precise internal EMU PRO sample-to-cell assignment algorithm was not considered blocking after the public behavior review because MLV already provided a proven spatial-weighting model and EpicScope had enough evidence to choose a stronger architecture.

Further reverse engineering of EMU PRO should only occur if a concrete EpicScope question cannot be answered from behavior, documentation or existing tests.

## Research status

The VE/autotune comparison is complete enough to support the current `VE_ANALYZER.md` specification and implementation planning.
