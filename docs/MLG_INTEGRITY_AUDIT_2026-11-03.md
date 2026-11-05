# MLG integrity, error classification and marking audit

Development branch: `ui/idle-analyzer-html-integration`, starting at `09ff34f6f6d32ab8b99a54a5b9c739697fccaa4c`. Production `main` fetched/read at `702c880a29baa28b762ac26f7f7ed55ef01239ef`. The relevant MLG parser, source-integrity projection, overlay and bridge implementations were identical between those baselines. Historical handoffs and tail-recovery evidence were reconciled with the actual code, not treated as proof of present behavior.

## Source authority and completion boundary

**The requested original, `2026-11-01_11.57.38.mlg`, is unavailable.** Workspace and temporary-file searches found no matching recording. No ledger or diagnosis of its specific visible gaps is claimed. This is a comprehensive implementation audit and preliminary, independently tested correction checkpoint, with complete source-index/CRC/timestamp auditing of a separately identified available recording. Original-recording acceptance remains blocked until that recording is supplied.

The alternate recording is `2026-10-25_15.20.05.mlg`, **1,102,856,192 bytes**, SHA-256 **`de56d1d03458d2cde755ab903fc34e62f864c8962fe6d0e4d17df8d0c2961a13`**. Its bytes were opened read-only and the complete physical file was hashed. Canonical scanning validates every complete logger payload; all159,022 indexed records, original offsets, raw16-bit timestamps, counters and validity were audited. Complete RPM and MAP columns were inspected. **Other channel values were not exhaustively decoded**, so this does not establish every channel's numerical validity.

No source bytes, timestamps, record indices or CRC validity flags were rewritten. No chronological sorting, dense reindexing, invented samples, missing-record counts, firmware changes, ECU writes, VE logic changes or unrelated Idle features were introduced. There are **no new runtime gap detectors or inferred gap markers**.

## Evidence-backed implementation findings and corrections

### 1. Mixed retry runs incorrectly required a valid final attempt — corrected

At the existing `classifyMlgRetryDiagnostics` owner, recovery required the final record of a same-counter/same-time run to be valid. Independent bytes for **bad → valid → bad** reproduced two unrecovered diagnoses, although the first bad attempt has a later valid replacement. The failing-before regression is preserved externally.

Classification now uses the last valid position in the run: only corrupt attempts **before** it are recovered; corrupt attempts after it remain unrecovered. The final corrupt attempt is not recovered by an earlier valid record. Known retry-counter artifacts still follow the existing classification owner. Every invalid attempt retains its original offset/index and CRC exclusion. This changes diagnostic interpretation, not numerical sample validity.

The October source has no affected mixed-run classification difference: **701 recovered /28 unrecovered** remains unchanged. Worker and fallback agree on the independent mixed fixture, including its trailing corrupt attempt.

### 2. A trailing invalid same-time attempt manufactured a raw trace break — corrected

The raw renderer already preserved bad→valid same-time recovery, but valid→bad→next-time forced a break even though a trusted measurement at that timestamp was already present. Baseline replay on timestamps `[0,10,10,10,20]`, validity `[1,0,1,0,1]` produced valid points `[0,10,20]` with break flags `[true,false,true]`; the corrected flags are `[true,false,false]`. Values and validity remain identical.

This is an **explicit presentation-policy correction**: the previous suffix test encoded the old break rule and was updated after the independent reproducer. A bad attempt remains CRC evidence and can retain its warning icon; it no longer erases an already represented measurement. Earlier unrecovered timestamp groups still break the trace, as retained regressions demonstrate. No interpolation or synthetic measurement is added.

The dotted-bridge lookup likewise now refuses to bridge over a trusted measurement exactly at the diagnostic timestamp. It does not infer that every corrupt attempt means absent data across the neighboring interval.

### 3. Full-log views hid every integrity icon above120 seconds — corrected

