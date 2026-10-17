# VE Analyzer v50 reconciliation status

Branch: `ui/ve-analyzer-v50-reconcile`

Current detailed continuation handoff: `docs/VE_ANALYZER_V50_CHAT_HANDOFF_2026-10-17.md`.

Validated production-code checkpoint: `d9cf33b51a7d0adf3d922867916bcc0ae0f81f0c` (`Validate live Brush preview through full Web CI`).

This branch is deliberately isolated from `main`. It is the post-Codex reconciliation branch for the frozen v50 VE Analyzer presentation and shared table interaction work. No merge to `main` is authorized before user UI acceptance, final Codex branch audit, full revalidation, final diff/PR inspection and explicit approval.

## Current state

The frozen v50 prototype remains the visual/interaction contract; production adapts it behind existing EpicScope TypeScript/controller ownership instead of porting standalone prototype infrastructure literally.

Implemented/reconciled on this branch:

- v50 workbench/presentation and focused styles;
- one shared table-edit interaction core with semantic adapters for Lambda Delay and VE Proposal/review state;
- direct typing without requiring F2, rectangular/multi selection, Undo/Redo, configurable `+/-`, Smooth, H/V/Both interpolation, Pin, Brush, Clear/Revert where supported;
- Delete = clear/none where the domain permits it; Revert is separate;
- MLV-style baseline memory presentation: unchanged normal, lower blue, higher red;
- Brush clears stale normal selection and shows a prospective weighted footprint;
- sparse interpolation accepts undefined interior cells when valid anchors exist;
- frozen v50 table-tool SVG iconography, including the both-directions icon rather than literal `2D`;
- direct-list Scope setup instead of a nested select/dropdown;
- one viewport-aware popup placement policy;
- dedicated Lambda-delay surface authority generation for stale-transaction rejection;
- Lambda Result View consumes semantic Lambda authority rather than reconstructing the delay surface from DOM;
- authoritative whole-source Logger extent plus explicit Analyzer -> Logger range handoff;
- physical-axis spacing-aware interpolation, including nonuniform monotone/PCHIP-style shape interpolation;
- reversed visual load-row Arrow navigation acceptance;
- persisted tool preferences while selection, pins and active Brush remain session-only;
- production controller chain no longer installs the transitional v5 Lambda editor; the shared adapter is the active edit owner;
- responsive browser acceptance at 1024/1366/1920 px.

Source MSQ/TuneModel values remain immutable during VE Proposal/review edits.

## Manual acceptance progression

The first hands-on pass confirmed file loading, Analyzer publication and VE Analyzer rendering, but exposed duplicate/competing table interaction behavior. Those findings established the current shared-table contract and were fixed before the performance pass.

The next hands-on pass found the interactions functionally correct but very slow. The hot path was reduced by caching rendered coordinates, separating lightweight selection/Brush decoration from full semantic value decoration, avoiding unchanged DOM writes and caching Lambda working-value snapshots per authority generation.

The user then confirmed that performance was **much better**.

The remaining Brush usability issue was lack of live numeric feedback during an active stroke. At `d9cf33b...` this was fixed without returning to whole-table refreshes:

- affected numeric values update continuously during the stroke;
- stationary pulses visibly accumulate;
- Brush footprint remains visible;
- lower/higher baseline-memory color updates during preview;
- Shift reverse visibly changes the pending values in the opposite direction;
- pointer-up commits one semantic edit / one Undo transaction;
- cancel restores the pre-stroke presentation/state;
- only changed pending cells are reported and DOM-updated;
- rapid updates are coalesced with `requestAnimationFrame`;
- semantic authority remains unchanged during the stroke and changes only on commit;
- direct multi-cell typing preview updates the existing value node rather than replacing VE cell internal DOM.

Dedicated automated acceptance verifies visible-preview-versus-semantic-authority separation for both VE Proposal and Lambda Delay.

## Validation at the production-code checkpoint

At `d9cf33b...` the complete gate was green:

- TypeScript type-check;
- full unit suite;
- production build;
- staged Chromium acceptance;
- Worker-disabled fallback Chromium acceptance.

Documentation commits after `d9cf33b...` do not change that validated production-code tree.

## Known remaining correctness target

A deeper audit identified a Result View ownership problem that must be verified/fixed if still present before final merge: mutable rendered VE text has historically been reparsed as source data while Result View and app-level UI refinements both rewrite that text.

The preferred fix is model/owner-derived stable cell metadata or equivalent semantic state, never mutable `textContent`. Do not use DOM row ordinal because load rows are visually reversed. Base/fallback VE must recover its original heat level rather than neutral 0.5, while a legitimate Lambda Delay metric remains valid even when VE evidence is absent.

Add a full-app Chromium regression with UI refinements active that repeatedly cycles Proposal, Change, Change %, Mixture error, Samples, Weight, Confidence, Spread, Delay and back to Proposal, checking semantic/original values for measured, weak/withheld, evidence-only and no-evidence cells.

See `docs/VE_ANALYZER_V50_CHAT_HANDOFF_2026-10-17.md` for the detailed audit route and merge plan.

## Remaining gates

1. user hands-on verification of the latest Brush/performance checkpoint;
2. fix any evidence-backed interaction defects;
3. verify/fix the Result View source-authority issue and add the missing full-stack regression if applicable;
4. rerun the complete automated/browser gate;
5. finish visual proportions/hierarchy against frozen v50 without changing accepted interaction semantics;
6. user final UI acceptance;
7. final Codex branch audit against current `main`;
8. apply only justified fixes/cleanup and revalidate;
9. final diff/PR inspection;
10. merge only after explicit approval.

`main` remains untouched by the v50 changes.
