# November 1 original-recording MLG integrity audit

Audit date: 2026-11-03. Runtime baseline: `a2004448f108ba0729e4c322fa8f62e34ce929a8` on `ui/idle-analyzer-html-integration`. This resumes the [prior checkpoint](MLG_INTEGRITY_AUDIT_2026-11-03.md) with the actual November recording. That report's statement that this recording was unavailable describes the earlier checkpoint only.

**Outcome:** the exact recording reconstructs and imports successfully. It has three unrecovered CRC attempts, 240 recovered attempts, short cadence outliers and substantial **channel-specific recorded nonfinite intervals**. These are different classes of evidence. No new runtime correction, marker policy, decoding change, timestamp rewrite, source reindexing or source-file modification was made in this continuation. Idle/VE work remains paused and unchanged. Stop for review; no merge into `main`.

## 1. Reconstruction and identity

Extracted the instructions package into an isolated directory. Inspected the supplied script, placed the three numbered ZIP transport packages alongside `manifest.json` and `reassemble_nov01.py`, and executed the supplied script unchanged. It checked archive hashes, part hashes, concatenation order, reconstructed archive hash, ZIP CRC and contained-file size. Independently checked the reconstructed ZIP hash again **before extracting** the sole expected MLG. No transport segment or `.bin` part was parsed as a recording.

| Object | Bytes | SHA-256 |
| --- | ---: | --- |
| Reconstructed `2026-11-01_11.57.38.zip` | 67,185,195 | `212a7363627cb3f3b43afc40738483bc6a941c650a9016651cf9c9b28667d084` |
| Extracted `2026-11-01_11.57.38.mlg` | 655,524,361 | `4282efddcd4386e5abc94002caa198aba02c76824ce6e71343d79db524867481` |

ZIP hash exactly matches the manifest; ZIP CRC passed. Strict production parsing succeeds: MLGv2, 6,976 payload bytes / 6,981 bytes per standard block, 2,556 fields, 93,759 indexed records, no incomplete tail and no file marker blocks. Source indices in this report are zero-based; times are canonical elapsed source times, not wall-clock time. No INI was needed to establish recorded field names/units/bytes.

## 2. Methods and coverage

- Ran the existing offline tool unchanged: `node scripts/audit/mlg-integrity.mjs <original.mlg> <output-directory>`. Retained its complete ledger and diagnostics, including original offsets/counters/clock ticks and nearby cadence evidence.
- Used the production parser, semantic General starter resolver, channel decoder and raw/envelope builders in an external read-only correlation harness. No application instrumentation or new event listeners/observers were added.
- Streamed all **239,026,896 field measurements** across all 93,516 checksum-valid records using production `decodeMlgRawValue` and `displayMlgValue`, with bounded 8 MiB source pages. All 6,976 field payload bytes are accounted for. Skipped the 243 checksum-invalid attempts in this value-availability pass; their source evidence is retained separately.
- Independently loaded canonical columns for all 15 nonfinite fields and matched streaming counts exactly. For each availability run retained first/last source indices, times, CRC exclusions, nearest trusted finite neighbors, first raw field bytes/absolute offset and simultaneous Engine context.
- Checked full-log RPM/MAP/TPS/CLT columns and 11 one-second windows around every unrecovered CRC/counter/cadence event. Direct and block-summary envelope results agree in **44/44** comparisons. This checks regenerated block summaries, not every persisted-cache/browser-storage configuration.
- Loaded the complete original into a production Vite preview in isolated Chromium, both with staged workers and with Worker unavailable. Exercised native channel assignment, source-marker clicking, seeking and zooming. Inspected the saved rendered screenshots.

## 3. Canonical source continuity

| Observation | Count / value | Interpretation |
| --- | ---: | --- |
| Complete indexed records | 93,759 | Original attempts retained |
| Checksum-valid records | 93,516 | Not equivalent to finite values in every channel |
| Invalid attempts | 243 | 240 recovered; 3 unrecovered |
| Remaining counter discontinuities | 5 | No exact missing-record count or cause established |
| Valid retry-like runs | 8 | Preserved valid; not automatically corruption |
| Equal adjacent timestamps | 248 | Not proof of identical payloads |
| Raw wrap/reset candidates | 2,211 | Mostly normal modulo clock observations; not 2,211 failures |
| Heuristic cadence outliers | 6 | Unknown cause; no packet-loss verdict |
| Timestamp regressions | **0** | Prior October regression defect is not reproduced here |
| Physical offset discontinuities | **0** | Every indexed standard block advances 6,981 bytes |
| Smallest positive timestamp interval | 8.04 ms | |
| Largest timestamp interval | **103.73 ms** | Source index 43,560 |
| Canonical extent | 0–1,449,624.35 ms | 24:09.624 |

