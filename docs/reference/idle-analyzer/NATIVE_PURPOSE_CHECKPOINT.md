# Native Idle Analyzer — declared test purposes checkpoint

Branch: `ui/idle-analyzer-html-integration`. Parent: `0dfa3f7f186c789681d256bc8e2dcb07bcb0e5ad`. Bounded scope: managed-region purpose tags and corresponding descriptive Stability interpretation. Stop for review; no push or merge is included.

## Working behavior and authority

The native manager now offers the five frozen HTML purposes: Steady idle, Idle recovery, Raised-RPM hold, Transition to idle and Custom investigation. Users can choose a purpose when adding a region or change a retained row. Both manual and discovered regions default to Custom investigation; RPM-only or condition-matching discovery does not establish test intent or verified steady idle.

The existing source-bound region session owns the typed purpose. Changing purpose does not change inclusion, bounds, source validity, qualification, manual-bypass eligibility or edit provenance. Splits preserve the purpose on both children. Merges require equal purposes in addition to the existing union/policy checks, so a merge cannot silently discard a different intended test. Invalid purposes are rejected transactionally; identical updates retain the region array.

Interpretation uses the purposes of **included managed regions**, or the selected single-manual region. Excluded/viewed regions cannot change interpretation. Full Log and Logger ranges remain Custom investigation unless represented through explicitly managed regions; labels are never guessed from RPM, the current graph or rendered text. Different included purposes produce a conservative mixed-purpose scope, even where their bounds overlap. No purpose-dependent filtering or denominator change is implied.

Steady idle and Custom investigation retain the established descriptive tracking findings, including their existing operating-state limitations. Raised-RPM, recovery, transition and mixed scopes suppress steady-idle mean-offset and within/outside-band findings. Their measured RPM sigma, RMSE, signed error and band coverage remain available as descriptive logged measurements. Guidance instead asks for a matched raised-speed hold, a bounded documented disturbance, a documented entry transition or separate-purpose scopes. Recovery/transition guidance explicitly states that this Stability view does not measure recovery/entry/settling time. Declaring Steady idle never verifies firmware/controller state.

Source, insufficient observations and coverage failures retain higher-priority guidance. No-matching or invalid qualification evidence still overrides purpose advice. No causal fault, gain, table change or ECU action is inferred.

## Reuse, lifecycle and presentation

Recorded numerical evidence stays under the existing analysis controller. Purpose edits update only metadata and interpretation; they do not call the source loader or restart numeric analysis. Assessment is projected from accepted aggregates and current typed scope purpose, eliminating a second retained interpretation that could become stale after a metadata edit. Pending numeric completion therefore renders the latest declared purpose, while existing source/configuration generation guards continue to reject obsolete measurements.

The projection reads aggregates plus at most the bounded region list, never recorded sample arrays. Graph focus and presentation tabs remain independent of numeric scope. Purpose-only edits retain table rows, native select elements, focus and unapplied bounds drafts; only affected purpose values and bounded merge choices update. Existing delegated local events are reused. No global listeners, observers, lifecycle wrappers, parser, source cache or new rendering framework are introduced.

## Numerical cases and validation

Independent numeric case: RPM 2000/2000 and logged target 900/900 produce sample sigma 0 RPM and RMSE 1100 RPM for every purpose. With Steady idle/Custom, the existing mean-offset finding remains descriptive. Raised/recovery/entry/mixed scopes instead request purpose-specific review while preserving those exact facts. No purpose changes the source/sample arrays.

Production build/typecheck passed (existing large-bundle warning). The full unit suite passed **1,064 tests across 147 files**; the focused gate passed **28 tests across three files**. The final full browser gate passed **1,533 checks across 168 result groups** in worker/fallback configurations. The focused browser gate passed **182 checks across 14 groups** in worker/fallback configurations, covering purpose selection, mixed/excluded scopes, raw metric/read-count retention, native node/focus/draft retention, navigation and latest-purpose use after pending completion.

Native production-preview Chromium passed **nine action checkpoints** using the supplied INI and private canonical 2,000-record MLG prefix. All five purposes and the mixed-purpose scope retained 771 valid samples, sigma 14.49 RPM and RMSE 14.52 RPM in the same included 0–5 s/15–20 s intervals. Excluding the second interval retained 337 samples; focusing its Raised-RPM row did not replace the active Steady idle interpretation. At 390 px, native purpose selection retained an unapplied 0.1 s start draft without changing those 337 samples. There were zero uncaught browser exceptions and document width equaled viewport width (390 px). The narrow purpose-control screenshot was inspected. The manager table intentionally scrolls inside its container.

The first browser attempt was interrupted by Vite hot reload while final source cleanup was still being written; the CDP node became unavailable. A fresh run with no concurrent source edits passed. A new unit test initially omitted the explicitly required optional-target argument; production typecheck caught it, it was corrected, and the final build passed. Neither attempt is counted as a passed gate.

Local browser artifacts and native production-preview evidence are under `/workspace/epicscope-idle-purpose/`, with adjacent named build/unit logs. Private INI/recording bytes remain outside Git. All five frozen HTML snapshots remain unchanged.

## Stage completion and remaining work

[The stage status table](NATIVE_STAGE_STATUS.md) is the current completion record. This checkpoint closes the region-purpose feature gap within the primary-source Stability foundation; it does not declare stages 1–2 complete across all diagnostic prerequisites. The next task is a bounded inventory/closure checklist of existing fixture, numerical and role contracts, rather than adding another mode immediately.

Purpose-aware recovery event detection, additional modes, independent recording comparison, tune context, persistence and plans remain separate work. Manual acceptance and full-recording/hardware validation remain open. No tune or ECU data is changed.