The canvas overlay returned before drawing any icon when the visible span exceeded120,000ms. Thus a long recording could contain source errors and Diagnostics entries while its full-log graph displayed no integrity icons. This was intentional old rendering policy, not proof of a clean source or absent errors.

Canonical error icons now remain visible/inspectable at full-log scale. Pixel clustering bounds drawing to approximately one icon per20px per semantic kind. Clusters disclose their diagnostic-group count/time extent and instruct zooming; they are **not** classified as one causal source event. Different semantic kinds are not merged into corruption. Long dotted bridges remain suppressed at wide scale; short-view bridges retain the established bounded lookup. Icons anchor to actual source timestamps instead of a midpoint inferred from neighboring channel values.

### 4. Overview did not receive Logger's integrity projection — corrected

Logger previously sent the canonical projection to graph panes only. The overview received file/user markers and traces, so it could not consistently represent the same CRC evidence.

`publishDiagnostics` now passes the same retained source projection to `TimelineShell.setSourceIntegrity`. Overview marks use the same display clustering, red for confirmed CRC corruption and amber for other existing continuity diagnostics. Source retirement/disposal clears overview evidence. No graph or overview scans source bytes or independently decides integrity.

### 5. Unknown-cause timestamp wording asserted missing data — corrected

The legacy `timestamp-gap` explanation claimed source data was missing. It now describes a recording-time discontinuity with unknown cause and explicitly disclaims packet-loss/exact-count inference. Unknown-cause icons use amber rather than the corruption color. Corruption explanations distinguish untrusted attempts from a proven lost-time duration and include the actual diagnostic text. Text is presentation, not classification authority.

## What makes a visible break disagree with a source marker?

These mechanisms are distinct:

1. CRC exclusion can interrupt usable measurements; a verified same-time sample may preserve useful continuity even while a corrupt attempt remains evidence.
2. `buildRawViewportSeries` uses **viewport-local** positive-spacing median and `max(50ms,5×median)` to break large visible intervals. It does not create a source diagnostic. Changing the viewport can change that heuristic's reference population.
3. Reduced/envelope rendering breaks connections across empty pixel-column distances greater than two pixels. This is a display rule, not evidence of corruption or lost packets. An independent dense/sparse fixture produces reduced-path breaks without canonical corruption or an audit spacing alert.
4. Nonfinite/invalid values can be channel-specific while other channels and payload checksums remain valid. A CRC-valid float-NaN byte fixture verifies that distinction.
5. Previously, the120-second cutoff and the missing overview projection hid existing source markers. Those visibility defects are corrected.
6. Nonmonotonic canonical timestamps can invalidate binary-search assumptions. This remains a separate confirmed concern below.

Consequently, adding a red marker to every broken trace would create false source diagnoses. No per-graph gap detector was promoted into canonical source authority.

## Classification and marker policy

