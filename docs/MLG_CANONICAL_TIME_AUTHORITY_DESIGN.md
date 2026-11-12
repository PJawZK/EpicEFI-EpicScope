# Canonical MLG time authority — research/design checkpoint, 2026-11-10

Branch `ui/idle-analyzer-html-integration`; research base **`198b82f1d98d08165579a88481f4d1ca01de14da`**. **No runtime changes authorized or made. Stop for design review before implementation.**

## Decision proposed for review

**Prefer trustworthy recorded `Time` as the canonical observation clock, with explicit source-level selection and provenance. Do not implement this as an array substitution.** The three complete supplied files support that direction: the recorded seconds field is finite, progressive and nondecreasing across CRC-eligible records, and matches the original bundled reader's field preference. Header reconstruction introduces 21 backward steps absent from the recorded field.

Adoption is conditional on duplicate-aware calculations, independent CRC/retry identity, staged-import publication, persistence migration and time-policy invalidation. Those are correctness prerequisites, not optional later optimizations. Until that bounded implementation is validated, retain current runtime behavior. No blanket conclusion that a field named Time is always a physical truth source.

Rejected shortcuts: unconditional rollover for every falling/equal raw tick; rounding/deduplicating recorded timestamps; mixing header and recorded values per row; silently retiming saved ranges; using recorded Time to redefine retry identity; displaying one clock while analyses silently use another. An exploratory recorded-Time-guided header refinement also fails three October transitions and is not a safe replacement.

## Evidence and simulation method

Read [the original-reader bridge](TS_OPTIM_MLG_READER_RESEARCH.md) for pinned vendor evidence and its limits. It establishes stored-Time preservation and a distinct synthesized fallback clock, not end-to-end GUI/runtime equivalence.

All three complete original recordings were read through current parser/channel owners, unchanged. Research constructed **new arrays** using `Time_seconds * 1000 − first_CRC_eligible_Time_seconds * 1000`, preserving original source-index positions. Existing source arrays/measurement values/CRC masks were not edited. The model includes raw values at CRC-excluded rows to exercise current APIs, but **selection admission and trusted clock statistics ignore those rows**. It is not a completed implementation of time eligibility on corrupted input.

The harness reads every raw header clock, compares all recorded/header timestamps, reruns the current retry classifier on copies to expose identity risk, invokes existing full-log RPM statistics and Idle discovery, compares numeric-window membership, and invokes current anchored RPM interpolation at a generic 100 ms delay. A strict-positive-time segmentation proxy exposes equal-time sensitivity. No tune, AFR mapping, qualification or delay table was fabricated; **no actual VE proposal or complete PID/recovery outcome is claimed**.

Committed [summary](reference/time-authority-2026-11-10/SUMMARY.json), per-recording reports and [design cases](reference/time-authority-2026-11-10/DESIGN_CASES.json) preserve inputs/settings/results. [Reproduction tool](reference/time-authority-2026-11-10/simulate.mjs) is research-only, outside runtime imports. Header framing and field decoding still use EpicScope; this is a controlled policy simulation, not an independent complete decoder.

## Full-recording comparison

All files contain `Time` as payload field zero: F32, seconds, scale 1, transform 0. No missing/nonfinite/negative Time values were found, including CRC-excluded payload observations. **Finite values in CRC-bad records are still untrusted.** No trusted Time reset was found; these files therefore do not empirically validate missing/reset fallback behavior.

| File | Original records | CRC-excluded observations | Header extent ms | Recorded-time extent ms | Change ms | Trusted backward steps, header → Time |
|---|---:|---:|---:|---:|---:|---:|
| CHDL Oct 21 | 69,566 | 10 | 769,102.13 | 780,886.969745 | +11,784.839745 | 18 → 0 |
| October 25 | 159,022 | 729 | 2,272,475.84 | 2,274,393.066406 | +1,917.226406 | 3 → 0 |
| November 1 | 93,759 | 243 | 1,449,624.35 | 1,449,581.054688 | −43.295312 | 0 → 0 |

CHDL normalization origin is **0.6819999814033508 s**, original index 0; the other origins are zero. The raw Time channel must retain its original absolute values; cursor zero is a documented normalization, not an edit to that channel.

