# VE Analyzer frozen v50 feature/function gap audit — 2026-10-18

Reference: `EpicScope_VE_Analyzer_Interactive_Concept_v50_frozen_port_candidate(2).html` (local frozen HTML file), compared against the production `ui/ve-analyzer-v50-reconcile` TypeScript/CSS owners. The prototype is a **UI/interaction reference**, not permission to import its standalone JavaScript, mock analysis authority, or write a tune.

## Parity classification
- **Present / reconciled:** 32×32 VE and Target workbench rendering; single/split modes; target selector; analysis setup; Logger extent/open-in-Logger; run/readiness; per-cell VE evidence overlays; working Lambda Delay discover/use/load/save; shared cell selection/editing, Undo/Redo, +/−, Pin, Brush, Smooth, H/V/Both interpolation; Basic result view options; contextual table-tool configuration; view-local Help/Settings through existing app controls.
- **Partial or visually divergent:** Table delta-color and cell-state legibility, gradient contrast, tooltip/state symbols; read-only Result View editing-tool affordances; evidence button no-selection response; compact floating tool placement/typography; split header alignment; scope choices depend on Logger range authority, not prototype fixtures; persistent movable Cell Evidence inspector; result-completion summary workflow; status explanations. Prototype hover interactions and multiple popup menu conventions are not fully parity-tested.
- **Missing from v50 presentation:** Dedicated exclusion rule list and rule CRUD/editor (`exclusionNew`, `exclusionSave`, `exclusionReset`, `exclusionDelete`), combined condition builder and expression helpers; production Exclusions currently exposes state-channel mapping only. v50's own pinned/snappable/maximizable/free-movable utility windows (Inputs, Advanced, Exclusions, Delay, Evidence, Logger, Help, Settings) are replaced by simpler centered tool surfaces. Prototype `rejectBtn`, `summaryDialog` with Close/View Proposal and corresponding user flow are not fully reproduced in v50. Standalone prototype Logger contributing-samples floating window is not reproduced as an identical window (production Logger handoff exists). Prototype settings/preferences layout and full reset differ from existing EpicScope global settings.
- **Not yet enabled by design:** Save reviewed VE proposal to MSQ or ECU/shim. Needs destination-specific format/scaling, source revision checks, explicit review/confirmation, write/readback reconciliation, cancellation/recovery and hardware-safe permission gates. A cosmetic Save button must not precede that implementation. Brush performance optimization deferred until UI acceptance.

## Specific current-state decisions
1. Keep table-edit toolbar visible across alternate Result Views, but **disable mutation commands** on read-only metric views. Exposing editable metrics by routing them to VE Proposal would be incorrect. The edit commands work on Proposed VE.
2. Cell Evidence requires selecting a VE cell; give visible no-selection guidance instead of a silent click.
3. Table heatmap remains independent of a semantic delta marker: lower/higher text gets a dark glyph halo; pinned gets fixed cyan symbol without border. Other corner-state marker colors and evidence legend need a dedicated coordinated fixed-palette pass against all DOM states.
4. Prototype scope menu is a direct list: Full Log, A/B and saved Logger ranges only when those ranges exist. Do not invent options in a loaded log that supplies only Full Log.

## Follow-up acceptance plan
- Capture current 32×32 real-log screenshots with normal, lower/higher text, pinned, evidence, brush and split, plus multiple Result Views.
- Complete fixed-palette state marker inventory, full browser regression for read-only toolbar presentation and Cell Evidence no-selection.
- Bring Exclusions rule editing across only after matching EpicScope's exclusion-domain ownership; do not copy prototype expression evaluator as authority.
- Review/preserve semantic table changes when switching between Result Views and explicitly show read-only state.
- Finish remaining summary/reject workflow, window docking as separate UX parity tasks; validate with 1024/1366/1920 and actual 32×32 data.
- Finally prioritize Brush performance and write/export implementation as separate gated projects.

Do not merge to `main` without explicit approval.