| Classification | Required evidence / limits | Severity and marking policy |
| --- | --- | --- |
| Unrecovered corrupt attempt | Protocol payload checksum mismatch; no subsequent valid same-counter/same-time replacement for this attempt. Header/time corruption is not thereby established. | Existing warning; red source icon and overview mark. Dotted bridge only where trusted measurement coverage is actually interrupted; not a loss-duration claim. |
| Recovered corrupt/retried attempt | A later CRC-valid record in the same counter/time run. Invalid attempts remain retained/excluded. | Info, retained in Diagnostics/ledger. No error-gap icon for the recovered attempt. |
| Confirmed missing record | Independent protocol/session evidence sufficient to prove omission and resolve wrap/retry ambiguity. Elapsed time or an8-bit counter jump alone is insufficient here. | Not automatically claimed by this implementation. Severity/duration require that evidence. |
| Sequence discontinuity | Remaining canonical counter diagnostic after known retry classification.8-bit modulo wrap/repeat ambiguity remains. | Existing warning in Diagnostics and audit ledger; no invented missing count or new gap marker. |
| Recording-time discontinuity, cause unknown | Adjacent canonical timestamps with measured spacing. Offline audit flags an explicitly heuristic outlier against up to129 preceding positive intervals, floor50ms /5×median. | Investigative warning/observation, not corruption or stopped-ECU diagnosis. No new runtime marker from this heuristic. Existing structured timestamp diagnostics get amber presentation. |
| Timestamp regression | Negative canonical time delta, retaining raw timestamp/counter provenance. | Investigative warning in the ledger. Needs source/time-index policy; no silent normalization or fabricated marker range. |
| Rollover or reset candidate | Large raw16-bit decrease to which the scanner applies modulo unwrap. Normal rollover and reset cannot be distinguished from these fields alone. | Informational observation unless stronger evidence contradicts rollover. Expected wraps are not errors or new markers. |
| Duplicate timestamp / retry-like run | Equal timestamps; canonical CRC-valid retry-like pattern where identified. Equal time does not prove byte-identical payloads or duplicate physical recording. | Info with original records retained. No corruption/loss marker solely for duplicates. |
| Channel invalid / unavailable | CRC-valid record but selected channel value is nonfinite, invalid, absent or time/index-misaligned. | Channel-specific evidence; do not label the entire source corrupt or invent a source-wide gap. |
| Presentation-only discontinuity | Valid source evidence and a demonstrated rendering/reduction rule account for the displayed break. | No source-error marker. Correct the presentation only where justified. |
| Unclassified | Incompatible/nonfinite canonical evidence or insufficient provenance. Raw MLG wire timestamps are integer ticks; nonfinite-index tests exercise defensive audit behavior, not a fabricated on-wire NaN timestamp. | Report the limitation and retain evidence; do not select a causal failure name. |
| Physical incomplete tail | Known structural block at EOF is shorter than declared; exact missing bytes are measurable, but no complete indexed record/time exists. | Existing warning retained. Never invent its timestamp or count it as an indexed sample to place a marker. |

Confidence is attached to the observation, not its cause: checksum mismatch, byte offset, equal ticks and negative deltas are directly measured; recovery follows the established counter/time replacement rule; cadence-outlier and wrap/reset interpretations are conditional. No confirmed packet-loss count or stopped-ECU diagnosis is established by this audit.

The format's legacy “CRC” routine is an8-bit **payload checksum**. Counter/timestamp header bytes are outside it. A checksum-valid payload therefore does not independently verify the timestamp header.16-bit ticks wrap every655.36ms; long missing intervals/reset ambiguity cannot be resolved from that low-order clock alone. No exact missing-record number is inferred from elapsed time.

## Canonical pipeline and lifecycle ownership

`MLG bytes → scanMlgRecords → classifyMlgRetryDiagnostics → annotateMlgSourceIntegrityDiagnostics → canonical source/worker result → Logger.publishDiagnostics → sourceIntegrityMarkersFromDiagnostics → graph overlay + overview + Diagnostics`.

- Scanner owns physical block offsets, counters, normalized timestamp index and checksum flags. The mixed/general and fixed paths preserve original record order.
- Retry classification owns recovery and counter-artifact interpretation. Only the per-attempt boundary described above changed.
- The integrity annotator maps classified CRC offsets to original timestamps using bounded binary searches over source offsets. Its sparse >320k-record regression remains healthy.
- Fallback `parseMlg` and staged worker validation feed the same classification/annotation semantics. The worker's indexed phase alone is not final checksum evidence.
- Existing channel sources preserve original indices and invalid attempts; cache/sidecar/storage policies remain unchanged. Real read/decode/index/checksum/sidecar work must not be confused with later cached display projection.
- Logger owns source identity and diagnostic publication. Existing obsolete-source checks remain in place; unrelated Diagnostics UI cannot clear current graph evidence.
- Overview and panes consume one projection, not independently inferred gaps. Pixel grouping is presentation-only and does not rewrite Diagnostics occurrence counts.
- Rendering traverses visible **diagnostic events**, not full source-record arrays for new detection. Narrow event selection uses binary search; dense rendering caps paint/hit targets by pixels. Existing bridge lookup is draw-local and bounded across shared invalid spans. The offline audit is never called from viewport navigation.

