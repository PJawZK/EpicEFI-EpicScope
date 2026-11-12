# November 1 Hybrid-channel availability investigation

2026-11-03. Continuation from local checkpoint `8574f85f1eca22090886d2334046044501a32257`, on `ui/idle-analyzer-html-integration`. See [original recording reconstruction and source-wide audit](MLG_NOV01_RECORDING_AUDIT.md).

**Finding:** six stored F32 channels have exactly identical unavailable observations. Their NaNs coincide perfectly with the recorded Hybrid validity and PID-cache-valid flags being zero. During those observations the recorded selected and candidate corrections equal the finite legacy correction. This supports controller fallback/invalidation as the explanation; it is not evidence of EpicScope manufacturing NaNs. Matching firmware source/reason enums are still needed to prove the upstream branch and exact reason meanings.

**Correction:** reproduced and fixed the fallback import's missing CRC count in its title/status. No parsing, numerical analysis, source/CRC validity, retry rules, marker semantics, graphs or ECU behavior changed. Channel-availability UI is evaluated below, not installed in this pass. Stop for review; no main merge.

## 1. Exact channels, indices and counts

Original file: `2026-11-01_11.57.38.mlg`, 655,524,361 bytes, SHA-256 `4282efddcd4386e5abc94002caa198aba02c76824ce6e71343d79db524867481`. Source hash rechecked after investigation. The transport reconstruction was already verified at the previous checkpoint; no segment was parsed here.

All original record indices and MLG field IDs below are zero-based. Each channel has 93,759 indexed attempts: **93,516 checksum-valid records**, including **4,535 finite measurements** and **88,981 recorded quiet NaNs**; 243 additional attempts are excluded by canonical CRC validity. Thus numerical consumers have **89,224 unusable measurements per channel** (NaNs plus CRC exclusions). Do not label all 89,224 as CRC errors or classify untrusted attempts by their payload values.

| Recorded field ID | Exact recorded name | Finite, CRC-valid | NaN, CRC-valid | CRC-excluded | First NaN byte offset in dominant run |
| --- | --- | ---: | ---: | ---: | ---: |
| `mlg:2297` | Hybrid: Motor only TPS | 4,535 | 88,981 | 243 | 38,549,670 |
| `mlg:2298` | Hybrid: Extra TPS beyond stop | 4,535 | 88,981 | 243 | 38,549,674 |
| `mlg:2299` | Hybrid: Fade factor | 4,535 | 88,981 | 243 | 38,549,678 |
| `mlg:2300` | Hybrid: PID raw | 4,535 | 88,981 | 243 | 38,549,682 |
| `mlg:2301` | Hybrid: PID after gain | 4,535 | 88,981 | 243 | 38,549,686 |
| `mlg:2306` | Hybrid: DC safe ceiling | 4,535 | 88,981 | 243 | 38,549,706 |

For each of the six, the first unavailable observation in the whole recording is index **0 at 0.00 ms** and the last is index **93,758 at 1,449,624.35 ms**. Availability returns between the runs; that whole extent must not be called one continuous unavailable interval.

All six share these seven runs:

| Original record indices (inclusive) | First–last unavailable time (ms) | Observed span (ms) | Indexed attempts in span | CRC-valid NaNs | CRC-excluded attempts inside span |
| --- | --- | ---: | ---: | ---: | ---: |
| 0–656 | 0.00–9131.09 | 9131.09 | 657 | 653 | 4 |
| 1,916–1,916 | 28754.72–28754.72 | 0.00 | 1 | 1 | 0 |
| 1,920–1,922 | 28805.46–28831.30 | 25.84 | 3 | 3 | 0 |
| 3,769–3,793 | 57551.76–57873.65 | 321.89 | 25 | 25 | 0 |
| 4,068–5,121 | 62149.15–79106.32 | 16957.17 | 1,054 | 1,053 | 1 |
| 5,379–92,560 | 83623.95–1431168.19 | 1347544.24 | 87,182 | 86,957 | 225 |
| 93,470–93,758 | 1445175.07–1449624.35 | 4449.28 | 289 | 289 | 0 |

