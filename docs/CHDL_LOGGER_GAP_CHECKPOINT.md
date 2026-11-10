# CHDL Logger gap — 2026-11-10

Branch: `ui/idle-analyzer-html-integration`. Parent: `0f040a84cdf88b115bbe72d4442de372ac7bb12b`. Manual UI acceptance required; no merge to main.

## Diagnosis

**Two different observations coincided near 6.858 seconds.** The canonical source contains a backward timestamp step at original records 49→50. Separately, raw rendering falsely broke the next interval by inferring cadence from much later, faster samples. Timestamp membership, cached columns and envelope-block selection did not drop the four finite observations. Correcting rendering is necessary; adding a warning alone would not fix the reported behavior.

| Original record (zero based) | Physical record offset | Canonical ms | Raw 16-bit clock | Counter | CRC |
|---|---:|---:|---:|---:|---|
| 47 | 1312273 | 6336.80 | 51565 | 31 | valid |
| 48 | 1319138 | 6582.87 | 10636 | 53 | valid |
| 49 | 1326003 | 6857.53 | 38102 | 75 | valid |
| 50 | 1332868 | 6535.27 | 5876 | 97 | valid |
| 51 | 1339733 | 6947.06 | 47055 | 119 | valid |
| 52 | 1346598 | 7227.09 | 9522 | 141 | valid |
| 53 | 1353463 | 7471.42 | 33955 | 163 | valid |

RPM, MAP, TPS and CLT are finite and CRC-valid on both sides. Around these records RPM is 0, CLT approximately 12.68°C, MAP approximately 102 kPa, and TPS approximately 4.70%. The 6,800–6,900 ms membership query returns original record 49. Direct and block envelope outputs agree. All inspected source rows and values are identical before/after.

The canonical step is **−322.26 ms**. The raw header transition also admits **+333.10 ms with one 655.36 ms clock wrap**. Startup logging is coarse and near the half-modulus ambiguity threshold. This establishes an observed canonical clock discontinuity, **not** a proven physical ECU clock reset, packet loss or missing duration. No timestamps are repaired, clamped, sorted in place or discarded.

The complete recording has 69,566 original records, 10 invalid CRC attempts (nine recovered, one unrecovered), 18 canonical backward steps, eight preceding-cadence spacing outliers, 65 counter discontinuities and 12 duplicate times. Counter jumps and raw wrap candidates are not promoted to loss warnings. No blue channel-unavailable classification is justified for the four finite measurements at the reported interruption.

## Reproduction and correction

Before the correction, raw views `[6000,7500]` and `[6500,7000]` ms marked the **6535.27→6947.06 ms** pair as broken. Full/dense rendering connected that pair. The first interval of the new source run lacked preceding cadence; `hasCadenceGap` looked forward up to 129 intervals, reached later ~13.8 ms sampling and inferred a false gap in coarse startup data.

`core/log-model/time-continuity.ts` now defines preceding, source-run-local cadence only. `core/timeline/viewport-series.ts` uses that rule without future inference. The actual 49→50 source-run boundary remains broken; the valid 50→51 pair is connected consistently. Two independent, generated wire-fixture regressions failed before changes: missing canonical warning and false raw break. No private MLG payload is committed.

## Source and lifecycle ownership

- `core/parsers/mlg/mlg-continuity.ts` projects canonical time evidence once after CRC acceptance. Fallback parser and staged-import finalizer call the same owner; graphs never rescan the source to discover these events.
- Source-index-only processing retains original time, offset, counter, CRC and identity arrays. `TimeQueryIndex.count` provides exact interval membership counts without allocating selected-index lists. This does not authorize interpolation or time-ordered analysis across backward boundaries.
- Sequential source projection uses an incremental bounded 129-interval cadence median matching the renderer's random-access reference. It does not retain full additional source columns.
- Existing Logger owner projects channel availability only from already-loaded, complete MLG channels after CRC validation. It caches channel summaries per source/diagnostic generation, including healthy channels, and does not decode/load channels for this purpose. Source replacement and CRC publication clear that cache; identity checks reject stale publication. It retains summaries, not raw channel ranges. Shared preloaded workspace activation is covered as well as ordinary channel loading.
- Channel NaN runs require multiple CRC-valid nonfinite observations spanning at least 50 ms; boundaries stop at CRC exclusions or backward time. These are informational channel observations, not source-wide corruption. Their span describes observed unavailable values, not an inferred exact transition time.
- Numeric analysis, CRC/retry classification, source record order, timestamp-query membership and the accepted navigation/control layout are preserved. Only trace continuity inference and diagnostic presentation change.

## Presentation

Amber clock/spacing markers, red CRC warnings and blue channel-only availability are distinct. Amber and blue markers never draw a missing-data bridge. Existing red bridge behavior remains. Marker details include observed classification, source-time endpoints, signed step/span, original indices, preceding cadence/reference count, physical offsets where available, related CRC records and overlapping original membership counts.

