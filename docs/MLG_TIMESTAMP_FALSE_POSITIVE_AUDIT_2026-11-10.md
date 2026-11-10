# Timestamp, rendering and false-positive audit — 2026-11-10

Development branch `ui/idle-analyzer-html-integration`; audited baseline `186dd1bb1adf4cf33495077a6e218404343b994f`. Latest CHDL presentation is **not manually accepted**. This checkpoint does not establish a definitive clock reconstruction or claim parity with TunerStudio/MLV.

## Evidence and independence limits

All three complete original recordings were reopened read-only. Production framing/index locations and header record lengths supplied the record boundaries. A separate pass reread each four-byte header and payload; it independently extracted big-endian raw clock/counter bytes, summed payload bytes modulo 256 and compared the stored checksum. Therefore checksum arithmetic/raw observations are independently checked, but **format framing and the assumed 0.01 ms tick remain dependent on the current implementation**. No independent specification or executable established their authority. This is not a fully independent format decoder.

Per-event ledgers, including physical offsets, original indices, neighboring raw clock/counter/checksum evidence and alternative times, are committed under [reference/mlg-timestamp-audit-2026-11-10](reference/mlg-timestamp-audit-2026-11-10/SUMMARY.json). Each `.json.gz` decompresses to a complete event-by-event JSON ledger. They contain numerical header/checksum evidence, not source payloads. Baseline diagnostic classifications are preserved in those ledgers rather than silently rewritten to match the correction.

| Recording | Original records | Invalid checksum attempts | Later same-identity recovery / unrecovered | Canonical backward steps | Heuristic spacing candidates |
|---|---:|---:|---:|---:|---:|
| CHDL October 21 | 69,566 | 10 | 9 / 1 | 18 | 8 |
| October 25 | 159,022 | 729 | 701 / 28 | 3 | 31 |
| November 1 | 93,759 | 243 | 240 / 3 | 0 | 6 |

Independent retry accounting used contiguous **raw-clock + counter** groups and a later checksum-valid observation, without relying on canonical timestamp reconstruction. Counts agree with the accepted retry model. This verifies the model's application, not the upstream reason for repeated attempts. Invalid attempts remain excluded, including recovered ones; valid replacements remain available.

Source SHA-256 identities were rechecked:

- CHDL: `806ef8db10af7a4014072dd110c03cc5e9cb035f321571427756040d636f17fe`
- October 25: `de56d1d03458d2cde755ab903fc34e62f864c8962fe6d0e4d17df8d0c2961a13`
- November 1: `4282efddcd4386e5abc94002caa198aba02c76824ce6e71343d79db524867481`

October 25's previously documented incomplete physical tail remains separate from its 159,022 complete indexed records. This audit does not reinterpret incomplete tail bytes as additional complete measurements.

## Clock reconstruction findings

The parser interprets a falling clock as rollover only when its decrease exceeds 32,768 ticks. Both fixed/general scanner paths share that assumption. A smaller fall becomes a canonical regression. The 16-bit clock alone cannot distinguish a backward step from a rollover, nor establish that multiple complete wraps did not occur between records.

| Recording | Current reconstructed final ms | Candidate: every falling raw clock wraps | Difference |
|---|---:|---:|---:|
| CHDL | 769,102.13 | 780,898.61 | +11,796.48 |
| October 25 | 2,272,475.84 | 2,274,441.92 | +1,966.08 |
| November 1 | 1,449,624.35 | 1,449,624.35 | 0 |

These are candidate elapsed extents, **not competing verified physical durations**. Removing canonical regressions by adding wraps is not proof that the resulting timeline is correct.

CHDL backward-step original indices: 2, 3, 4, 6, 7, 9, 14, 23, 28, 30, 32, 33, 35, 39, 41, 42, 46, 50. October 25: 40,913, 41,685, 91,924. Each is covered by a raw-neighbor ledger entry. At CHDL 49→50, raw 38,102→5,876 admits −322.26 ms or +333.10 ms under a single extra wrap. Canonical 6,857.53→6,535.27 ms is retained as an **interpretation with unresolved ambiguity**, not proof of ECU reset or packet loss.

CHDL has 60 modulo advances of 22 and one of 21/23, concentrated in coarse startup logging. This structured pattern is inconsistent with treating each advance as an independently demonstrated random lost-record event. The counter's global writer scope/decimation behavior has not been independently established. The +1 expectation is a parser model, not sufficient evidence for an exact missing-record count. Counter observations remain available, without new graphical loss warnings. Duplicate counters and ordinary 255→0 rollover are separately accounted for.

No TunerStudio/MegaLogViewer executable or independent format specification was found locally. No established-reader comparison was performed. A user request for reader/version and CHDL total duration remains outstanding; even that duration alone cannot establish individual wrap choices. No clock rewrite is justified by this pass.

## Rendering investigation

An independent membership oracle scanned original timestamp arrays for each event neighborhood and compared exact source indices against indexed queries. Complete available RPM/MAP/TPS/CLT columns were decoded, with each event tested within ±100 ms. Direct and block envelopes were compared structurally at widths 20 and 1,300; raw point counts were checked against finite, CRC-eligible original observations.

- CHDL: 380 channel/event cases passed.
- October 25: 6,592 cases passed.
- November 1: 2,028 cases passed.

All **9,000 cases** passed. This checks original measurement membership and envelope equivalence, not the truth of the clock interpretation. It is not exhaustive decoding of every channel or every possible viewport. An apparent initial November discrepancy was JSON property insertion order in the audit harness; structural comparison showed identical data. It was not a rendering defect and did not justify a production change.