The dominant run is **83.62395–1,431.16819 seconds**, observed span **1,347,544.24 ms = 22 min 27.54424 s**, indices **5,379–92,560**. It contains 86,957 valid-checksum NaNs and 225 CRC-excluded attempts; **no trusted finite value** in any of the six channels. Previous finite record: index 5,378 at 83,599.82 ms. Next finite record: index 92,561 at 1,431,181.32 ms.

“Observed span” is last unavailable sample time minus first unavailable sample time, not a reconstructed acquisition-loss duration. A single-sample run has zero observed span but is still one unavailable measurement. Runs ignore CRC-excluded attempts when finding the next trusted finite observation, and count those excluded attempts separately; no value availability is asserted inside untrusted payloads. EOF leaves the final run open. The seven observed spans sum to 1,378,429.51 ms, which must not be presented as exact lost time.

## 2. Identical intervals, not independent failures

Compared each channel's finite/nonfinite mask against `Hybrid: Motor only TPS` at **every checksum-valid source index**: zero disagreements in all six channels. This establishes identical masks across all seven runs, rather than just overlap or similar endpoints. Their finite numerical values differ; mask equality is not evidence they are duplicate signals.

The six first raw field offsets in the dominant run are listed above. A separate bounded raw-payload pass checked **every one of the 533,886 CRC-valid nonfinite values** (88,981 × six). Every stored F32 bit pattern is **`7fc00000`**. Production full-column decoding agrees exactly. Payload fields have scale 1 and transform 0. Canonical shared CRC validity remains intact.

## 3. Controller-state correlation

Read the six Hybrid channels, the complete adjacent Hybrid telemetry block, relevant Idle/ETB state fields and Engine signals from the original MLG through the production parser. The external harness records full-record contingency counts, per-run state transitions and original-index neighborhoods around every entry/exit. No rendered text supplied semantic evidence.

Across all checksum-valid records:

| Logged state | During 88,981 NaN observations | During 4,535 finite observations |
| --- | --- | --- |
| Hybrid: Mode | 2 in all | 2 in all |
| Hybrid: Validity | **0 in all** | **1 in all** |
| Hybrid: PID cache valid | **0 in all** | **1 in all** |
| Hybrid: ACTIVE eligible | 0 in all | 1 in 4,413; 0 in 122 |
| Hybrid: Authority limited | 1 in all | 0 in 4,413; 1 in 122 |
| Hybrid: PID raw held | 0 in all | 0 in 3,811; 1 in 724 |
| Idle: Closed loop active | 0 in 88,919; 1 in 62 | 1 in all |
| DC idle valve local fault code | 0 in all | 0 in all |
| etb1etbErrorCode / etb1state | 0 / 3 in all | 0 / 3 in all |

The `ACTIVE eligible` flag is **not** interchangeable with measurement availability: 122 finite observations have ACTIVE eligibility zero. Likewise, closed-loop idle being active does not guarantee finite Hybrid measurements (62 counterexamples). Do not use either flag alone to synthesize or suppress data.

During all **88,981** NaN observations, `Hybrid: Legacy correction`, `Hybrid: Candidate correction` and `Hybrid: Selected correction` remain finite, with candidate = selected = legacy **exactly** in the stored values. Physical TPS and measured DC position also remain finite. This is strong evidence of a fallback/invalidation state confined to particular Hybrid outputs, not source-wide corruption or loss of all controller telemetry.

Fallback reason distributions are numeric observations, not decoded causal enums:

- With NaNs: reason 9 → 88,920 records; 17 → 46; 10 → 11; 4 → two; 5 → two.
- With finite values: reason 1 → 4,413 records; reason 15 → 122.

### Dominant run transitions