All 18 CHDL backward steps (new-run indices 2,3,4,6,7,9,14,23,28,30,32,33,35,39,41,42,46,50) and October's 40,913 / 41,685 / 91,924 disappear **from the proposed active clock**. Their original raw/header evidence remains; this is a change in authority, not a repair of wire bytes. Header-only clock warnings should become Diagnostics-only when they have no effect on the selected Time clock. CRC/channel-unavailable warnings remain source-backed and need new-clock anchors by original index.

Raw falling-clock counts are 1,191 / 3,470 / 2,211; raw equal-clock counts are 12 / 797 / 248. These include ordinary rollover and retries. Recorded Time is a float seconds field, not a 16-bit modulo clock; it should not be unwrapped by the header rule.

### Duplicates, resolution and retry identity

| File | Equal pairs in CRC-eligible header sequence | Equal pairs in CRC-eligible Time sequence | Existing recovered / unrecovered checksum counts | Retry-like count if naively reclassified with Time |
|---|---:|---:|---|---|
| CHDL | 3 | 13,078 | 9 / 1 | 3 → 1 |
| October 25 | 95 | 28,887 | 701 / 28 | 93 → 74 |
| November 1 | 8 | 15,597 | 240 / 3 | 8 → 4 |

These pair counts are adjacent **trusted observations**, not all physical adjacent rows; raw-header equality counts above include CRC-bad attempts. Repeated stored Time values are common and cannot be treated as retry identity or absent records. The controlled classifier rerun happens not to change recovered/unrecovered counts in these three files, but it changes valid retry-like grouping. That is sufficient to reject redefining source identity by selected-clock equality.

Keep `(original position, raw block type/counter/tick, CRC evidence)` as wire/retry authority. Classify retries before time selection. Do not collapse measurements sharing Time, suppress non-retry duplicates, advance equal ticks by a wrap, or invent tiny positive increments. F32 resolution grows with uptime; a fractional-second clock is not automatically finer than the header clock.

### Quantified calculation and scope changes

Full-log sample-weighted RPM count/min/max/mean/standard deviation are **identical** in all three simulations: measurements and CRC eligibility are unchanged. Time-scoped populations and temporal calculations are not invariant.

| Same numeric window | Header eligible count | Time eligible count | Common original records | Mean RPM before → after |
|---|---:|---:|---:|---:|
| CHDL 500–510 s | 924 | 942 | 0 | 2046.9264 → 1550.4384 |
| October 25 500–510 s | 787 | 788 | 786 | 1200.9682 → 1200.2157 |
| November 1 500–510 s | 645 | 645 | 643 | 2292.5116 → 2292.5147 |

CHDL's old 14–15 s window has 77 eligible observations; the same numeric Time-clock window has three, with **no common indices**. The previously investigated original 408→409 interval moves from 14.52328→14.58326 header seconds to approximately **26.33400→26.39300 normalized recorded seconds**. Saved numeric bounds must not silently acquire a different population.

Current `discoverIdleCandidates`, unchanged settings **0 < RPM ≤1200, minimum duration 8 s, maximum gap 250 ms, qualification off**, gives 8→8 CHDL, **32→30 October**, 3→3 November regions. Even where count matches, some endpoint indices change; complete bounds are in the reports.

Current anchored 100 ms RPM lookup gives valid/missing counts:

- CHDL: 69,520/36 → 69,537/19.
- October: 156,902/1,391 → 156,917/1,376.
- November: 93,063/453 → 93,099/417.

This measures generic lookup availability, including RPM values VE may exclude. It is not a VE quality/proposal improvement claim.

A strict-positive-time segmentation proxy over CRC-eligible RPM observations, resetting on invalid rows, produces 32→13,089 segments (CHDL), 802→29,590 (October), 249→15,838 (November). Maximum segment sample counts fall 17,197→58, 1,387→65 and 1,989→76. This is **not the complete VE segmentation algorithm**; it isolates the equality hazard also present in actual VE/Boost temporal predicates.

An independent small consumer experiment finds `interpolateNumericRangeAtTime` returns unavailable at target 100 ms for times `[100,100,110]`, validity `[0,1,1]`, source anchor 2, even though original record 1 is a valid same-time observation. The current exact-time search chooses the first duplicate, which is excluded. Large duplicate groups require eligibility-aware tie policy, not just a monotonicity fix.

### Exploratory header refinement—not recommended for implementation

