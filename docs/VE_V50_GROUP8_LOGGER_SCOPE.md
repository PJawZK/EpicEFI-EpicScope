# Group 8 — Logger-authoritative timeline and analysis scope

Development lineage: `fix/ve-v50-reviewed-groups-1-7`, starting at recovered/published Group 7C commit `73a1f081b283bf7a5ddb1685f9655f41053fe96a`. No main merge, ECU writing or Burn.

## Audit and reproduced defect

Logger already supplies source-bound time extent, A/B values, saved range snapshots and an explicit range-opening callback through `LoggerAnalysisContext`. That remains the range authority. The shared Analyzer selector resolved `saved:N` against array position. Reordering saved ranges could silently change the selected interval and invalidate retained analysis; Chromium reproduced this in both worker modes before correction (validation directory `reproduction.json`).

A related owner issue was confirmed by code inspection: Logger context changes affecting the selected scope invoked the source/tune rebuild, clearing working delay authority. Scope selection also advanced session revision twice through recommendation clearing plus invalidation. These paths now receive focused browser regression coverage.

## Ownership and corrections

- `analyzer-scope.ts` projects Full Log and only finite, nonempty Logger ranges. Reversed ranges normalize only for bounds; original Logger data is not mutated. Saved option indices still refer to their original array positions, including when invalid entries are filtered.
- VE's existing context owner remaps saved selection by normalized bounds and exact label, then permits an unambiguous label-only rename at identical bounds. Removed, edited or ambiguously renamed ranges fall back visibly to Full Log, without automatic analysis. Identical duplicate entries are semantically equivalent. No fabricated persisted IDs or workspace schema changes.
- Remembered selection is updated even when reordering is a semantic no-op. Retained primary analysis, revisions and working delay survive reordering/no-op context updates.
- A real selected-scope change clears obsolete discovery/analysis through existing invalidation, preserving the accepted working delay table. It advances session revision once. A real source/tune change still uses existing rebuild/retirement.
- Saved selection is not carried by index into a replacement source; it falls back to Full Log. Pending old-scope completions are rejected by existing generations.

## Timeline controls

The existing presentation owner now projects native Full Log, A/B and saved-range buttons. They delegate to the original semantic scope selector, sharing it with setup controls; they do not introduce a second active-scope model or write Logger ranges. Full Log, A/B and saved bars have distinct colors, textual labels and pressed-state/focus indicators. Overlapping intervals use separate lanes, so every saved range remains independently selectable. The saved/A-B list scrolls within a bounded height.

All three types share the same time-axis lane. Visual inspection initially found that the Full Log band spanned the label column too; it was corrected and a pixel-alignment regression added. Positions are derived from Logger's source extent and actual interval bounds, clipped visually to the source. Unknown extent hides positional bars and Full Log handoff; finite explicit A/B/saved bounds can still be selected/opened without inventing source extent. Invalid/empty ranges are not offered. Full Log analysis remains unbounded in the existing loader contract; full-range Logger handoff uses only the real source extent. No fabricated Visible range option, demo saved names, sample densities, traces or evidence.

One owner-local delegated click listener uses the existing AbortController; no global listener, observer or generic lifecycle wrapper. Native buttons supply keyboard behavior. Range controls rebuild only when their actual range catalog changes; source-extent-only updates patch bar geometry and retain control/focus identity. Hidden context updates defer timeline DOM work until activation.

## Frozen UI reference

The remote development branch now contains `docs/reference/VE_Analyzer_v50_Frozen.html`, retrieved read-only from commit `4e6caf816ee2e723ddec5a2f88f5292d092d0d29` into the validation directory for inspection. SHA-256: `4a1d91bdd45fefab6e7f2e7a671a7e51d4d8e50df43dd53233962f78d5d3e4bc`.

Its scope navigator is temporal orientation rather than a Logger graph. This implementation preserves that boundary. Deliberate parity difference: separately selectable labeled lanes expose real Logger ranges without copying prototype demo ranges/Visible range/density. Its provenance as the later checked-in frozen reference is known; equivalence to the earlier unavailable filename was not independently established. The two remote documentation commits were not merged into this validated recovery lineage.

## Regression coverage

Eight unit cases cover unbounded Full Log, reversed/invalid ranges, original array indices, reorder, rename, removal/edit, ambiguity and unavailable identities.

Seven controller-browser cases per mode cover saved reorder with retained primary/working authority, Logger A/B changes and actual loader bounds, timeline/setup synchronization/colors/handoff/no-op/control identity, removed selection, unavailable extent/invalid ranges, pending stale completion, deferred hidden updates and real source replacement. Two native CDP cases per mode verify Space and Enter delegate exactly one scope change without loading traces.

The first full browser gate reached a legacy assertion requiring a scope-only saved-range edit to clear working delay. That assertion was updated to require exact retained working values and visible Full Log fallback; source/tune retirement and stale-analysis rejection remain enforced. Initial failure evidence is in browser-initial/.

Initial typecheck caught optional A/B values not narrowed by a validation helper; corrected explicit post-validation non-null assertions, preserving rejection of missing values. Initial native Enter driver omitted the normal carriage-return keypress payload; the driver was corrected rather than adding an application key workaround or relaxing assertions. Initial evidence is retained in typecheck-initial.log and native-driver-initial.json. Local browser ports required sandbox escalation; production application permissions/configuration were not changed.

## Performance and limitations

No extra file I/O, decoding, analysis, full-log pass or storage operation. Work scales with the number of saved ranges, not sample count. Existing Logger loading, source cache, analysis math, Brush/editing and full-recording retention remain unchanged.

Manual UI/hardware acceptance remains required. The original approximately 1.2 GB MLG and user hardware were unavailable; no original-file loading latency claim. Ranges without IDs intentionally use conservative semantic matching; a saved range whose bounds change must be reselected. No timeline dragging, saved-range editing or density calculation is added.

Stop after local commit/validation. Group 9 visual parity/precision and Group 10 final/manual acceptance remain separate.

## Final validation

Production build/typecheck passed. Unit suite: 925 tests /137 files passed. Full Chromium: 1,120 checks /138 result groups passed, 560 per mode. Seven new controller and two native-keyboard cases per mode are included in that total. Focused runs also pass those cases; do not add them to unique full counts. Responsive screenshots and the actual fixture-range captures (`timeline-staged.png`, `timeline-fallback.png`) were inspected for unavailable-source layout, distinct colors, selection and shared-axis alignment. `git diff --check` passed. The initial full-gate legacy-contract mismatch and the pre-alignment passing run are retained separately; no timeout relaxation or disabled check. Final logs/results and handoff are in `/workspace/epicscope-v50-next-group8-validation/`.