| Original index | Source time (ms) | Recorded transition/evidence |
| ---: | ---: | --- |
| 5,378 | 83,599.82 | All six finite; reason 1; validity/cache/ACTIVE eligible = 1; closed-loop idle = 1; RPM 1,043; TPS≈6.01% |
| **5,379** | **83,623.95** | All six become NaN; reason 17; validity/cache/ACTIVE eligible = 0; closed-loop idle remains 1; RPM 1,043; TPS≈6.68% |
| 5,384 | 83,701.70 | Reason changes 17→10; six values remain NaN |
| 5,394 | 83,860.40 | Reason changes 10→9; closed-loop idle changes 1→0 |
| 92,560 | 1,431,168.19 | Still NaN; reason 9; validity/cache/ACTIVE eligible = 0; closed-loop idle = 0; RPM 934 |
| **92,561** | **1,431,181.32** | All six become finite; reason 1; validity/cache/ACTIVE eligible = 1; closed-loop idle = 1; RPM 934 |

Within this run: reason 17 for five valid records, reason 10 for ten, reason 9 for 86,942. The short NaN excursions around 28.75/28.81 seconds have reason 4 / reasons 4–5; the 57.55-second excursion has reason 17. The 62.15-second excursion starts at reason 17 and ends at reason 9 before finite recovery at index 5,122. The final EOF run starts when RPM drops from 504 to zero at index 93,470; closed-loop idle changes on the next record. Concurrent logged fields are observations, not proof of atomic firmware updates or timing causation.

## 4. INI / firmware authority and confirmed origin

Available supplied `mainController.ini` SHA-256: `9a538ff308678fa841e079947ed91908dd68d4824e4592a57440aeb7af7b414a`. Its declared signature is **`rusEFI .2026.10.20.MEGA144H7.3481109810`**. This is the previously supplied INI; it is **not verified as the exact firmware/INI pair used for November 1**. No matching firmware implementation/reason enum is present in this EpicScope checkout. Do not pull an unrelated/current firmware revision and treat it as the recording's authority.

Production INI parsing identifies all 20 `hybrid*` outputs as stored scalar telemetry, not expressions. Relevant declarations (INI lines 12203–12222 and datalog mappings 18448–18467):

| MLG field | INI output key | INI payload type / offset |
| --- | --- | --- |
| Motor only TPS | `hybridExpectedTps` | F32 / 3956 |
| Extra TPS beyond stop | `hybridExtraTps` | F32 / 3960 |
| Fade factor | `hybridFade` | F32 / 3964 |
| PID raw | `hybridRawPid` | F32 / 3968 |
| PID after gain | `hybridAfterGain` | F32 / 3972 |
| DC safe ceiling | `hybridAbsoluteLimit` | F32 / 3992 |

INI output offsets refer to its telemetry structure, **not byte offsets in the MLG**. Its Motor-only label includes a hyphen; the exact recorded MLG label does not. Use the recording's field descriptors as log authority.

The INI's configuration field `hybridDcIdle_mode` lists OFF/OBSERVE/ACTIVE/INVALID, and its help describes validity/safety gates, fallback to legacy and no calibration extrapolation (lines 6117–6126, 9538–9547). These descriptions are consistent with the recording, but do not prove runtime mode-enum identity or numeric reason-code meanings. The INI defines `hybridReason` as U08, without an enum. No exact November tune/calibration or firmware branch has been verified.

**Confirmed:** NaNs are stored in checksum-valid MLG field bytes before EpicScope decoding or derived-channel computation. They are reproduced by raw F32 reads, canonical columns and both browser import paths. No INI expression or Histogram Math calculation is required to produce them.

**Strongly supported, not implementation-proven:** upstream controller/logger emission of an intentional unavailable sentinel during Hybrid invalidation/fallback, given quiet NaN bit identity, zero validity/cache flags and selected=legacy. The evidence does not distinguish firmware deliberately writing NaN, propagating an upstream invalid input, or a logging/telemetry producer substituting that sentinel. It does not identify the exact firmware branch responsible for reason 17/10/9 or establish a firmware defect. Needed to close that question: the exact November firmware commit/generated reason enum and matching tune/INI, not another speculative parser correction.

