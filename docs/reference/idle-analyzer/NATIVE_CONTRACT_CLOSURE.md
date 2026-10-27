# Native Idle Analyzer — stage 1–2 contract closure checklist

Implementation follow-up: [native DC Valve Tracking](NATIVE_VALVE_TRACKING_CHECKPOINT.md) closes the position alignment/unit/sign prerequisites below for that mode. [Native RPM PID](NATIVE_RPM_PID_CHECKPOINT.md) adds aligned descriptive term/output/applied evidence, retaining unitless canonical fields as raw and leaving unverified clamp/fade claims unavailable. [Native DC Bias / Position PID](NATIVE_POSITION_PID_CHECKPOINT.md) adds independent recorded inner/feed-forward evidence with retained position reuse and corrected dedicated motor authority, while matching tune-derived bias/limits/actuator assignment stay gated. Other remaining-mode prerequisites stay open; this document preserves the earlier contract-review checkpoint.

Branch: `ui/idle-analyzer-html-integration`. Parent: `486944f26b10646eadfe64162a2fb8d0a16fa33c`. This is a bounded prerequisite checkpoint, not another broad audit or diagnostic-mode implementation. Production TypeScript/CSS and frozen HTML are unchanged; only tests, generated public fixture definitions and documentation change.

## Stage 1: fixture inventory and provenance

Private user files remain outside Git. Permission to investigate uploaded files is not treated as permission to redistribute their bytes. Generated fixtures and existing public browser fixtures are safe to keep with tests. A matching filename, available INI or MSQ does not establish the flashed tune, firmware build or logger/controller cadence.

| Source | Availability / verification | Acceptance boundary |
| --- | --- | --- |
| October 20 original raw MLG | Unavailable here; transformed embedded HTML data is available | Embedded statistics remain reference-only, not an independent canonical re-decode |
| September 30 original MLG | Unavailable for fresh replay | Historical reports cannot close new source/browser validation |
| Matching October 19/20 original INI, MSQ and firmware build | Exact matching provenance unavailable | No tune-derived bias, controller-limit, cadence or causal intervention claim |
| October 21 complete recording shown by user | Unavailable here | Screenshots do not provide raw samples or source identity |
| October 25 complete MLG | Private reconstructed file exists, 1,102,856,192 bytes; earlier reconstruction manifest records SHA-256 `de56d1d03458d2cde755ab903fc34e62f864c8962fe6d0e4d17df8d0c2961a13` | Manifest inspected, size checked; not freshly rehashed/reanalyzed or hardware-benchmarked in this checkpoint |
| October 25 bounded prefix | Private canonical 2,000 indexed-record prefix; independently hashed below | Workflow/authority evidence only; five recovered attempts remain indexed but invalid |
| Uploaded mainController.ini and CurrentTune ORG/ALT | Available privately; independent hashes below | Useful mapping/save fixtures; association to the prototype recordings/firmware remains unverified |
| Generated Idle contract MLG | Public deterministic fixture builder in `tests/fixtures/idle/mlg-contract.ts` | Exact authored samples, no private recording bytes, canonical production parser/decoder |

The earlier reconstruction manifest is `/workspace/epicscope-mlg-investigation/reconstruction.json`. Its ZIP SHA is a compressed-file hash and is not the MLG hash. Full source metadata above is historical verification, explicitly distinct from the fresh small-file fingerprints below.

## Canonical coverage matrix

| Required case | Existing coverage reused | New cross-boundary check |
| --- | --- | --- |
| CRC-invalid followed by valid same-counter/time retry | `tests/parsers/mlg/mlg-retry-recovery.test.ts`, `mlg-retry-runs.test.ts` | Canonical decoder retains both original indices; invalid attempt does not become a valid measurement |
| Unrecovered CRC | Same parser tests; `tests/parsers/mlg/mlg-integrity.test.ts` | Invalid count and paired denominator reconcile through native Stability |
| Counter discontinuity / lost delivery | Retry recovery, integrity and `tests/logs/mlg-records.test.ts` | Counter-gap diagnostic preserved without inventing a missing value/index |
| 8-bit counter wrap | `tests/parsers/mlg/mlg-counter-wrap.test.ts` | Combined fixture crosses 255→0 after a recovered retry |
| 16-bit timestamp wrap | `tests/logs/mlg-records.test.ts` | 65530→4 produces a 0.1 ms increment on decoded RPM grid |
| Small backward timestamp | New canonical contract test | Raw 100→90 preserves −0.1 ms; it is not silently unwrapped |
| Actual supplied time regression | Existing discovery break behavior; new contract assertion | Original-index runs remain distinct; no continuous sag/recovery work is enabled |
| Incomplete physical tail / short backing read | Existing strict/recovery/chunk-boundary cases in `mlg-records.test.ts` | Strict parse rejects; explicit prefix retention diagnoses loss and indexes no tail sample |
| Decode/scaling/cache | `tests/logs/mlg-channel-data.test.ts`, alignment tests | New integration uses canonical scalar decoding, never prototype row filtering |
| Native lifetime and display separation | `tests/web/idle-analyzer.browser.mjs`, Analyzer activity and Logger-context browser checks | Canonical fixture counts survive unchanged context/navigation; all unimplemented native modes remain disabled |

