# Follow-up Group 2 — Interpolation strength correction

Baseline: `df8e67f4a587181ba394e6a7edfd7c49439006e1`, the published recovery lineage. Date: 2026-10-25. Scope: Working VE and Lambda Delay interpolation only. Group 1's reported dropdown closure remains unconfirmed; Groups 3–6 are separate. No main merge, automatic analysis, ECU write or Burn.

## Reproduction and cause

The shared `TableInteractionSession.interpolate` calculated the interpolated target, blended it with the existing value using strength, then clamped that **blended result** into the anchor/boundary range. With endpoints200/150, populated interior cells100 and strength0.5, every interior blended value is below150 and was forced to150. The32-cell horizontal and vertical reproductions fail for both Linear and Shape with the original default clamp enabled.

This reproduces the reported flat fill under a controlled initial-value configuration. The user's exact intermediate values/file were unavailable; it is not a claim to have reproduced the original recording/workspace. In Chromium the original first interior Working VE result was150 instead of149.19354838709677. Nine newly added unit cases failed on the baseline, including two-dimensional strength and neighbor-informed shape cases. Initial red results are preserved in `/workspace/epicscope-v50-followup-group2/`.

## Correction and current contract

Clamp the **computed interpolation target first**, then blend once from the unchanged original value:

```text
target = clampEnabled ? bound(interpolated, minAnchor, maxAnchor) : interpolated
result = original + strength × (target − original)
```

This single correction applies at the existing shared editing owner; neither table adapter has a new interpolation implementation. Existing physical axes, pin anchors, sparse support, transactions, source-tune separation and history owners are preserved. Popup help and clamp labels describe target clamping explicitly.

- Strength0: no edit/publication, including blank cells.
- Strength0.5: halfway from the original finite value to the bounded target.
- Strength1: the complete bounded target, retaining previous full-strength behavior.
- Undefined cells have no numeric origin: positive strength fills them with the complete bounded target, not a blend from an invented zero.
- Selected endpoints and pinned cells retain their values. H/V pins remain interior anchors. Pins in a2D selection remain protected without becoming extra bilinear corner constraints.
- A both-directions command on a single row/column retains the existing H/V delegation, including the current1D method and strength.
- The blended value can legitimately remain outside the anchor range while approaching it. This is intentional strength preservation, not failed clamping.

Existing semantic policies remain: VE edits are working review values and do not mutate source MSQ or generated analysis; delay edits invalidate dependent evidence through their current owner. Delay's same-displayed-millisecond recommendation snap is unchanged. No new listeners, observers, wrappers, workers or full-log work.

## Numerical references and method audit

| Case | Expected result after correction |
|---|---|
| Values200/100/150, halfway coordinate, strength0.5 |200/137.5/150 |
|32 equally spaced cells, endpoints200/150, interiors100, strength0.5 | Interior index i:150−25i/31; first149.19354838709677, last interior125.80645161290323; endpoints unchanged |
| Original100, physical linear target12.5, strength0.25 |78.125 with clamp either on or off (R36) |
| Outside support0/1/(selected interior100)/3/6 at equally spaced coordinates | Full linear target2; neighbor-informed PCHIP target63/34; half-strength results51 and50.9264705882353 |
|3×3 corners200/150/200/150, edge midpoints180(top/bottom),200(left),150(right), center100 | Full bilinear center175; boundary-surface center180; half-strength centers137.5 and140 |
| Boundary target175 with boundary range10–100, original center1000, strength0.5 | Clamp on550; clamp off587.5 |

Linear and Shape **should match with only two anchors and no useful outside context**, or with collinear support. Shape uses the implemented PCHIP harmonic-mean slopes and monotonicity constraints; the curved reference proves a different result without inventing curvature for a two-point span. Bilinear uses four corners; Boundary Surface also retains finite edge samples and synthesizes absent edge samples from endpoint geometry. Existing sparse2D, uneven/descending physical-axis and invalid-anchor regressions remain required.

R36 deliberately changes the old documented post-blend clamp policy in response to the user's strength requirement. The shared reference now expects78.125 for both clamp settings instead of78.125/20. It is an explained numerical change, not tolerance relaxation. Other reference expectations remain unchanged. Group3/Group10 audit records describe historical baselines; this document supersedes only their clamp/strength policy.

## Validation and stop boundary

New unit regressions cover32-cell H/V Linear/Shape at0/0.5/1, both2D methods at0/0.5/1, target overshoot with clamp on/off, degenerate2D delegation and curved H/V support. The added browser suite drives the real configuration controls, tool actions and both production semantic adapters on32×32 tables. It verifies exact values, per-owner single publication/no-op, correct analytical invalidation, Undo/Redo, source tune immutability and zero log reads. It is registered in the full staged and Worker-disabled gate. Native menu behavior remains Group1; these controller interaction checks use dispatched browser events.

Final gate results and exact commit SHA are recorded in `/workspace/epicscope-v50-followup-group2/REPORT.md` and `HANDOFF.md`. Synthetic numerical/table fixtures establish the tested interpolation contracts, not original-log latency or hardware acceptance. Stop after this group for review; no automatic publishing or next-group implementation.

Final results: production build/typecheck passed (existing bundle-size advisory);954 unit tests across138 files passed;1,252 Chromium checks across144 result groups passed (626 per mode, including58 new interpolation checks per mode). All16 built-production smoke checks passed, including native pointer/keyboard entry and half-strength Working VE interpolation in both modes. The production native test verifies displayed200/137.5/150; the deeper controller suite separately verifies exact semantic values in both tables. Production screenshot reviewed; git diff --check passed. No skipped cases or relaxed existing timeouts.