## 5. Consistency across validity, graphs, analyses and Diagnostics

| Layer / owner | Tested result | Limit / implication |
| --- | --- | --- |
| `mlg-channel-data.ts` canonical range | Shared `validity` is CRC validity: 93,516 ones / 243 zeros; 88,981 of those ones contain NaN | Mask alone is insufficient for usable measurement validity. Preserve it; consumers also check finite value. MLG does not attach a richer per-sample `quality` here. |
| `viewport-series.ts` raw/envelope/block summary | All six skip NaNs; full envelope reports 4,535 valid / 89,224 invalid. Direct and block results match six/six | No zero fill or artificial long connection. At full scale each has three envelope segments; seven source runs do not imply seven pixel-visible breaks. |
| Logger `nearestNumericSample` / corner readouts | Native finite→dash→finite at 20 s, 500 s and 1,432 s for all six, worker/fallback | Nearest invalid/nonfinite sample does not skip to a healthier distant value. RPM remains finite at all tested cursors. |
| Range Statistics | All six: valid 4,535 / invalid 89,224; finite-only statistics | Combines CRC exclusions and nonfinite values in its invalid total; not a CRC count. |
| Histogram numeric distribution | All six: valid/binned 4,535 / invalid 89,224 / unavailable 0 | Here “unavailable” means an out-of-range requested source index; recorded NaN is currently counted as invalid. |
| Generic numeric aggregation | Independent parser fixture confirms nonfinite and CRC exclusions omitted, finite mean/count retained | Focused shared-consumer validation, not a claim that every specialized Analyzer mode was exercised with these channels. |
| Parser Diagnostics / source markers | 240 recovered attempts, three unrecovered CRC attempts, five counter anomalies, eight valid retry-like runs; no Hybrid/NaN parser diagnostic appears when assigning channels | Parser/source-integrity scope is consistent. It lacks a per-channel availability explanation; it must not turn these NaNs into corruption or source-wide loss. |

Diagnostics' grouped unresolved source events are **five**, while the unresolved diagnostics indicator has **eight entries** (three CRC plus five counter diagnostics). That grouping is already intentional and differs from “three unrecovered CRC records.” No count was rewritten to make unrelated categories match.

The raw compatibility-mask naming/comment can invite mistakes if new consumers assume a one means finite. Existing tested consumers check finiteness. This pass does not change global validity, optional quality semantics or count terminology, which would affect architecture beyond the proven status correction.

## 6. Channel-specific indication evaluation (not implemented)

A small per-channel explanation is justified; a global parser warning or red source-loss marker is not. Recommended next bounded implementation:

1. Use the existing source/channel decoding owner to retain a compact availability summary **when that channel is already read**, keyed by source identity and channel ID. Do not eagerly load all 2,556 fields, rescan full logs on navigation, or duplicate work per graph/Analyzer. If worker/sidecar paths supply summaries, make their ownership/CRC-finalization lifecycle explicit first.
2. Keep separate counts for trusted finite values, recorded nonfinite values and CRC-excluded attempts. Call the NaN category **recorded value unavailable / nonfinite**, never “CRC error” or “missing packets.” Preserve the actual observed interval endpoints and original indices; cap/coalesce stored presentation spans without losing aggregate counts.
3. Present a quiet channel-row/readout indication, with details on demand. Example: “Recorded value unavailable · 88,981 checksum-valid samples · longest observed span 22:27.544.” Explicitly distinguish whole-source integrity and avoid a persistent global alert/banner for normal controller inactivity.
4. Explain that counts cover the loaded/analysed source range; a viewport summary must not masquerade as full-log coverage. Keep finite data, min/max and the other channels usable. In the long gap, do not display stale/zero values or fabricate continuity.
5. Do not infer a firmware reason from the Hybrid state fields globally: the availability mechanism should work for any recorded channel, while optional controller-specific explanation needs a verified schema. Choose a “prolonged” threshold/notice policy during review; one threshold is not established by this recording alone.