A diagnostic model chose the nearest integer wrap count from trusted recorded-Time deltas and raw tick differences. CHDL then has no backward steps and ends near 780,898.61 ms; November is essentially unchanged. October still has unsafe choices at 40,911→40,912 (negative wrap count and step), 41,684→41,685 and 91,923→91,924 (negative steps). The header discrepancy is not universally corrected by choosing another rollover. No clamping/forced wrap repair was applied. Full unsafe-step evidence is retained. This rejects a superficially attractive finer-resolution shortcut, not every possible future clock-fusion design.

## Consumer ownership and impact audit

The [76-file search inventory](reference/time-authority-2026-11-10/time-consumer-files.txt) is a navigation aid, **not a claim of 76 complete behavioral audits**. The following active owners/contracts were inspected. Shared legacy/adapter files remain relevant where active VE wrappers delegate to them.

| Owner/path | Current dependency and required design change |
|---|---|
| `core/parsers/mlg/mlg-records.ts` | Raw framing, header reconstruction and retry identity currently share `recordIndex.timeMs`. Preserve wire/header identity before selecting a canonical clock; do not rerun classification on selected Time. |
| `core/parsers/mlg/mlg-parser.ts`, `mlg-file-import.ts` | Fallback builds time range, data source and persistent wrapper from scanned header times. Add one shared source-level selection result before publishing these owners. |
| `mlg-import.worker.ts`, `mlg-worker-protocol.ts`, `mlg-staged-import.ts`, `mlg-crc.worker.ts` | Index is published with CRC validation disabled, then CRC mask is patched later. Trustworthy-Time selection cannot use that provisional all-valid mask or hot-swap the published time array. Worker/fallback must share the same final admission/normalization. |
| `mlg-channel-data.ts`, `persistent-channel-cache.ts`, `mlg-column-sidecar-v1.ts` | Full/sliced ranges attach retained timestamp arrays; raw columns have separate source/index caches. Keep healthy value storage; rebind new timestamp generations and invalidate only time-dependent metadata. |
| `time-query-index.ts`, `core/timeline/viewport-series.ts` | Weakly cached immutable-array runs/permutations, range covers, nearest/bracket rules, original-neighbor clipping and envelope continuity depend on time. Duplicate groups and time-ineligible rows need explicit semantics. No in-place array patch. Retain existing nonmonotonic query/run safeguards for header fallbacks, reset/ambiguous sources and future formats; three monotonic Time fixtures do not justify deleting them. |
| `logger-page.ts`, `graph-viewport.ts`, `graph-hover-inspection.ts`, `timeline-shell.ts` | Extent, cursor, playback, viewport/history, A/B, marker hits, graph/overview envelopes and full statistics use selected clock/ranges. All panes must receive one atomic source generation; source indices/cursor ties remain deterministic. |
| `source-integrity-markers.ts`, `source-integrity-canvas-overlay.ts`, `source-integrity-bridges.ts`, `mlg-integrity.ts`, `mlg-continuity.ts`, Diagnostics capture | Keep raw clock facts distinct from selected-clock effects; re-anchor CRC/unavailability by original records. Marker blocks may lack payload Time, so retain bounded location uncertainty rather than invent exact timestamps. Header-only regressions are not active-clock graph breaks if Time is selected. |
| `analyzer-page.ts`, `analyzer-scope.ts`, `analyzer-range-interaction.ts` | Current Logger scopes are numeric ms; saved-scope retention compares bounds. Add clock identity to semantic context and scope migration; preserve active-domain routing and no-op context behavior. |
| `ve-analyzer-view` wrappers → active v3/v2 controller ownership; `ve-evidence-map.ts`, `ve-delay-aligned-evidence.ts`, `ve-analysis-work.ts`, `table-cell-evidence.ts` | Delay alignment, positive-time segment boundaries, slope windows, interpolation, visits/evidence/proposal and popup caches depend on time. Audit equal-time qualification/segmentation before adoption; invalidate once on policy change, reject old async completions. `originalObservationTimeMs` means unshifted selected observation time, not necessarily legacy header time. |
| `idle-region-session.ts`, Idle region/qualification/comparison sources and stability plots | Regions use ms plus original indices; session invalidation uses source/revision. Preserve explicit index membership or request legacy review. One selected clock across graph, eligibility, metrics and comparisons. |
| `idle-stability.ts`, `idle-regions.ts`, `idle-recovery.ts`, `idle-recorded-signal.ts`, `idle-valve-tracking.ts`, airflow/ignition/RPM/position PID assessment paths | Sample metrics may stay invariant for fixed indices; duration, sag/recovery, cadence/settling, event matching and duplicate-time alignment may change. Do not promote revised clock resolution into established controller timing. |
| `afr-delay-analyzer.ts`, Boost analyzer/pull detector, Ignition reviews, Fueling/specialized analyzers, `events.ts` | Cross-run restrictions, strict dt, response windows, event merging, durations and percentile populations require clock-policy/duplicate tests. A source switch must not silently remove safety gates. |
| `sample-qualification.ts`, `sample-comparison.ts`, `numeric-range-arithmetic.ts`, `calculated-field.ts`, `range-statistics.ts` | Original-index alignment and exact shared timestamp grids must remain consistent across channels. Same-index scalar math is stable; scoped sample populations or any elapsed-time operation may differ. |
| Histogram/scatter/range search and `scatter-csv-export.ts` | Full-log sample bins can remain stable; scoped bins/event selections and exported time columns change. Include time-policy provenance and keep stored Time distinct from normalized canonical time. |
| `workspace-state.ts`, `workspace-persistence.ts`, `application-workspace-persistence.ts` | Per-log artifact is bound to source ID/display name, not clock policy; saved ranges store ms without persisted IDs/index membership. Reusable application workspace already clears temporal state—healthy behavior to preserve. |
| Shim/live sources and generic timing code | No automatic MLG Time selection here. Preserve live device/host-clock semantics and UI performance timers. Shared query changes require backward-compatible defaults. |

