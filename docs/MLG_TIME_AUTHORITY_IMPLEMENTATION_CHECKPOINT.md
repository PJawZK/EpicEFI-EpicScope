# Canonical MLG time authority — implementation checkpoint

2026-11-12, `ui/idle-analyzer-html-integration`, implementation base `1848734363dbb2312366b32c10ebc888595e8cb3`.

**Partial implementation; not activation or manual UI acceptance readiness.** No selected recorded-Time candidate is published by the application yet. Header-based Logger/analysis behavior remains in effect. No main merge.

## Sequence status

| Design sequence item | Status |
|---|---|
| 1. Review authority/tie/fallback contract | Authorized by the implementation request; exact temporal consumer changes still require reference cases. |
| 2. Wire evidence and retry separation; inactive admission foundation | Implemented and validated in this checkpoint. |
| 3. Duplicate/time-eligibility queries and temporal consumers | **Next; not implemented.** |
| 4. Atomic worker/fallback authority publication | Not implemented; current provisional-index/CRC lifecycle remains unchanged. |
| 5. Persistence/context migration | Not implemented. |
| 6. Selected-clock diagnostics/export/UI | Not implemented. |
| 7. Full activated numerical/performance/native acceptance gate | Pending. Current checkpoint validation is not final redesign acceptance. |

## What changed

`core/parsers/mlg/mlg-records.ts` now retains `headerTimeMs` as an alias of the original scanner `timeMs`, plus exact `rawTimestampTicks:Uint16Array`, in both fixed and general scans. No elapsed-time formula or source validity rule changed. Original indices, byte offsets, counters and CRC exclusions remain intact. A 320k-record raw-tick vector adds ~0.64 MB payload; the header alias adds no second numeric vector. Worker structured cloning preserves that alias, verified in-browser. General growth/worker-copy peak RSS is not yet measured.

Retry classification now uses exact captured raw ticks when available, independent of the selected observation time; retained header-time identity is the compatibility fallback for indexes without raw ticks. It does not use a substituted recorded-Time vector to regroup attempts. This prevents the source identity changes demonstrated by the research model. The actual scanner still publishes its original clock.

`core/parsers/mlg/mlg-time-authority.ts` adds a **pure inactive candidate resolver**, not a runtime import integration. It:

- Requires explicit completed CRC validation; pending validation returns no candidate.
- Uses a unique raw scalar field named `Time`, recognized `s`/`ms` units and supported metadata. Values are already source-decoded; scale/transform are not applied again.
- Admits finite, nonnegative, nondecreasing trusted values with positive progress; preserves equal timestamps and every source slot. Unsafe 64-bit integer conversion is rejected conservatively.
- Uses first CRC-eligible observation as origin; computes independent eligibility and trusted extent without letting excluded rows steer them.
- Rejects missing/ambiguous/unsupported/invalid/reset/constant candidate clocks to an explicitly identified **whole-source** header fallback. No per-row stitching, sorting, clamping or synthetic epsilon increments.
- Returns no trusted authority when no usable trusted observations exist.
- Produces a versioned fingerprint including source/validation generation, raw descriptor, choice, reason and origin; leaves caller-owned source/value/CRC arrays unchanged.

**Do not activate the resolver output through existing generic consumers.** Excluded candidate slots can be NaN or outside trusted extent. Current run/query/render semantics do not yet understand independent time eligibility and could create false gaps or unsafe duplicate interpolation. The `candidate` status and API documentation explicitly identify this restriction. Pending downstream stages are necessary, not optional cleanup.

## Validation

- **1,212 unit tests across 164 files passed.** New coverage includes pending CRC, excluded origin, invalid/nonfinite/negative/reset/constant clocks, missing/ambiguous/bit/unknown-unit fields, milliseconds/scaled integer handling, geometry/fingerprint checks, wire retry identity despite colliding selected times, both scanner paths and >320k observations.
- **1,754 complete browser checks passed**, worker/fallback, including new exact-tick/header-alias publication checks and existing Logger, VE, Idle, CRC/retry, navigation and persistence regressions.
- Typecheck and production build passed; existing bundle-size advisory remains.
- [Three-original-recording admission checks](reference/time-authority-implementation/STAGE_1_ORIGINALS.json) passed: CHDL fixed scan 69,566; October general scan 159,022; November fixed scan 93,759. Candidate end times match the research results. Header vectors, raw ticks and CRC masks remain unchanged; recovery and valid retry-like classifications remain identical even when the copied index is given candidate observation times.
- Candidate resolver CPU in that local run: ~10.47 / 17.99 / 13.71 ms, **zero additional physical reads** during admission. Time columns were explicitly loaded by the external validation harness; this is not a claim that runtime capture/publication has been optimized or implemented.
- `git diff --check` passed. Detailed logs and the read-only original-recording harness are in `/workspace/epicscope-time-implementation/`.

## Exact next boundary / handoff

Complete design item 3 before calling the resolver from any import/publication owner:

1. Prepare eligibility-aware original-index membership, covers and run metadata without full scans on zoom/pan; retain nonmonotonic header fallback. Excluded timestamps must not steer trusted extent or split a recovered retry into an artificial clock run.
2. Add deterministic eligible duplicate-group lookup/bracketing with source anchors, positive-width interpolation and explicit unrecovered-CRC barriers. Avoid future observation selection and repeated full duplicate-group scans.
3. Validate VE segment/window behavior and Idle/Boost/AFR temporal paths: equal time is not backward time, and zero dt is not a measurable derivative. Preserve source observations and document any derived-group representative/weight policy before changing analytical results.
4. Run synthetic edge cases and all three original clock variants, record numerical differences and checkpoint this stage before beginning atomic import integration.

Do not retime saved ranges or UI state yet. Keep tune/working edits, existing layout/navigation behavior and source provenance intact. No browser screenshot is represented as evidence of active recorded-Time authority. Final native replays, migration validation, full gates and measured large-log memory/performance remain required after all implementation stages.