The same canonical projection supplies graph overlays, overview and Diagnostics. Repeated graph panes do not multiply diagnostic events. Blue graph notices are restricted to panes displaying the affected channel. Overview marks render above trace context and open the same evidence. Graph notices persist until dismissed. Diagnostics snapshots whitelist/freeze provenance fields and do not capture arbitrary source payloads.

Dense markers are clustered by pixel bins and semantic kind (blue groups retain channel identity). Narrow first inspection uses binary lookup and never prepares offscreen markers. Dense full-view preparation builds a weakly cached shared index once; subsequent pan/zoom queries use bounded binary searches and prefix occurrence counts. Clustering does not claim a shared cause; first/last evidence remains available and individual events are exposed when zoomed in.

## Recording reconstruction and evidence

The manifest describes **record-slice ZIPs with identical repeated headers**, not independently valid input recordings. ZIP CRCs, supplied ZIP sizes, member lengths, record ranges and identical headers were verified. Reconstruction retained one 989,618-byte header followed by the numbered non-overlapping slices (24,000 + 24,000 + 21,566 records), each 6,865 bytes. Only the complete result was parsed.

Reconstructed bytes: **478,560,208**. SHA-256: `806ef8db10af7a4014072dd110c03cc5e9cb035f321571427756040d636f17fe`. The upload manifest supplies no original full-file hash: this is a locally computed identity, not an external full-file hash verification.

Evidence directory outside Git: `/workspace/epicscope-chdl-gap/` contains reconstruction checks, original ledger, before/after source/render correlation, failing-before logs, benchmark, browser results and screenshots. Original uploads and recording bytes remain outside the repository. Reproduction script and full-file identity are retained there; generated tests reproduce the transition without private payload.

## Performance and validation

Final measured results and acceptance limitations are appended after validation below. Timings are local execution measurements, not hardware-independent latency guarantees. Serialized diagnostic byte counts are payload estimates, not process heap/RSS measurements.

### Measurements

- Reconstructed recording source projection: **18.38–22.12 ms** over five retained-index runs, with **zero additional source reads**. This is CPU work after indexing, separate from file loading/decoding.
- 320,005-record generated fixtures: **62.66 ms** monotonic, **105.32 ms** with 320 backward runs, **71.55 ms** at 100 ms cadence. Healthy-channel availability scan: **2.85–3.37 ms**. The sequential median correction reduced the measured slow-cadence projection from approximately 1,057 ms while preserving the preceding-window reference exactly.
- 320,005 diagnostic marker groups: initial dense presentation index **53.37 ms**; 1,000 subsequent dense viewport queries **40.17 ms total**, approximately **0.040 ms/query**. Narrow initial selection is separately guarded against scanning >320k offscreen events.
- Added projection working memory is bounded to 129 cadence entries plus the emitted event/diagnostic objects. No additional full numeric channel columns are retained. The shared dense-marker index retains one marker reference and one prefix-count entry per displayable event, grouped by semantic kind/channel, weakly keyed by the immutable projection. These are allocation/payload counts, not measured RSS or a precise V8 heap byte claim. Existing time-query index/permutation is reused.
- Complete-file production import/replay: **4,971 ms staged**, **1,686 ms fallback** in this local run. Cache state and worker validation differ; these figures do not establish that fallback is generally faster. Both accepted all **69,566 records**, retained one unrecovered CRC record, produced identical clicked source evidence and had **zero runtime exceptions**. Screenshot inspection confirmed four traces, amber provenance popup and overview warning marks. Source SHA-256 was rechecked unchanged afterward.

### Validation and manual acceptance

- Failing-before evidence: two new reproductions failed at the parent implementation; logs retained externally.
- Final unit suite: **1,193 tests across 163 files passed**.
- Typecheck and production build: **passed**. Existing large-bundle advisory remains.
- Focused Chromium: **80 checks across 12 groups passed**, staged and fallback; includes blue channel-only graph inspection, post-CRC gating, stale source rejection, canonical clock graph/overview evidence, large-array/marker CPU bounds, accepted hover and trace presentation.
- Final complete Chromium gate: **1,743 checks across 184 result groups passed**, staged and fallback. It covers worker/fallback import, existing CRC/retry behavior, Logger navigation, workspace loading, VE and Idle regressions.
- `git diff --check`: passed.

Manual acceptance: open the CHDL recording, inspect ~6.858 s at full and narrow zoom, pan across the earlier canonical run boundary, click amber graph/overview markers, inspect Diagnostics and confirm the separate red CRC warning. Channel-only information should be checked with an actually unavailable loaded channel; the four finite startup channels must not receive a blue notice for this interruption.

Limitations: the recording cannot distinguish the ambiguous header-clock wrap/reset interpretation. Warnings describe observed canonical evidence, not proven physical failure. Availability notices cover loaded, complete, validated channels only; unopened fields are not read for diagnostics. Availability and spacing spans report observed endpoints, not exact physical missing/transition durations. Dense clusters expose first/last evidence and require zoom for individual coincident events; full Diagnostics retains individual source observations. Native screenshots validate the supplied file in local headless Chromium, not every target browser/hardware configuration. No firmware, ECU writes or other analyzer feature development was undertaken.