These are code-supported impact paths, not evidence every consumer currently gives a wrong result. No full VE/Idle diagnostic equivalence can be established without representative tune/role/configuration fixtures and native UI validation.

## Proposed authority contract

### Admission and source-wide fallback

1. Identify a unique **raw recorded** Time field using supported MLG schema identity, recognized units and supported numeric encoding/scale. Do not select a calculated/INI-remapped/DOM-labelled role. Ambiguous names/units or unsupported version produce an explicit fallback reason, not a guessed conversion.
2. Validate CRC eligibility and field decoding before admission. On trusted observations require finite values, a usable origin, nondecreasing source-order Time and sufficient progress to resolve duration. Equal times are permitted. Negative/sentinel values, resets, nonfinite trusted values or a constant clock require review/fallback; an insufficiently resolved short recording is not automatically corrupt.
3. Select **one policy for the complete source**, not a per-row mix. First trusted Time observation supplies normalization origin; preserve all source rows, including preceding excluded rows. Retain original stored seconds unmodified. Do not veto otherwise valid Time merely because it disagrees with the header—that disagreement is what this investigation exposes.
4. No Time field: retain the existing header reconstruction as a clearly labelled fallback with its ambiguity/source-run safeguards. Missing/invalid/ambiguous Time: whole-source header fallback plus exact reason and raw Time evidence. Do not heal holes with header values. A genuine clock conflict/reset may make cross-conflict temporal analysis unavailable pending review; sample-only measurements can remain accessible. No smoothing, sorting, clamping, inferred wraps or epsilon increments.
5. No trusted observations/origin: no trusted analysis-time authority. Preserve source evidence and provide an actionable explanation; do not choose a CRC-bad anchor simply to get an extent.

The six [fallback design cases](reference/time-authority-2026-11-10/DESIGN_CASES.json) are specification examples, not an implemented/tested selector. Supplied files contain no naturally missing/nonfinite trusted Time, so fixture coverage is mandatory before rollout.

### Independent identity and provenance

Propose a pure time-resolution result at the existing MLG source-finalization boundary, with `policyVersion`, raw field index/descriptor/unit conversion, normalization origin/index, admission reason, `canonicalTimeMs`, **independent time eligibility**, source record/offset identity and a stable policy fingerprint. Retain `headerTimeMs`, exact raw ticks or read-only access to them, and recorded Time as separate provenance. Changing authority creates a new source-time generation, not a new physical-file identity.

Do not overwrite the scanner's original header vector or cache's stored Time values. Preserve original frame order/indices/offsets/counters/CRC masks. Excluded rows cannot control chosen extent or run detection even if their raw Time is finite. For unusable excluded timestamps, a NaN in a copied time array alone is **not sufficient**: the current query index treats NaNs as run boundaries and rendering can then lose same-time retry recovery. Query/continuity owners need time-eligibility-aware source geometry and explicit retry/gap handling. Raw invalid values remain available in forensic evidence, not silently assigned interpolated canonical time.