Concrete implementation locations:

- `core/parsers/mlg/mlg-records.ts`, `mlg-integrity.ts`, `mlg-parser.ts`, `mlg-channel-data.ts`: bytes, classification, annotation, index and channel queries.
- `apps/web/src/workers/mlg-import.worker.ts`, `apps/web/src/adapters/mlg-staged-import.ts`, `mlg-file-import.ts`: worker/fallback publication and source lifetimes.
- `apps/web/src/pages/logger-page.ts` (`publishDiagnostics`) and `apps/web/src/app/source-integrity-markers.ts`: shared source projection and display clustering.
- `apps/web/src/components/source-integrity-canvas-overlay.ts`, `source-integrity-bridges.ts`, `timeline-shell.ts`: graph/overview presentation and inspection.
- `core/timeline/viewport-series.ts`: raw/reduced continuity and time-search assumptions.
- `core/parsers/mlg/mlg-integrity-audit.ts`, `scripts/audit/mlg-integrity.mjs`: offline correlation, physical provenance and complete selected-column ledger.

No new global event listeners, MutationObservers, ResizeObservers, generic lifecycle wrappers or framework were added. Existing graph/overview render and ownership boundaries were reused.

## Complete alternate-recording findings

The final ledger contains **4,287 correlated observation spans**, including normal clock-wrap observations; this is **not**4,287 failures. Class counts overlap and count observations, not independent causal incidents:

| Observation | Count |
| --- | ---: |
| Complete indexed logger records |159,022|
| CRC-excluded attempts |729|
| Recovered corrupt attempts |701|
| Unrecovered corrupt attempts |28|
| Canonically classified CRC-valid retry-like runs |93|
| Equal adjacent timestamps |797|
| Remaining counter anomalies |30|
| Heuristic spacing outliers |31|
| Negative canonical timestamp transitions |3|
| Raw wrap/reset-candidate transitions |3,467|

RPM and MAP showed no additional channel-invalid observations on CRC-valid records in this inspection. This finding is limited to those two complete columns. No assertion about every other channel follows.

The existing incomplete-tail diagnostic remains at byte1,102,854,995:1,197 bytes available for a6,929-byte standard block,5,732 bytes missing. The incomplete block is not indexed or assigned a fabricated time. Diagnostics summaries/tail evidence remain in `diagnostics.json`; summary-only entries are not extra source failures.

### Confirmed timestamp/index concern — not corrected by this checkpoint

All three regressions have checksum-valid records on both sides and sequential counters:

| Original index | Record byte offset | Previous → current canonical ms | Previous → current raw ticks | Counter |
| --- | ---: | --- | --- | --- |
|40,913|284,477,734|526688.65 →526623.03|44974 →38412|208 →209|
|41,685|289,826,922|539163.64 →538873.50|47289 →18275|212 →213|
|91,924|637,932,953|1274516.17 →1274428.44|51150 →42377|19 →20|

These do not prove ECU reset, logger failure or corrupt headers. They do prove that the canonical time array is not universally nondecreasing. `buildRawViewportSeries`, time slicing and source time-range binary lookups assume monotonic time. Independent reproducer: times `[0,10,20,5,30]`, view `[4,11]` returns `[10]` through the present binary lookup, while a source-order linear membership check finds `[10,5]`. **A valid sample can be omitted in a narrow view.** This remains an explicit unresolved correctness issue, not hidden by new markers.

Correcting it safely requires an original-index-preserving time-query contract at the source/index owner, covering all consumers and resets/wrap ambiguity. Silently sorting records, clamping timestamps or changing analytical time would exceed the verified presentation corrections and could invalidate numerical authority. This deserves its own reviewed source-index stage. It is not claimed to explain the missing November recording's gaps.