New fixture: seven complete RPM records with times `[0,0.1,0.1,0.2,0.3,0.4,0.5]` ms and validity `[1,0,1,1,1,0,1]`. Valid values are `[900,1000,1100,1200,900]`: mean 1020, **sample variance 17000**, sigma √17000, actual−1000 mean error 20, RMSE √14000, and ±40 paired coverage 20%. All seven original indices remain represented. Returned requested-range completeness is not a claim that the physical recording has no delivery loss: an accepted prefix can cover its requested interval while the file still has an explicitly diagnosed incomplete tail. Two invalid attempts do not imply two unrecovered physical losses; the diagnostic distinguishes the recovered attempt.

An initial regression test assumed every backward tick would unwrap. Running the production parser disproved that assumption: wrap requires a decrease greater than half the modulus. The expectation was corrected to −0.1 ms. No parser behavior was changed. The modular clock still cannot prove physical chronology for every ambiguous large discontinuity or multiple wraps; event inference must disclose that limitation.

## Numerical contracts: current native Stability

These are executable in the existing Stability, qualification, purpose and assessment tests plus the new canonical contract test:

- Inclusive original-time bounds and deduplicated region union; gaps between regions contribute no samples.
- Finite validity=1 measurements only. Quality code 0 and validity byte 1 are distinct encodings. Invalid/unavailable measurements remain counted; optional measurements are never fabricated as zero.
- Equal sample weighting; sample sigma uses n−1, not the HTML's population sigma. No interpolation or time-weighted statistics across gaps.
- Tracking requires original-index **and timestamp** alignment. Error is actual−target. RMSE and band coverage use valid aligned pairs, not all RPM samples. Each logged target is used at its recorded sample.
- Warm/pedal/physical-TPS conditions require explicit mapping/unit authority; manual bypass is explicit and never bypasses source validity. Purpose is declared intent and never changes eligibility.
- RPM-only variability remains available without target/controller channels. Native Stability always disables the legacy sag routine and makes no event, t63, frequency, recovery or controller-cadence claim.

## Required capability and unit gates for remaining modes

This freezes prerequisites, not new runtime APIs or active modes. Reuse `analyzer-channel-roles.ts`, authoritative catalog/INI units and the existing native source/controller. The presence of a matching name is not sufficient to enable a mode. Missing optional signals disable only their dependent metrics; missing prerequisites yield unavailable values/reasons, never healthy zeros.

| Mode | Minimum evidence / existing roles | Contract before native activation |
| --- | --- | --- |
| Stability | `rpm`; optional `target` | Implemented, including unit authority, source validity and missing-target state |
| Base Airflow | Valid RPM/target for regulation context; logged `basePosition`, `closedLoop`, `finalPosition` for their respective evidence | Verified position units; base/final position are levels, applied correction is a delta in percentage points. Do not sum raw PID terms or infer tune-table error without firmware authority |
| RPM PID | `rpm`, `target`; independent `p`, `i`, `d`, `closedLoop` where present | Separate raw PID terms from applied/clamped/faded correction; require defined units and limits before watch/saturation percentages. No cadence inferred from logging rate |
| DC Valve Tracking | `dcTarget`, `dcPosition` | Actual−target position error, aligned original indices **and timestamps**; explicit valid/invalid/unavailable counts. Existing legacy tracking is index-based and needs alignment gating before native activation |
| DC Bias / Position PID | Logged `dcBiasOutput`, `dcP`, `dcI`, `dcD`, `dcOutput` independently | Keep logged bias distinct from normalized tune-derived expectation; signed motor duty, position travel and percentage-point error are different quantities. Missing limits block saturation claims |
| Ignition | `ignitionAdvance`, optional `ignitionCorrection` plus operating context | Absolute advance and signed correction require degree/unit authority; no torque or causal improvement estimate |
| Load Recovery | Aligned `rpm`/`target`, valid continuous event runs and explicit threshold/gap/dwell settings | Event contract below; legacy sag results are not accepted as parity |
| Compare | Two independently retained source handles and valid regions plus each metric's roles | Stage 5 source ownership/comparability gate; Logger A/B bounds are not two recordings |