Existing raw/dense, duplicate/retry, CRC, source-run, clipping, cache ownership, zoom/pan and worker/fallback regression suites remain applicable and were rerun. Production replay on all three recordings exercised both import modes; October's three documented regression neighborhoods retained accepted hover/navigation behavior. Current CHDL screenshot inspection confirms finite traces and inspectable clock provenance near 6.858 s. No new source/renderer defect was demonstrated in this pass. The previous future-cadence false break remains corrected and covered by its failing-before regression.

## Classification and presentation policy

| Category | Required evidence | Treatment |
|---|---|---|
| Confirmed checksum-invalid payload | Independent stored-versus-computed payload checksum mismatch | Retain red integrity evidence and existing exclusion. Recovery is distinct. A one-byte additive checksum is not proof against every possible corruption. |
| Confirmed source-data discontinuity | Independent framing/truncation or other direct evidence of missing source data | Report exact known evidence; no inferred record count/duration from spacing alone. |
| Rendering defect | Reproducer shows eligible source measurements omitted/misplaced or wrongly broken | Correct the renderer. Do not substitute a warning. No new defect established here. |
| Timestamp irregularity with demonstrated impact | Raw/canonical disagreement or backward interpretation affects source-run/query/calculation boundaries | Preserve original identity and explain the impact and uncertainty. Existing amber clock notices remain pending manual acceptance. |
| Ambiguous timestamp interpretation | Multiple modulo-clock interpretations remain possible | Explicit ambiguity, no silent repair and no physical failure claim. Established-reader/writer evidence still needed. |
| Ordinary recording behavior | Independently established counter/wrap/retry semantics | No error promotion. Structured counter changes remain observations until their writer semantics are verified. |
| Channel-specific unavailable measurements | CRC-eligible nonfinite channel observations, with source-aligned scope | Existing blue channel information; do not promote to source-wide loss. |
| Heuristic cadence outlier | Threshold only: >50 ms and >5× preceding median | **Informational cadence observation in Diagnostics; no graphical source-discontinuity warning solely from this evidence.** |

The confirmed correction is the final row. The baseline promoted all 8/31/6 heuristic candidates to `timestamp-gap`, warning severity and breaking continuity metadata. Some intervals contain other original records (October index 40,912 has seven interior measurements), directly defeating any blanket claim of source-wide absence. Even zero interior records does not prove expected packets were lost or that ordinary sampling variation is erroneous.

The existing source projection now emits `cadence-observation`, `info`, `breaksContinuity:false` for these candidates. Their exact intervals, cadence and provenance remain in Diagnostics. Existing graph/overview owners follow the semantic classification; no icon suppression list, recoloring pass, new detector, listener or observer was introduced. Verified clock/run impact and CRC events are unaffected. Numeric analysis and raw/dense line decisions are unchanged by this policy correction.

A new failing-before regression proves that threshold-only evidence was incorrectly promoted. It now verifies retained diagnostics and absence of an unsupported graphical continuity assertion. This is a diagnostic-policy correction, not a fabricated newly discovered renderer defect.

## Validation and limitations

Validation results are recorded below when the final gates complete. Detailed evidence/harnesses remain in `/workspace/epicscope-independent-timestamp-audit/`. Performance measurements are local and include competing browser workloads; they are not a controlled hardware benchmark. Numerical measurements, canonical source arrays and accepted analysis calculations were not edited. No new full-log pass was added to runtime; the correction changes classification in the existing source projection only.

Manual review must assess both the remaining clock ambiguities and warning presentation. This checkpoint deliberately does **not** declare the half-modulus decoder correct, prove the alternative decoder correct, or assert that all observed spacing/counter changes are healthy. External reader/writer/specification reconciliation remains an open investigation item. No firmware, ECU, tuning or Idle feature changes. No main merge.

### Final gates

- New policy regression failed before the change (`policy-before.log`); final **1,194 unit tests across 163 files passed**.
- Complete browser suite: **1,743 checks across 184 groups passed**, staged worker and fallback.
- Typecheck and production build passed; existing bundle-size advisory remains.
- Production native replay: CHDL 69,566, October 25 159,022 complete records with its pre-existing incomplete tail, November 1 93,759 records, each in worker and fallback modes. No runtime exceptions were reported. CRC counts and accepted October regression-hover checks remained intact. CHDL screenshot was inspected after the classification change.
- Pure source projection on 320,005 samples: monotonic 94.13 ms; 320-run fixture 129.58 ms; slow-cadence 83.77 ms in a concurrent-browser run. Channel availability scan 3.76–4.27 ms. These do not establish a controlled latency improvement/regression. The correction adds no algorithmic pass or full-column allocation; precise process RSS/heap impact was not measured.
- No new numerical result computation was introduced or changed. The 9,000 source/render checks compare actual source membership and reduced channel evidence. Original file hashes match established identities. No external-reader numerical equivalence is claimed.
- Committed reproduction tools and ledgers are under `docs/reference/mlg-timestamp-audit-2026-11-10/`; full validation logs, native replay results/screenshots and benchmarks remain under `/workspace/epicscope-independent-timestamp-audit/`.

The remaining independent-reader/specification reconciliation is an explicit limitation, not a completed verification. Further timestamp reconstruction changes require that evidence and their own failing-before/downstream coverage. Stopped for manual review; no push or main merge.
