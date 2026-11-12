# Logger visible-gap / marker reconciliation — 2026-11-10

Branch `ui/idle-analyzer-html-integration`, parent `f3ea5ab8c551db730c539be0470febe823dc791d`. Manual acceptance remains pending; no main merge.

## Confirmed cause at approximately 14.5 s

The previous correction made cadence-threshold observations Diagnostics-only but left the same threshold active in both raw and envelope line-continuity decisions. Consequently a valid 59.98 ms interval was rendered as a shared gap without a marker. That was a renderer/policy inconsistency, not a reason to restore a heuristic warning.

| Original record | Physical byte offset | Header ticks | Counter | Canonical time ms | CRC |
|---|---:|---:|---:|---:|---|
| 408 | 3,790,538 | 18,245 | 200 | 14,523.28 | valid |
| 409 | 3,797,403 | 24,243 | 204 | 14,583.26 | valid |

Both endpoints are finite for RPM, MAP, TPS and CLT. RPM is 0; CLT approximately 12.68°C; TPS approximately 4.79→4.78%; MAP approximately 101.97→101.45 kPa. No original sample lies strictly between these consecutive physical records' canonical timestamps. That spacing and the modulo counter advance of four do **not** establish corrupt or lost measurements. The stored `Time` channel advances approximately 27.016→27.075 s, corroborating an approximately 59 ms interval. It is not used to rewrite the source timeline. Full authority/reconciliation of that channel against header-clock interpretations remains separate work; existing clock ambiguities are not declared solved.

The previous source-local median was 10.56 ms. The renderer's >50 ms and >5× cadence test caused this false shared break. Neither CRC flags, retry replacement, time-range membership, unavailable values nor viewport reduction removed the endpoint samples.

## Complete default-channel reconciliation

The complete original CHDL file was replayed and the full raw point/break sequence inspected for each default channel. Before: **27 non-initial breaks per channel**. After: **19 per channel**, all matched to canonical evidence. The eight removed breaks are the existing threshold-only cadence observations:

| Original pair | Canonical interval ms | Classification / graph policy |
|---|---|---|
| 408→409 | 14,523.28→14,583.26 | Threshold-only; connect valid observations; Diagnostics-only |
| 5,067→5,068 | 71,027.59→71,079.07 | Same |
| 11,933→11,934 | 146,990.94→147,261.38 | Same |
| 11,934→11,935 | 147,261.38→147,486.94 | Same |
| 11,936→11,937 | 147,502.37→147,811.75 | Same |
| 32,375→32,376 | 369,534.30→369,588.61 | Same |
| 63,869→63,870 | 707,372.16→707,451.06 | Same |
| 67,107→67,108 | 742,459.79→742,540.39 | Same |

Connecting recorded neighbors draws a normal plot segment; it does not insert measurements, change sample membership or claim values were measured between them. Raw/dense rendering now agree on this policy.

The remaining boundaries are the **18 canonical backward-time transitions** at original new-run indices 2, 3, 4, 6, 7, 9, 14, 23, 28, 30, 32, 33, 35, 39, 41, 42, 46 and 50; plus **CRC-invalid original record 19**, whose trusted neighbors are 18→20 (2,598.22→3,171.10 ms). Its canonical checksum-warning anchor is 2,889.53 ms. Exact intervals, indices, marker anchors and classification for **every remaining break** are in [the reconciliation ledger](reference/LOGGER_GAP_RECONCILIATION_2026-11-10.json). All 19 matched source evidence; no unmatched default-channel break remains in this full-source inventory.

`Time`, `SD: Present`, `SD: Logging` and `triggerScopeReady` were decoded as four additional recorded channels: each has the same 19 post-correction boundaries. Thus the reported 14.5 s issue was not limited to the four visible fields. This is eight-channel verification, not exhaustive decoding of every catalog field.

## Corrections and explicit marker policy

- **Raw and dense continuity:** the existing viewport-series owner no longer breaks lines solely from cadence thresholds. Actual source validity interruptions, retry replacement rules and original backward-time runs remain authoritative. No query/decoder or numerical calculation change.
- **Clock ambiguity:** graph/overview markers now anchor at the original new-run endpoint, where the trace boundary occurs, rather than the previous run's endpoint. CHDL 49→50 moves its display anchor from 6,857.53 to **6,535.27 ms**, preserving both original source endpoints and the −322.26 ms interpretation in evidence. This is a marker-position correction, not a timestamp repair. The ambiguity affects time interpretation/run ownership even where overlapping flat segments conceal a blank pixel interval; the notice does not assert physical packet loss.
- **CRC exclusions:** retain red source evidence and existing dotted-bridge behavior. Recovered retry artifacts do not create additional breaking warnings or erase a trusted same-time replacement.
- **Channel unavailability:** even a single CRC-eligible nonfinite observation can visibly break a line and now receives an informational blue source explanation. The previous multi-sample/50 ms qualification could leave short visible interruptions unexplained. Original NaNs remain NaNs; CRC-excluded samples do not become blue events.
- **Zoom inside an unavailable interval:** canonical source-marker projection retains the actual event anchor and evidence. A precomputed unavailable-interval summary lets the shared graph/overview selector clip an offscreen marker's *display position* to the viewport edge when its untrusted line interval intersects the view. The notice still reports the original anchor. No new source scan or per-pane detection. Clock markers remain anchored to their exact new-run boundary, rather than broadly displaying wherever an ambiguous interval overlaps other valid histories.
- **Unavailable observation versus line gap:** optional `traceStartMs`/`traceEndMs` describe only the display interruption between neighboring observations. Exact unavailable observations, sample count and measured span stay distinct. A single NaN has observed duration zero; its larger unconnected line interval is not presented as a measured physical unavailable duration. Diagnostics snapshots whitelist these explicit fields.
- **Diagnostics-only:** cadence candidates and unsupported counter-loss inferences do not produce graph icons merely because thresholds/models flag them. Initial viewport points and ordinary clipping boundaries are not source errors.