Acceptance should cover source replacement, CRC validation completing after an indexed read, worker/fallback and sidecar/chunk parity, bounded memory, partial ranges, all-NaN channels, single-sample excursions, recovery and hidden/inactive views. No new observer, document listener or generic instrumentation is needed. **This proposal is not deployed by the present checkpoint.**

## 7. Reproduced fallback status discrepancy and correction

Before the correction, a new actual-shell browser assertion passed staged imports and **failed fallback imports**: a file with one unrecovered CRC attempt had issue state and correct source diagnostics, but its title/parser/Ready text omitted the CRC count. Baseline production replay had already demonstrated the same omission on the original file's three unrecovered attempts.

Ownership was duplicated in `apps/web/src/app/app-shell.ts`: fallback `recordFullLoad` used generic Ready/record-count wording, while staged validation completion constructed CRC status. Both have fully computed canonical diagnostics at that point. No intentional reason to suppress fallback integrity counts was found; the separate staged **validating** state remains valid and unchanged.

Added one local `setValidatedMlgLoadStatus` helper at that existing owner and routed both completed-import branches through it. Counts only `mlg-crc-mismatch`; recovered attempts remain excluded from the unrecovered count. Warning/issue state, incomplete-tail wording and existing source validity are preserved. Zero-unrecovered files show `CRC validated`; recovered-only imports do not claim source loss. This does not introduce another lifecycle wrapper or an extra full-log pass: it only formats the existing diagnostic list at import completion.

The real original now displays `CRC checked · 3 unrecovered CRC records` and `Ready · 3 unrecovered CRC records` in both production paths. New browser assertions also cover one-unrecovered and recovered-only imports, incomplete-tail retention and existing infrastructure fallback.

## 8. Validation, evidence and review boundary

- Complete original-file checksum-valid mask/state comparison completed; all 533,886 nonfinite Hybrid field values verified against stored F32 bits. Input MLG hash unchanged after investigation.
- **1,158 unit tests passed in 161 files.** Extended the independent parser fixture to cross-check Range Statistics, generic aggregation, Histogram, direct/block envelopes and unchanged CRC exclusions for channel-only NaNs plus independent corruption.
- **1,711 full browser checks passed.** Includes the new completed-import status and recovered-only assertions in both modes, alongside the existing application regression gate.
- **59 focused integrity browser checks passed in eight groups** after a recorded failing-before/passing-after fallback reproduction.
- **Production build/typecheck passed**, with the existing large-bundle advisory.
- Native production replay of the complete original in worker and fallback: six Hybrid channels exercised in two four-channel batches within the eight-channel pane limit, at finite (20 s), unavailable (500 s) and resumed (1,432 s) cursors. Twelve batch/cursor cases; zero captured runtime exceptions. Saved screenshots inspected; Engine traces/readouts remain valid during channel-only gaps.
- `git diff --check` passed. This is a local branch checkpoint; manual user acceptance remains separate from automated validation.

Evidence root: `/workspace/epicscope-nov01-hybrid/`. `hybrid-evidence.json` contains exact masks/counts, state contingencies and transitions, raw bit histograms, numeric/render comparisons and parsed INI definitions. `correlate-hybrid.mjs` is the task-specific read-only harness. `before-browser/` records the red regression; `after-browser/` the correction checks; `native-browser/` contains original-file worker/fallback readouts, Diagnostics snapshots and screenshots. Original/private bytes are not committed or included in the evidence ZIP.

No push, merge or Idle/VE continuation. The channel-availability UI and exact upstream firmware cause remain review items, not unfinished runtime fixes silently declared complete.
