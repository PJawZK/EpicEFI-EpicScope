# VE v50 — new plan Group 5 authority and Cell Evidence

Base: `cc13c9b1f47bd5f2feae74050b549c2b918e4f8d`, branch `fix/ve-v50-reviewed-groups-1-7`. Final result SHA and validation are recorded under `/workspace/epicscope-v50-next-group5-validation/REPORT.md`. No push, main merge or ECU write/Burn is included.

## Established defect and approach

Real Chromium reproduced an on-target actual/target mixture with +5% applied fuel trim displaying `Mixture error +5%`. The retained evidence correctly describes a +5% base-VE correction, not raw measured mixture error. No raw metric can safely be recovered by subtracting trim from the weighted median. The correction is a source-label clarification, without another evidence calculation.

Code inspection also established that the editable proposal table projects the working review owner, while cached Cell Evidence showed only generated proposal values. Both values were authoritative for different purposes, but their shared proposed/change wording concealed the distinction. Group5 makes these authorities explicit and projects working values separately.

## Result Views

| Previous label | New label | Numerical authority |
|---|---|---|
| Proposed VE | Working VE | Existing editable review-owner snapshot |
| VE change | Analysis VE change | Retained generated analysis change from original tune; weak/withheld states retain raw candidate change |
| VE change % | Analysis VE change % | Same generated/raw-candidate policy, in percent |
| Mixture error % | Base-VE correction % | Retained correction evidence including configured applied-fuel-trim handling |

The internal keys `proposal`, `change`, `change-percent` and `mixture-error` stay unchanged. No stored selection/schema migration or loss of a Result View is introduced. Samples, weight, confidence, spread and working-delay sources remain unchanged.

Existing missing-metric fallback to original VE is preserved. Header guidance and per-value hover text identify that fallback as original VE rather than a value in sample/percent/delay units. Working values and valid generated/delay metrics identify their own source too. Titles are patched in the existing presentation pass only when changed; no additional table scan or observer is introduced.

## Cell Evidence

The popup explicitly shows:

- Original VE from the retained source tune entry.
- Generated proposed VE, raw evidence candidate and analysis changes from retained primary analysis.
- Analysis change basis: accepted generated proposal, unaccepted raw candidate, or no candidate.
- Base-VE correction and whether applied fuel trim compensation was used.
- Working VE/change/change percent from the existing proposal review owner, computed against original VE.

`veWorkingCellMetrics` is a pure projection in the existing typed table-projection module. It retains numerical precision, distinguishes zero from absence, leaves cleared working values unavailable and avoids undefined percent changes at original VE0. It does not parse rendered table text or mutate an owner.

Working review fields are patched when the existing root-local `ve-proposal-table-rendered` owner event is emitted. Only the three fields in the currently shown detail are updated. Cached details update on reopening too. The local listener shares the popup's existing AbortController and is removed on disposal; inactive/hidden popups do not do presentation work. No new global listener, observer, lifecycle wrapper or controller owner was added.

The primary/evidence grid, strongest-visit calculation, Logger action and other cached details remain retained across working edits and Result Views. Semantic source/tune/scope/qualification/delay/new-run changes continue to invalidate through the existing primary-analysis notification. Private inline/Brush previews remain private until owner publication; the popup reports committed working state rather than reading preview text.

## Delay evidence provenance

An interpolated recommendation may retain sparse direct local events that were insufficient to make that cell measured. Those events are real and remain preserved. The interface comment is corrected accordingly. Delay-cell state, event list, quantile/spread text and tooltips now identify direct local evidence separately from the generated recommendation and editable working value. A regression demonstrates an interpolated200ms recommendation retaining one direct500ms event and local P10/P90=500ms; no synthetic events are created or real events discarded.

## Validation and acceptance

Focused browser coverage exercises on-target compensated correction, source fallback identification, live committed-working projection, generated/source immutability, all Result Views, cleared/zero working cells, retained DOM/read counts and real semantic invalidation. A withheld raw candidate is not presented as an accepted proposal: source/working70, raw candidate73.5, generated proposal unavailable, raw analysis change+3.5.

Full build/typecheck, unit tests and the complete browser gate are required; final outcomes are in the report directory. Earlier Group4 numerical references and Brush/editing/lifecycle/caching coverage remain required. The exact frozen HTML and original approximately1.2GB user MLG/hardware are unavailable, so exact visual parity and target-machine latency are not claimed.

Manual acceptance should check the renamed Result View options, working/generated comparisons in the open popup, empty/zero edits, tooltip fallback meaning and direct-event/recommendation distinction. Review label/height/readability changes against the real UI. No analysis formula, quantile convention, proposal limit, delay approximation, snapping, state exclusion or stability policy changed. B02 and stability/continuity decisions remain pending; Lambda loading workflow is Group6, completion workflow/focus Group7, Logger timeline Group8 and visual parity Group9.

Stop for review before Group6.