The same canonical events continue to feed all panes, overview and Diagnostics. Marker details are not inferred from rendered DOM text. Display clipping does not mutate canonical marker arrays or source timestamps. Interval summaries are source-projection-owned, sorted once, use bounds/prefix ends for intersection lookup, and retain summaries rather than channel payload copies. Existing per-pixel clustering remains; no new global listener, observer or lifecycle wrapper.

## Reproduction and verification

Failing-before logs outside Git:

- `unit-before.log`: actual CHDL interval fixture fails its expected connected raw trace.
- `browser-before.log`: real canvas fixture visibly lacks the expected shared segment.
- `anchor-before.log`: clock marker does not coincide with the new-run boundary.
- `interval-before.log`: zoom wholly inside a source-backed untrusted span loses its marker.

Focused regressions cover four-channel raw/dense spacing, retained Diagnostics-only classification, source clock anchoring, isolated/channel-only NaNs, separate measured/display intervals, CRC/retry behavior, narrowed marker selection, existing hover/navigation and worker/fallback imports. Older tests that expected threshold-generated breaks were deliberately updated to the reconciled policy; their source timestamp/checksum assertions remain.

Production CHDL replay loads the complete 69,566-record original in both import modes and navigates to 6.53527 s and 14.55327 s. It verifies inspectable clock evidence at the new-run boundary and no warning popup for the valid 14.5 s interval. Rendered production screenshots were inspected: all four traces connect through the former shared spacing gap. Original source SHA-256 remains `806ef8db10af7a4014072dd110c03cc5e9cb035f321571427756040d636f17fe`.

Full results are recorded below after final validation. Evidence directory: `/workspace/epicscope-gap-reconciliation/`. Numerical source values, validity, indices, source identity, analysis semantics and accepted window/navigation controls remain intact. Idle development stays paused.

## Limits for manual review

This establishes reconciliation for all identified full-source default-channel breaks and the tested viewport/canvas cases, not every possible channel/layout/pixel combination. Header-clock interpretation remains ambiguous; no independent ECU/MLV clock authority is claimed. The stored `Time` channel is a useful follow-up comparison, not silently substituted authority. The checksum-only red/blue distinction remains. Conditional channels can produce more source info events now that isolated nonfinite observations are explained; summaries are cached per source/channel and clustering is preserved, but process heap/RSS for a pathological alternating-NaN recording was not measured. No source recordings, firmware, ECU or tuning computations were changed. Stop for manual acceptance; no main merge.

## Final validation gate

- **1,198 unit tests across 163 files passed**.
- **1,751 complete browser checks across 186 result groups passed**, worker and fallback.
- **88 focused browser checks across 14 groups passed**, including the visible-canvas shared gap reproduction/control cases.
- Typecheck and production build passed; existing bundle-size advisory remains.
- Complete original CHDL production replay passed in both modes, with zero runtime exceptions. Both the 6.53527 s new-run marker and the connected 14.55327 s interval were inspected; screenshots and results retained externally. Local completed-import times were 6,194 ms staged and 1,639 ms fallback under concurrent validation load; not a controlled performance comparison.
- Source SHA-256 rechecked unchanged. Every default-channel post-correction non-initial break has a matching canonical source explanation; no numeric observation or CRC validity was replaced.
- `git diff --check` passed. Existing large-record and bounded-lookup CPU/browser regressions passed. No process-wide heap/RSS claim is made.

Committed locally on the existing development branch; no push or main merge as part of this task. Manual acceptance is pending.

## Later research reference

The [TS-Optim original-reader bridge](TS_OPTIM_MLG_READER_RESEARCH.md) now supplies SHA-pinned static reader behavior. It supersedes the earlier lack of access to independent reader implementation evidence, without claiming an original GUI/runtime replay or changing the historical validation above. Stored `Time` preservation versus header-only canonical time is the next source-authority investigation.