## Reproduction, ledger and validation

Run from the repository with dependencies installed:

```sh
node scripts/audit/mlg-integrity.mjs /path/to/recording.mlg /path/to/output RPM MAP
npm run typecheck
npm test -- --maxWorkers=1
npm run build
CHROME_NO_SANDBOX=1 npm run test:browser
```

The CLI opens the source read-only, uses the production parser/checksum/retry path, reads original raw timestamp headers in bounded pages, inspects the selected complete columns and hashes the complete physical file. `ledger.json` includes original-index/offset bounds, first/last/before/after records, raw ticks, counters, checksum validity, cadence context, correlated classes, diagnostic offsets and valid selected measurements inside each event span. `diagnostics.json` preserves the complete canonical diagnostics. Channel names are explicit, and requested names not found are disclosed.

Artifacts are under `/workspace/epicscope-mlg-integrity-audit/`. In particular:

- `alternate-oct25/ledger.json` — complete alternate-file ledger; **not** the November ledger.
- `alternate-oct25/diagnostics.json` — complete canonical diagnostics.
- `raw-retry-before-after.json` — baseline/corrected continuity flags and unchanged validity; nonmonotonic lookup reproducer.
- `/workspace/epicscope-mlg-integrity-audit-mixed-retry-before.log` — failing-before mixed-retry classification regression.
- `browser/summary.json` — targeted staged/fallback checks.
- `real-browser/browser-ab-results.json` and screenshots — actual production replay of the full alternate1.1GB recording.
- `full-browser/summary.json` — final complete gate.

Final validation: **typecheck/production build passed; 1,155 unit tests across160 files; 55 focused browser checks across8 groups; 1,707 full browser checks across178 result groups passed**. Existing bundle-size advisory remains. Final full-source production replay results are retained separately for Worker-enabled and Worker-disabled configurations. Targeted checks include independent CRC failures, ordinary and mixed valid retries, unrecovered spans, duplicate/regressed/wrapped timestamps, heuristic intervals, nonfinite index defense, CRC-valid float NaN, sparse/reduced presentation, overview reset/ownership and >320k continuous samples/bounded lookup. Original timestamp/validity arrays remain authoritative.

Real production replay waits for **graph channel activation**, not merely import completion. Both worker-enabled and Worker-disabled paths loaded159,022 records, retained the tail warning and showed an inspectable full-log CRC cluster plus overview evidence, with no runtime exceptions. Import/graph readiness timing includes different indexing, checksum, sidecar, I/O and decoding work across paths; it is not an optimization benchmark. Worker/fallback status-line wording also differs; retained diagnostic/marker evidence, not wording alone, was compared.

## Ranked remaining work / review stop

1. Obtain the exact November1 recording and produce its complete ledger; correlate its actual gap regions against record/counter/timestamp/channel evidence. This is the blocking verification for the reported gaps.
2. Review the confirmed nonmonotonic time-query defect and establish one source-owned, original-index-preserving query strategy, without silently repairing timestamps.
3. Decide any source-level cadence event policy only with that clock/protocol context. A viewport-local threshold must not become authoritative source corruption detection.
4. Broaden complete channel inspection deliberately using bounded batches; do not decode/store every channel simultaneously or reread a1GB log independently for each role.
5. Manual acceptance at full/zoomed scales, marker inspection, overview seeking and Diagnostics correlation on the user's actual recording/hardware.

Existing checksum/retry retention, cache/storage behavior, typed worker-format-error routing, strict scanner default, explicit usable-prefix recovery and original-index exclusion must **not** be disabled to make plots cleaner. No comprehensive original-recording acceptance, universal responsiveness claim or resolution of all timestamp issues is asserted.

Commit on the existing branch, stop for review; no main merge or automatic follow-on work.