There is **no multi-second gap in the shared canonical time array**. This does not prove continuous physical acquisition: the 16-bit clock rolls over every 655.36 ms; without another independent time authority, whole-wrap elapsed losses or clock resets cannot always be disambiguated. Do not fabricate elapsed time or sort/clamp/reindex the source.

The offline ledger has 2,457 correlated observation spans, including normal rollover observations. They are not 2,457 errors. Parser diagnostics total 258: two summary entries, 240 recovered attempts, three CRC mismatches, five counter discontinuities and eight retry-like runs. The three CRC events overlap counter discontinuities; these counts must not be added as independent causal episodes.

### Three unrecovered CRC events

| Original index | Record offset | Bad attempt time (ms) | Trusted finite endpoints (ms) | Trusted span |
| ---: | ---: | ---: | --- | ---: |
| 32,308 | 226,534,930 | 500,881.24 | 500,853.81 → 500,895.30 | 41.49 ms |
| 52,052 | 364,367,794 | 807,183.25 | 807,159.77 → 807,195.36 | 35.59 ms |
| 60,044 | 420,159,946 | 929,683.13 | 929,660.56 → 929,694.97 | 34.41 ms |

Each occurs after a counter jump of two and is followed by a separate recovered bad attempt with a valid replacement at the same time/counter. Invalid records remain excluded; the replacement does not retroactively recover the earlier different-counter/time attempt. These trusted spans describe untrusted measurements, not proven missing-time durations.

The two other counter discontinuities have checksum-valid records: index 199 at 2,620.02 ms (198→200; 22.18 ms interval), and index 25,854 at 398,738.49 ms (254→0; 29.30 ms interval). Neither creates a break in the tested one-second Engine raw windows.

### Six cadence observations

| Index | Adjacent endpoint times (ms) | Interval | Raw break in tested 1 s window? |
| ---: | --- | ---: | --- |
| 9,329 | 145,039.25 → 145,107.20 | 67.95 ms | No |
| 43,560 | 673,624.84 → 673,728.57 | 103.73 ms | Yes |
| 74,476 | 1,151,773.73 → 1,151,870.55 | 96.82 ms | No |
| 80,251 | 1,239,776.10 → 1,239,864.29 | 88.19 ms | No |
| 81,767 | 1,262,783.06 → 1,262,886.24 | 103.18 ms | Yes |
| 83,488 | 1,288,323.53 → 1,288,404.04 | 80.51 ms | Yes |

All six have checksum-valid endpoints and sequential counters. Offline detection uses preceding positive-interval cadence (129 observations); raw rendering uses visible-range cadence. Both have a 50 ms floor and a five-times-median threshold. Consequently offline observations and displayed breaks need not match one-for-one. Envelope continuity additionally depends on occupied pixel columns. None of these presentation rules independently establishes recording corruption.

## 4. Channel-only availability: substantial gaps explained by actual payloads

RPM (`mlg:33`), MAP (`mlg:53`), TPS (`mlg:43`) and CLT (`mlg:39`) each have 93,516 finite trusted values, 243 checksum exclusions and **zero additional invalid values**. Their full-source envelopes have only the initial break, not an internal multi-minute trace gap.

These 15 fields contain nonfinite values in checksum-valid records:

| Channel | Recorded field name | Nonfinite valid records | Unavailable runs |
| --- | --- | ---: | ---: |
| `mlg:543` | Spark Dwell Clamp | 573 | 2 |
| `mlg:1640` | Ignition: base dwell | 502 | 2 |
| `mlg:1641` | Ignition: coil charge time | 502 | 2 |
| `mlg:1642` | Ignition: dwell duration | 502 | 2 |
| `mlg:2112` | trgSync: Trigger Latest Ratio | 2 | 1 |
| `mlg:2125` | vvt1iSync: Trigger Latest Ratio | 93,516 | 1 |
| `mlg:2138` | vvt1eSync: Trigger Latest Ratio | 93,516 | 1 |
| `mlg:2151` | vvt2iSync: Trigger Latest Ratio | 93,516 | 1 |
| `mlg:2164` | vvt2eSync: Trigger Latest Ratio | 93,516 | 1 |
| `mlg:2297` | Hybrid: Motor only TPS | 88,981 | 7 |
| `mlg:2298` | Hybrid: Extra TPS beyond stop | 88,981 | 7 |
| `mlg:2299` | Hybrid: Fade factor | 88,981 | 7 |
| `mlg:2300` | Hybrid: PID raw | 88,981 | 7 |
| `mlg:2301` | Hybrid: PID after gain | 88,981 | 7 |
| `mlg:2306` | Hybrid: DC safe ceiling | 88,981 | 7 |