CRC diagnostics should be located by source indices on the chosen clock. If record 19's own Time is untrusted, identify its interval between trusted neighbors and label the display anchor as such; do not present a corrupted payload timestamp as trusted. Existing interval markers can display bounded uncertainty. Recorded marker blocks without Time require source-offset association to neighboring recorded-Time observations, with unknown exact position retained. Do not relabel a header timestamp as recorded Time.

### Duplicate-time semantics must precede activation

- Keep all observations and original indices. Cursor/nearest selection requires documented stable ties and an explicit anchor; do not casually change accepted first-index navigation behavior.
- Sample-weighted metrics count distinct original eligible observations, including equal times; equality is not invalidity or a retry criterion.
- Paired channels align by original identity, not a many-to-many join on duplicate timestamps.
- Time-window membership includes every eligible observation at the boundary. Do not deduplicate arrays for binary search.
- Interpolation requires a positive-width **trusted** bracket, documented eligible choices within an equal-time group and source-run/CRC-gap bounds. For backward delay lookup, any tie policy must avoid selecting a future original observation beyond its anchor. If a unique justified value cannot be selected, return unavailable with evidence rather than average silently.
- Derivatives, response windows and recovery must distinguish zero dt from backward time. A same-time group cannot supply a derivative, but should not automatically destroy an otherwise valid multi-time history. Grouped representations may be derived calculation views only, with explicit weight/representative policy and mapping back to all source observations. Selection of a representative is an analysis decision requiring reference cases, not a source edit.
- Requalification of VE evidence from this policy must be numerically explained. Do not silently change analytical formulas or allow previously unsafe cross-CRC interpolation.

### Worker lifecycle, publication and cache ownership

Current staged import publishes `indexed` data sources/extent before final CRC. A safe design must prepare/validate the candidate clock within existing worker/fallback ownership and **commit one immutable source-time result before authoritative Logger/Analyzer publication**. An unvalidated preview could remain explicitly loading/non-authoritative, but must not publish header-based analysis and then mutate it to Time in place.

Reuse existing scan/capture/CRC passes to decode the selected field; avoid a new full-log channel read after import and avoid repeated scans on navigation. Fixed-record capture hooks and general-parser record callbacks need parity. If this requires delaying indexed publication until CRC/time selection, make the latency tradeoff explicit and measured; keep previous valid source usable during replacement. Preserve cancellation/progress and reject superseded completions at existing import owners.

Use one shared selection/normalization implementation for worker and fallback. Do not patch `timeMs.set(...)` after publication: `TimeQueryIndex` caches by immutable-array identity, and existing data-source/cache objects retain timestamp references. Construct new time-dependent owners for a new generation; reuse physical Blob pages and raw scalar-column storage where valid.

Decoded value caches keyed by source/channel/count are generally healthy and need not be purged when only time authority changes. **Time-bearing envelopes** (first/min/max/last time arrays), ranges, statistics by scope, event/VE evidence, graph break metadata and cached query indexes must include the policy fingerprint or be rebuilt. Sidecar scalar stripes can remain reusable if their raw source/field/schema identity matches; do not assume every priority-column/envelope artifact is time-independent.

Worst-case retained clock payload planning at 320k rows: header vector ~2.56 MB, canonical vector ~2.56 MB, optional retained raw-Time column ~2.56 MB; optional raw U16 ticks ~0.64 MB. Relative to a single existing header vector, budget up to ~5.76 MB extra payload plus query/metadata/worker copies. These are array-size estimates, not measured heap/RSS. Transfer/clone peaks, CRC staging and captured columns require measurement. Store a shared canonical vector, not a copy per channel or pane.

### Persistence and state migration

Version the per-log time-policy contract separately from raw file identity and reusable layouts. Current source ID (filename/size/lastModified in fallback) is not sufficient to distinguish clock generations. Do not reuse old numeric A/B, saved ranges, markers, view histories, cursors or Idle/comparison sessions under a different policy merely because the source ID matches.

Legacy artifacts lack original membership/clock metadata. Keep a recoverable original; label legacy header-time state. Where the old header clock and source indices remain available, map the **exact selected original-index spans**, then derive new presentation bounds. A single min/max envelope can include extra records when original histories overlapped. If the UI cannot represent the original disjoint membership, request review/reset only temporal state rather than silently expanding scope. Preserve channel choices, layout, tune and user edits. Do not globally erase workspace storage; reusable application state already strips source-specific time fields.