For new modes, retain the existing optional/available result style and add explicit capability reasons at the current controller boundary. No parallel resolver, alias catalog or generic analysis framework is required. Unknown/incompatible units remain blocked. Calibration and flashed-state provenance remain unverified until established independently.

## Proposed recovery reference contract — review and stage 3 implementation gate

The legacy `analyzeIdle` routine currently closes a sag only on a later non-sag sample, searches forward for the first in-band point, reports time from the last below-threshold sample, and does not establish settling dwell/gap continuity. It must not be advertised as the native Recovery implementation.

Before activating that mode, implement and independently test:

1. Error actual−target ≤−sag threshold starts a sag at the first aligned valid original sample. Report the last below-threshold sample separately from recovery. Thresholds are explicit references, not universal firmware limits.
2. Recovery duration is measured **from sag onset** to the first in-band sample of a subsequently confirmed settling run. Confirmation time is a separate fact. Do not silently retain the legacy last-sag-sample origin.
3. Settling requires the chosen dwell with aligned valid observations and no gap beyond the declared maximum. Band endpoints are inclusive. Sampled dwell does not prove continuous unobserved behavior.
4. A physical loss, unrecovered invalid required measurement, backward time, oversized gap or region boundary breaks the event run. A valid same-time retry can replace its invalid attempt only under verified canonical retry semantics; do not densely filter and bridge arbitrary gaps.
5. Terminal/broken events are retained as censored with recovery unavailable, never omitted or reported as zero. A second sag before settling cannot reuse evidence as an independent successful recovery. Original event identity/region references must prevent overlap double-counting.

Independent acceptance cases (proposed for manual review, not claimed implemented or passed):

| Authored evidence | Expected native Recovery result |
| --- | --- |
| Times 0…800 ms, 100 ms steps; target1000; RPM `[1000,850,880,1000,1000,1000,1000,1000,1000]`; threshold100, band40, dwell500, max gap150 ms | Sag onset100, last-below200, first-settling300, confirmation800; recovery200 ms from onset, confirmation700 ms from onset |
| Same input ending at200 ms | One terminal/censored event; recovery unavailable |
| Invalid required observation at400 ms or an oversized gap in settling | Event cannot recover across the break |
| Exact band boundary −40/+40 RPM | In-band, provided all validity/alignment/continuity conditions hold |
| Overlapping selected regions | One physical event identity; no duplicate event/eligible-sample totals |

For the first case, legacy recovery would be100ms from the last below-threshold sample, whereas the proposed onset-based duration is200ms and additionally requires500ms of settling evidence. This is an intentional proposed mathematical difference, not a production change.

These are explicit remaining stage 1 review/test and stage 3 implementation gates. No failing/placeholder tests are committed as passing coverage. Bias interpolation, limit coverage and controller unit/alignment cases must likewise receive independent tests when their capability is implemented; unavailable tune/firmware is not substituted with prototype constants.

## Stage 2: current primary-source boundary

The primary-source Stability session acceptance criteria are satisfied by existing source/lifecycle browser checks and this canonical replay: identity+revision binding, original sample grid, canonical role selection, source-bound region definitions/purposes/inclusion, independent viewport/focus, semantic invalidation, unchanged-context retention, hidden-domain deferral, stale completion rejection and checked Logger callbacks. Native region objects are readonly definitions; private bytes and Logger state remain owned elsewhere.

There is **no tune input** to the native Stability calculations. Analyzer's tune-only route may resend unchanged context, which the existing semantic key reuses. Adding a redundant global tune listener/revision would create an unnecessary dependency. When a future mode actually consumes normalized tune context, capture its relevant immutable tune revision in that mode's request key and reject late completions at its existing controller boundary. Test unchanged tune, real replacement, failed replacement and late completion then. Independent B remains a stage 5 ownership extension, not another Logger.

Stage 2 is complete **for the current primary-source Stability boundary**, not a claim that tune-dependent modes, independent B or persistence are implemented. Stage 1 remains partial overall because the remaining-mode executable numerical gates above are still open. The next bounded implementation should address a chosen mode's contracts before exposing its UI.

## Fresh private fixture fingerprints

Hashes identify these available bytes, not recording/tune association or redistribution rights.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| 2026-10-25_prefix-2000-records.mlg | 14849557 | `3cffa88ede6e41fa440fcce96f412e51ea02b9e21d4ad12f52d96679ad1c0d15` |
| mainController.ini | 5720851 | `9a538ff308678fa841e079947ed91908dd68d4824e4592a57440aeb7af7b414a` |
| CurrentTune-ORG.msq | 769449 | `441503a0369caa64124abe5c132b89fef5ad9eddc39233676d3d0548709e3a71` |
| CurrentTune-ALT.msq | 769796 | `425093c88317dc1aeb8ba1fda6b846a1d01f8868e02b131e5a235373359bd9d0` |