All listed nonfinite values are quiet NaNs (`7fc00000` in recorded big-endian F32 bytes), except `trgSync: Trigger Latest Ratio`, which contains positive infinity (`7f800000`) at indices 199–200 (2,620.02–2,634.50 ms). These values are physically recorded inside checksum-valid payloads. Canonical channel decoding reproduces them; neither transport reconstruction nor Logger invents them. A checksum-valid record is not a promise of valid measurements in every field.

The six Hybrid fields share seven unavailable runs. Representative `Hybrid: Motor only TPS`:

| Original indices | First–last nonfinite time (seconds) | CRC-valid NaNs |
| --- | --- | ---: |
| 0–656 | 0.00000–9.13109 | 653 |
| 1,916–1,916 | 28.75472–28.75472 | 1 |
| 1,920–1,922 | 28.80546–28.83130 | 3 |
| 3,769–3,793 | 57.55176–57.87365 | 25 |
| 4,068–5,121 | 62.14915–79.10632 | 1,053 |
| 5,379–92,560 | 83.62395–1431.16819 | 86,957 |
| 93,470–93,758 | 1445.17507–1449.62435 | 289 |

The dominant interval is **83.62395–1,431.16819 seconds** (22 min 27.54424 s between first/last NaN). Its 86,957 valid-checksum NaNs coexist with 225 separately excluded CRC attempts. The finite neighbors are index 5,378 at 83,599.82 ms (1.1049044%) and index 92,561 at 1,431,181.32 ms (1.2694666%). First NaN record offset: 38,543,581; first field byte offset: **38,549,670**, raw bytes `7fc00000`. At that record RPM=1,043, MAP≈65.17 kPa, TPS≈6.68%, CLT≈78.57°C, all finite. This is strong evidence for a **channel-availability gap**, not a 22-minute whole-source loss.

Three Ignition dwell fields share startup NaNs through 2,864.05 ms and final NaNs from 1,445,189.10 ms to EOF. Spark Dwell Clamp has a somewhat longer startup interval through 3,791.15 ms and the same final interval. RPM is zero at these run starts; that association does not establish the firmware's reason for emitting NaNs. The four VVT ratio fields are nonfinite for the entire recording. Do not infer disabled sensors, wiring failure, firmware bugs or expected operating semantics from this file alone.

## 5. Actual browser observations and marker classifications

Both production paths loaded all 93,759 records, reached Ready with issue state, retained source markers and overview integrity marks, and had **zero captured runtime exceptions**. Native clicking at the first source CRC marker opened the correct 08:20.881 source notice. Import plus initial graph readiness was approximately 3.7 s fallback / 7.2 s staged worker on this environment; these are single runs with different work/persistence paths, not a performance ranking or hardware benchmark.

Saved screenshots were visually inspected:

- `hybrid-full-source.png`: native addition of `Hybrid: Motor only TPS` to the four Engine channels. The Hybrid trace is absent through the long central interval while the Engine traces continue. Three source CRC icons remain visible at full-log scale. The cursor was on an intentionally excluded bad CRC attempt, so all NOW readouts there are dashes; that is not an import failure.
- `cadence-103ms.png`: native seek/zoom to 11:13.322–11:14.030. The four Engine traces show the same blank interval across 673,624.84–673,728.57 ms, **without a CRC icon or corrupt-record bridge**. This is the checksum-valid spacing event, not an unmarked CRC failure.
- `unrecovered-crc.png`: 08:20.527–08:21.235. The unrecovered attempt has its source icon, red reference line and dotted per-trace bridges. The NaN Hybrid channel remains absent.

Current ownership/classification:

| Evidence | Current owner / code path | Current presentation |
| --- | --- | --- |
| CRC/retry validity | `core/parsers/mlg/mlg-integrity.ts`, canonical record index in `mlg-records.ts` | 240 recovered diagnostics: `recovered-retry`, continuity false; 3 unrecovered: `corrupt-record`, continuity true |
| Source marker projection | `apps/web/src/app/source-integrity-markers.ts` | Diagnostic metadata projected by source time; display clustering only |
| Marker/bridge drawing and interaction | `source-integrity-canvas-overlay.ts`, `graph-viewport.ts`; timeline overview uses same source projection | Unrecovered source icons and appropriate bridges retained at full/close scale; recovered retry does not become a false loss marker |
| Finite/nonfinite channel values | `core/parsers/mlg/mlg-channel-data.ts`, canonical ranges | Per-channel missing trace; source-wide CRC validity unchanged |
| Cadence/pixel trace breaks | `core/timeline/viewport-series.ts: buildRawViewportSeries/buildViewportTraceSeries` | Visible gap can occur without a parser diagnostic or marker |
| Read-only forensic observations | `core/parsers/mlg/mlg-integrity-audit.ts`, `scripts/audit/mlg-integrity.mjs` | Ledger only; not installed into Logger as new source verdicts |