New ranges/markers should carry original index/offset anchors or membership spans, clock fingerprint and boundary-tie semantics. Missing persisted range IDs also needs conservative matching; numeric bounds alone are not semantic identity after a time change.

Publish a real time-source revision once through Logger/Analyzer context. Active domain refreshes; hidden domains defer. Cancel/reject stale analysis/popups/recommendations and derived proposals based on the older time basis. Preserve original tune and working edits separately; do not rescale manual delay tables or delete user VE edits to retime the log. Old evidence/proposals must not remain authoritative for new-clock calculations. Unchanged policy/context remains a no-op through navigation.

## Proposed bounded implementation sequence (not started)

1. **Review this authority/tie/fallback contract.** Decide policy identity, clock eligibility and duplicate-aware analysis rules; no reader emulation by assumption.
2. **Wire evidence and retry separation.** Preserve raw/header identity, add independent clock provenance/admission result and research fixtures; current runtime still default until parity gates pass.
3. **Duplicate/time-eligibility consumers.** Query/bracket, raw/dense continuity and critical VE/Idle temporal paths receive reference cases before the new policy can become active.
4. **Atomic import integration.** Worker/fallback share selection, source finalization, progress and stale-completion guards; one canonical vector for all channels.
5. **Persistence/context migration.** Version/anchor scopes; prevent legacy numeric-state reuse; preserve layouts/tunes/working edits; invalidate dependent results once.
6. **Diagnostics/export/UI acceptance.** Expose authority/origin/confidence, keep raw evidence, re-anchor source events and qualify exports; no unrelated UI redesign.
7. **Full numerical/browser/large-log validation, then manual acceptance.** No main merge or default activation from a passing structural/unit gate alone.

## Required implementation validation

- Wire fixtures for absent Time, valid F32/F64/integer/unit conversions actually supported, unknown/ambiguous metadata, duplicate names, all-constant short logs, trusted NaN/Inf/sentinel/reset, no trusted origin and large uptime quantization. Corrupted CRC-bad Time must not veto/steer authority or create artificial extent/run changes.
- Original raw/header timestamps, values, records, offsets, CRC masks and retry counts preserved byte/array-for-byte; every original measurement remains addressable. Duplicate groups and origin excluded-prefix cases included.
- Natural rollovers, small falls, exact half-modulus, equal raw ticks, multiple plausible wraps, marker/data interleaving and partial tails. No forced monotonic repair.
- Exact-time queries with valid/invalid duplicate members, source anchors, inclusive range boundaries and disjoint legacy membership. Compare indexed queries to original-index oracle; large-record queries cannot rescan full arrays per pan/analysis.
- Actual VE qualification/delay/slope/evidence/proposals with representative tune/role/settings inputs. Explain all changed outputs; sample-only full-log invariants; same-index versus same-numeric-time scopes compared separately. This study did not calculate full proposals.
- Idle qualification/discovery, stability, recovery and controller assessments; Boost/AFR/Ignition/Fueling/event durations; no false dt division/reset or invented control-cadence confidence from a coarse clock.
- All supported Logger layouts: raw/dense/block envelopes, hover/ties, markers/overview, zoom/pan/clipping, A/B, playback, saved-range restore and source replacement. Recorded Time and normalized cursor must be distinguishable.
- Worker/fallback and sidecar enabled/disabled parity, cancellation, stale completion, unvalidated preview boundaries, cache/INI reload, navigation/hidden views, context no-op behavior and tune/edit retention.
- Full unit/browser/typecheck/build gates and real Chromium replay on all three originals, plus a >320k fixture. Measure import/CRC/ready latency, extra physical reads, main-thread work, clock/query/envelope memory and worker-copy peaks. Manual review before implementation rollout/merge.

## Research validation and remaining limits

Simulation completed across **322,347 original records**. Report JSON and script syntax were checked; source data were opened read-only; source/CRC arrays were copied where classification experiments required a variant. Missing/invalid trusted Time cases are design fixtures/examples, not observed in these logs or an implemented selector. Full physical clock truth and end-to-end vendor GUI equivalence remain unproven. Full VE/PID numerical validation is explicitly deferred until implementation fixtures/configurations exist.

This is research/design only. No application build/browser rerun is claimed for unchanged runtime code. Documentation, research evidence and reproducible offline tooling are the only repository changes. Stop for review before implementation.
