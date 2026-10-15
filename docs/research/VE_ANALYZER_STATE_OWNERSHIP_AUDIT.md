# VE Analyzer state ownership audit

Date: 2026-10-15

This note records the architectural findings from the VE Analyzer regression investigation around PRs #442-#447.

## Trigger

After cell-evidence/Logger navigation was added, attempts to preserve VE result rendering across Logger -> Analyzer round trips caused an Analyzer-entry freeze/regression. The immediate failed continuity implementation was rolled back, then the complete VE render/lifecycle stack was audited.

Known-good behavioral reference before the continuity experiments:

- `fd21e4d4a390a4f6607d0290ef273749fc7fd915`

## Main findings

### 1. Base v2 lifecycle is destructive

`ve-analyzer-view-v2.ts` owns the real VE analysis state:

- `result`
- `proposal`
- `delayDiscovery`
- `delayRecommendation`
- `workingDelayTable`
- selected delay state

`setContext()` and `setTuneModel()` call `rebuild()`, and `rebuild()` clears those values before recreating the UI.

Therefore a navigation/context refresh is not merely a view refresh; it destroys the VE analysis session.

Long-term direction: source/tune authority changes should explicitly invalidate state, while ordinary view navigation should not.

### 2. Rendered DOM had become both input and output

The initial Result View implementation in v7 parsed cell title/text, then overwrote the same text with another result representation. Reapplying another view could therefore consume the previous view's output instead of authoritative VE/proposal state.

Symptoms included:

- unchanged VE values turning into `—` in alternate result views;
- switching back losing the original/proposed value;
- precision changing after view switches.

PR #446 introduced a lightweight authoritative render snapshot. It captures fresh v2 table output only when the table is replaced, restores that input before v7 performs a user result-view switch, and repairs exact source/proposal precision/fallback afterward. It does not intercept Analyzer lifecycle calls or recompute analysis.

### 3. PR #442 duplicated result rendering

The old continuity layer installed another full-table renderer outside v7. It could run after:

- `setContext()`;
- `setTuneModel()`;
- `refresh()`;
- result-view changes;
- table replacement.

That doubled work already performed by v7 and sat on top of a rebuild-heavy lifecycle. It was removed in PR #445.

Rule going forward: there must be one result-table renderer/owner.

### 4. Logger has a usable source identity anchor

`logger-page.ts` caches `analysisChannels()` and invalidates that cache when the loaded source/catalog changes.

That means the `channels` array identity from `LoggerAnalysisContext` is a meaningful source revision key. It is safer than comparing only channel names/sample counts/timestamps.

PR #447 uses:

- cached channel-array identity as the primary source identity;
- unchanged A/B authority;
- unchanged saved ranges;
- unchanged trace extent;

to recognize a same-source Logger round trip.

Only redundant `setContext()` and identical `setTuneModel()` calls are suppressed. `refresh()` is never suppressed. No DOM work occurs in this continuity guard.

This also means two different logs with identical dimensions do not compare equal merely because they look the same.

### 5. v4 contained dead delay-editor functionality

v4 created a bulk lambda-delay editor and attached selection/event behavior. v5 then immediately removed that DOM and replaced it with the inline editor.

PR #445 removed the dead v4 bulk editor and deprecated synchronous `DOMSubtreeModified` handling. v4 now owns only lambda-delay workflow status; v5 owns delay-cell selection/editing.

### 6. Global VE UI refinement was also rewriting result text

`ve-analyzer-ui-refinements.ts` compacted measured-proposal cells by rewriting their text. That created another presentation owner outside v7.

PR #446 removed that text mutation. The global refinement layer now handles layout/accessibility/help only; VE result values remain owned by the result renderer.

## Remaining architectural debt

### A. Cell evidence recomputes the VE analysis

`ve-analyzer-cell-evidence.ts` currently reloads traces and independently rebuilds:

- qualification;
- delay-table representation;
- VE evidence map;
- VE proposal.

This is lazy/cached, so it is not the Analyzer-entry freeze cause, but it duplicates analysis logic and can drift from the actual Run Analysis result.

Target design: v2/session state should expose the retained `VeEvidenceMapResult` and `VeProposalResult` directly to the cell evidence UI.

### B. Cell evidence reconstructs working delay state from DOM

`workingDelayTableFromDom()` recreates a `VeDelayTable` from rendered cells and necessarily loses authoritative metadata such as direct source events and original confidence/event counts.

Target design: expose the actual working `VeDelayTable` from session state.

### C. v3 qualification uses one-shot `qualificationLoadPending`

Quick qualification is applied by setting a flag before Run Analysis, then consuming that flag on the next `loadTraces()` call.

This relies on async call ordering and becomes fragile as more analysis consumers are added.

Target design: qualification must be an explicit parameter of the VE analysis request/session, not hidden state in a wrapped loader.

### D. `Custom` currently disables normal state exclusions

Both the primary VE path and cell-evidence path use behavior equivalent to:

`useStateExclusions = preset !== 'custom'`

So `Custom` implicitly disables DFCO/fuel-cut/AE/decel exclusion.

Before the planned MLV-style custom formula exclusion feature is implemented, this should be redesigned so Custom means explicit user-selected qualification rules rather than silently turning normal safety exclusions off.

### E. Wrapper chain remains larger than ideal

Current historical chain still includes v2 through v9. The immediate conflicting/dead responsibilities have been reduced, but long-term consolidation should move toward explicit modules:

1. VE session/state
2. analysis orchestration
3. one table/result renderer
4. review/evidence UI

The goal is not cosmetic renaming. Consolidation should happen only when a responsibility can be moved without changing behavior.

## Implemented stabilization sequence

- PR #445: remove duplicate continuity renderer, dead v4 bulk editor, `DOMSubtreeModified`
- PR #446: authoritative render snapshot; stop global proposal-text rewriting
- PR #447: source-identity-aware same-source Logger round-trip continuity

Merged main after PR #447:

- `4edd39880eea84f8e18c05354e3636a177b04346`

## Recommended next engineering order

1. Validate Analyzer entry, Result View switching, and Logger -> Analyzer round-trip behavior in the browser with a real VE analysis.
2. Expose authoritative VE session state (`result`, `proposal`, `workingDelayTable`) through a proper state/controller API.
3. Change cell evidence to consume that retained state instead of recalculating analysis or reconstructing delay state from DOM.
4. Replace one-shot qualification-loader state with explicit qualification input.
5. Define Custom qualification semantics and then add the advanced math-formula exclusion feature.
6. Only after state ownership is stable, proceed to proposal edit/revert, application strength, and final diff/export workflow.

## Invariants

- Run Analysis produces a proposal, never tune mutation.
- Result View is presentation only and must not alter analysis state.
- Logger navigation must not erase a valid VE session unless source/scope/tune authority actually changed.
- A different source must always invalidate retained VE results even if its dimensions happen to match.
- One component owns result-table rendering.
- Evidence review should consume the same retained analysis result that produced the visible proposal.