The original file contains **zero file marker blocks**. UI integrity icons are derived diagnostics, not fabricated logged events. Counter discontinuities, normal wraps, duplicate times, channel NaNs and the six offline cadence flags have no `corrupt-record` marker metadata. Absence of red icons for those categories is therefore explicable from actual ownership; adding red markers indiscriminately would misclassify evidence.

**Additional verified presentation discrepancy:** fallback's load title/status omit the CRC count (`Ready`, record count only), while staged worker displays `CRC checked · 3 unrecovered CRC records`. Both retain issue state and clickable source CRC markers. The fallback `recordFullLoad` status assignment in `apps/web/src/app/app-shell.ts` differs from the staged validation-completion status block. This is a summary parity issue, not evidence that fallback skipped checksum validation. It was not changed in this investigation.

## 6. Review recommendations, ordered

1. Confirm which channels/times the user originally meant. The exact reported selection has not been provided. This audit reproduces concrete source-spacing and channel-only gaps; it does not claim every reported graphical symptom has been identified or fixed.
2. Consider an explicit **per-channel availability explanation** at the current channel/graph owner: recorded nonfinite vs checksum-excluded vs genuinely unavailable data. Preserve source indices and do not convert these into global corruption markers. The 22-minute Hybrid interval justifies this better than speculative parser repair.
3. Reconcile fallback/staged load-summary wording at the existing app-shell owner, with tests proving identical integrity counts and unchanged source validity.
4. If users need cadence annotations, first agree an unknown-cause policy and a canonical source-scoped projection. Do not classify from changing viewport pixel/median heuristics, guess missing-record counts or duplicate per-pane full-log work.
5. Keep the separately demonstrated October nonmonotonic binary-lookup problem as a separate source-authority task. November has no canonical timestamp regression, so this file does not justify attributing its gaps to that bug.

**Do not optimize or repair here:** transport bytes/hashes, CRC exclusions, original sample indices, canonical clocks, valid retry-like records, or finite Engine data. Do not zero-fill NaNs, draw fabricated connecting samples across long unavailable intervals, infer ECU/firmware causes, or remove working caches/storage. No evidence supports a new parser format fix for this complete recording.

## 7. Validation and checkpoint boundary

Fresh validation in this continuation:

- Original reconstructed ZIP hash/CRC/size and extracted MLG hash verified.
- Complete strict parse plus source ledger, full-field scan and independent canonical-column confirmation completed.
- **1,158 unit tests passed in 161 files**, including three new independently generated November-pattern regressions: checksum-valid rollover cadence; unrecovered/recovered adjacent attempts and original indices; channel-only NaNs alongside finite RPM and independent CRC corruption.
- **55 focused browser checks passed in eight groups**, staged and fallback: MLG integrity, source owner, CPU/projection and marker behavior.
- Production build passed (existing bundle-size advisory); TypeScript gate passed after adding tests.
- Actual original recording exercised in both production import paths, plus native channel assignment/marker click/seek/zoom and inspected screenshots.

The prior checkpoint's broader browser suite is historical evidence, not a new full-suite run. No production source was changed in this continuation. These checks do not establish all-layout, all-channel, hardware-wide performance or manual user acceptance.

External evidence root: `/workspace/epicscope-nov01-integrity/`. Contains `RECONSTRUCTION.json`, complete `original/ledger.json` and `diagnostics.json`, `correlation.json`, catalog, correlation harness, browser harness/results/screenshots, validation logs and the supplied manifest/script. Raw recording and transport archives remain external and are **not committed**. The downloadable evidence package excludes the private original/transport bytes. The original remains available locally at `input/2026-11-01_11.57.38.mlg`.

**Stop here for review.** Any subsequent runtime fix should be a separate bounded change with explicit classification tests and manual browser acceptance. No push, main merge or Idle development was performed by this continuation.

## Follow-up: Hybrid availability and fallback status

The [focused Hybrid-channel investigation](MLG_NOV01_HYBRID_AVAILABILITY_AUDIT.md) continues from `8574f85f1eca22090886d2334046044501a32257`. All six have exactly identical NaN masks correlated with recorded Hybrid validity/cache invalidation and legacy correction selection. The reproduced fallback CRC-summary omission is corrected at the shared app-shell presentation owner; source/CRC/retry semantics are unchanged. Channel-specific availability indication remains a reviewed proposal, not installed UI. The findings and no-runtime-change statements above describe the earlier checkpoint.

## Visual continuity follow-up — 2026-11-05

The [Logger trace/navigation checkpoint](LOGGER_TRACE_NAVIGATION_CHECKPOINT.md) replaces the earlier pixel-distance/visible-window-cadence rendering rules with recorded boundary continuity and bounded source-local cadence. The source ledger, recorded NaN evidence and CRC/retry classifications above are unchanged; the earlier table of viewport-dependent raw breaks is historical presentation evidence.
