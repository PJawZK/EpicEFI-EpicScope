# VE Analyzer v50 manual acceptance findings

Branch: `ui/ve-analyzer-v50-reconcile`

These findings come from the first hands-on production-port test against the frozen v50 reference. They are acceptance requirements for the VE Analyzer branch before the final Codex audit/PR. They do not authorize merging to `main`.

## Confirmed working

- File loading works.
- Loaded sources reach Analyzer.
- VE Analyzer renders.

## Table interaction requirements

The production port must use one shared table-editing interaction core wherever VE Analyzer exposes editable tables. Domain values remain owned by semantic adapters; selection, pins, Brush gesture state and tool configuration do not become tune-domain truth.

Required behavior:

1. Single click selects one cell.
2. Shift-click and drag select rectangular ranges; a normal new single selection replaces the previous selection.
3. After selecting a cell/range, typing a numeric value immediately starts replacement with live preview. F2 is optional compatibility, not a required path.
4. Clicking another cell while a direct edit is active commits the previous typed value, clears the previous selection and selects the new cell in the same gesture.
5. Delete clears the selected working value(s) to no value/undefined where the table domain permits it. Revert remains a separate explicit command.
6. Each editable surface retains an original/baseline value snapshot for the current authority. Unchanged text stays normal; committed values lower than baseline use blue text; committed values higher than baseline use red text. A new semantic table authority establishes a new baseline.
7. Brush activation/stroke must not retain stale highlighted selection. The current weighted Brush footprint must be visibly highlighted so the user can see which cells the next pulse can affect.
8. Brush remains the v50 continuous spray interaction: hold accumulates, drag sweeps, Shift reverses, wheel changes radius, pins are skipped, one stroke is one undo transaction.
9. +/- must change eligible selected values by the configured increment and remain one transaction.
10. Interpolation must fill undefined/none cells between valid anchors. H/V require valid endpoints (plus pinned interior anchors); undefined interior cells are valid interpolation targets. Shape mode may use finite outside neighbors as tangent context but must not fail merely because optional outside context is undefined. 2D Bilinear must work from four valid corners with undefined interior/edge cells; Boundary Surface may synthesize missing edge samples from edge endpoints rather than failing the whole command.
11. The both-directions interpolation tool uses the frozen v50 both-directions icon, not the text `2D`.
12. Table tools use the frozen v50 SVG icon family for Undo, Redo, +/-, Pin, Brush, H/V/Both interpolation, Smooth, Clear and Revert.
13. This established icon family is the VE Analyzer authority now and is intended to become the wider EpicScope icon vocabulary later, after VE Analyzer is correct.

## VE proposal / evidence interaction

Normal VE-table cell selection/editing must not be intercepted by Cell Evidence. Cell Evidence remains a separate inspector/tool: selecting a cell updates the selected semantic cell, and opening Evidence is an explicit action. The frozen prototype intent is a persistent/movable Cell Evidence inspector that can stay open while selection changes.

The VE/proposal table must be wired to the same shared edit core rather than retaining evidence-popup-only cell interaction. Its edits are review/working proposal state; they do not silently mutate the source MSQ or write/burn an ECU.

## Lambda Delay duplication

Lambda Delay currently exposes overlapping legacy/shared editing behavior. Production should have one editing owner only. The shared table-edit controller is the input owner; the legacy v5 inline editor/selection listeners must be retired from the active path once parity is covered.

## Scope setup

The Scope setup disclosure must not contain another select/dropdown. The disclosure itself is the one menu; its body is a direct list of the currently available semantic scope choices (Full Log, Current A/B when available, and saved Logger ranges when available) matching the frozen HTML approach.

If only Full Log exists, the menu simply contains that one direct choice.

## Popup/dropdown placement

VE Analyzer popovers/tool-configuration menus must choose their opening direction from available viewport space. Lower controls should open upward when there is insufficient room below; upper controls should open downward when that is the available direction. Use one positioning policy rather than multiple competing menu-placement systems.

## Architecture boundary

`ve-table-interaction.ts` / the shared DOM interaction controller are the reusable table-edit core. VE Proposal, Target (when editing is exposed), and Lambda Delay should use adapters into that one core rather than separate gesture/edit implementations. Broader app-wide adoption is deferred until the VE Analyzer implementation is correct and accepted.
