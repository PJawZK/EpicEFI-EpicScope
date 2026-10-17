# VE Analyzer v50 — current chat handoff (2026-10-17)

Branch: `ui/ve-analyzer-v50-reconcile`

Validated production-code checkpoint: `d9cf33b51a7d0adf3d922867916bcc0ae0f81f0c` (`Validate live Brush preview through full Web CI`).

This document records the current state reached through the VE Analyzer v50 production-integration work and the user hands-on acceptance loop. It is the continuation boundary for this branch. The branch remains isolated from `main`; no v50 merge is authorized until manual acceptance, a final Codex branch audit, revalidation, final diff review, and explicit merge approval.

## Frozen reference and design authority

The frozen v50 HTML remains the visual/interaction reference, not a production implementation to copy literally. Production must adapt its behavior and hierarchy behind EpicScope's existing TypeScript/controller ownership.

The accepted design direction is:

- uncluttered but fully functional workbench presentation;
- one semantic owner for each domain state;
- DOM text is presentation, never application/tune authority;
- shared interaction infrastructure where behavior is genuinely common;
- table editing should use one shared table-edit core with domain adapters rather than separate gesture systems per table;
- the v50 SVG icon family is the current VE Analyzer table-tool authority and is a candidate for wider EpicScope use after VE Analyzer is accepted;
- no standalone prototype floating-window framework or synthetic prototype state should become production truth.

The v50 table-edit vocabulary, where applicable, is single/range/additive selection, direct numeric typing, undo/redo, configurable `+/-`, Smooth, H/V/Both interpolation, Pin, continuous spray Brush, Clear/Revert where semantically supported, and contextual tool configuration. Bulk commands/strokes remain one transaction.

## Reconciliation and ownership state

The v50 port was first developed in isolation, then reconciled onto post-Codex `main` in `ui/ve-analyzer-v50-reconcile`. The production branch now contains:

- the v50 presentation layer and focused VE styles;
- shared table interaction core and DOM controller;
- semantic adapters for Lambda Delay and VE Proposal/review editing;
- dedicated Lambda-delay surface authority generation for stale-edit rejection;
- semantic Lambda Delay Result View input rather than reconstructing the delay table from rendered DOM;
- authoritative whole-source Logger time extent plus explicit Analyzer -> Logger range handoff;
- persisted table-tool preferences while selection, pins and active Brush remain session-only;
- spacing-aware interpolation using physical axes when provided;
- explicit visual-row keyboard navigation so reversed load-axis rendering does not invert Up/Down behavior;
- responsive browser acceptance at 1024/1366/1920 px;
- no live transitional v5 Lambda editor in the production controller chain; the shared interaction owner is the active production edit path.

Source MSQ/TuneModel values remain immutable during VE Proposal/review edits. Proposal edits are working/review state until the later explicit write/export path is implemented.

## Hands-on acceptance findings and resulting contract

The first production-port test confirmed file loading, Analyzer publication and VE Analyzer rendering. It also exposed interaction mismatches that are now part of the accepted contract:

1. normal table click selects a cell; it must not be hijacked by Cell Evidence;
2. Cell Evidence is an explicit tool/inspector action;
3. single click replaces the previous normal selection;
4. Shift-click and drag create rectangular ranges; additive behavior is explicit rather than accidental selection accumulation;
5. typing a number directly starts editing/live preview; F2 is optional compatibility only;
6. clicking another cell while typing commits the old edit and selects the new cell in the same gesture;
7. Delete means clear/none where the table domain permits it; Revert is a separate command;
8. baseline-memory presentation follows the MLV-style convention used for this design: unchanged normal text, lower-than-baseline blue, higher-than-baseline red;
9. Brush activation/stroke does not retain stale normal selection;
10. Brush visibly shows the prospective weighted footprint;
11. `+/-` changes values by the configured increment;
12. interpolation must work through undefined/none interior cells when valid anchors exist;
13. Both-direction interpolation uses the established icon rather than literal `2D` text;
14. Scope is a direct list of semantic choices, not a select nested inside another dropdown;
15. popup/dropdown placement uses one viewport-aware up/down positioning policy.

These semantics apply to VE Analyzer editable tables through the shared table core. Wider app adoption is intentionally deferred until the VE implementation is accepted.

## Performance work

The first functional manual pass found the shared table interactions correct but very slow.

Confirmed hot paths included repeated whole-table semantic/value work and DOM decoration on pointer movement, plus repeated Lambda working-value vector reconstruction during per-cell snapshot reads.

The performance pass therefore:

- caches the rendered cell coordinate map for the current rendered table;
- separates lightweight selection/Brush decoration from full semantic value/baseline decoration;
- avoids rewriting unchanged DOM attributes;
- avoids full semantic value/baseline reads during pointer drag, keyboard selection and Brush footprint movement;
- caches the Lambda working-value vector for the current table/revision/authority generation.

The user then confirmed that interaction performance was **much better**.

## Latest checkpoint — live Brush value preview

After the performance pass, the remaining usability defect was that the Brush footprint moved but cell numbers remained visually frozen until pointer-up. That made the faster interaction hard to understand.

This was corrected at validated code checkpoint `d9cf33b51a7d0adf3d922867916bcc0ae0f81f0c`.

During an active Brush stroke now:

- affected cell numbers update continuously while holding/dragging;
- stationary spray pulses visibly accumulate;
- the existing Brush footprint still shows which cells are being affected;
- blue/lower and red/higher baseline-memory state updates during the preview;
- Shift reversal visibly runs the pending values in the opposite direction;
- pointer-up commits the entire stroke once as one semantic edit / one Undo operation;
- cancelling restores pre-stroke presentation/state.

The performance architecture was preserved rather than reverting to whole-table rerendering:

- the generic Brush transaction reports only pending cells whose value actually changed;
- the DOM controller updates only those cells;
- rapid visual updates are coalesced through `requestAnimationFrame`;
- semantic authority remains unchanged during the stroke and changes only on commit;
- direct multi-cell typing preview updates the existing value node instead of destroying/recreating VE cell internal DOM;
- VE Proposal and Lambda Delay keep domain-specific value formatting while the shared interaction core remains domain-neutral.

Automated acceptance explicitly verifies that visible text changes during the active Brush stroke while semantic authority/revision does not, and that pointer-up commits the previewed result once.

At `d9cf33b...`, the complete gate was reported green: TypeScript type-check, unit suite, production build, staged Chromium and Worker-disabled fallback Chromium.

## Known remaining correctness target — Result View source authority

A separate deep audit found an important remaining Result View ownership problem that should be addressed before final merge if it is still present at the current branch head.

The problematic pattern is presentation self-reparse: v7 Result View has historically parsed the currently rendered `main.textContent`, then overwritten that same text with the selected metric. App-level `ve-analyzer-ui-refinements.ts` also mutates VE cell text. Therefore rendered text cannot safely be reused as the original/current VE source.

The confirmed risks are strongest for weak/withheld/evidence-only/no-evidence cells because their titles do not always contain the original `Current` VE value. Repeated Result View switching can therefore lose the original VE value or substitute a previously rendered metric. A related heat presentation bug can neutralize untouched/base-cell heat to 0.5 instead of restoring original VE heat intensity.

The preferred current-architecture fix is stronger than the historical WeakMap-only idea:

- stamp stable model-derived metadata on each fresh VE cell at the v2 render owner (for example semantic cell index/current VE/base heat level);
- make Result View read original/current VE from that stable metadata or directly from equivalent semantic owner state, never from mutable rendered text;
- do not map by DOM row ordinal because UI refinements reverse load-axis row presentation;
- preserve a legitimate Lambda Delay metric even on a VE cell with no VE evidence; the rule is 'show the selected view metric if it exists, otherwise fall back to original VE';
- restore original/base VE heat when the selected view falls back to base VE rather than forcing neutral heat;
- add a full-app Chromium regression with UI refinements active that repeatedly cycles Proposal -> Change -> Change % -> Mixture error -> Samples -> Weight -> Confidence -> Spread -> Delay -> Proposal and verifies visible values against semantic/original data;
- explicitly cover measured, weak/withheld, evidence-only and no-evidence cells.

`readDelaySurface()`-style DOM reconstruction is already removed from the reconciled Lambda path, but the general rule remains: presentation must not become semantic authority.

## Next work / merge gates

Continue on this branch only. The intended order is:

1. user hands-on verification of the `d9cf33b...` Brush live-preview/performance checkpoint;
2. fix any remaining interaction defect supported by that manual test;
3. verify/fix the Result View source-authority issue above and add the missing full-stack view-cycling regression if still applicable;
4. rerun the complete TypeScript/unit/build/staged/fallback browser gate;
5. finish the visual/proportion/hierarchy pass against the frozen v50 reference without changing accepted interaction semantics;
6. user final UI acceptance;
7. final Codex audit of the reconciled branch against current `main`, separating must-fix defects from safe cleanup and deferred redesign;
8. apply only justified changes, rerun the full gate, and repeat user smoke testing if visible behavior changed materially;
9. inspect final diff/PR;
10. merge only after explicit approval.

`main` must remain untouched by this branch until that final process is complete.
