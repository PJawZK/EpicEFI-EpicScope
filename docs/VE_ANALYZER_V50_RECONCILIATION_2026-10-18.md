# VE Analyzer v50 functional reconciliation — 2026-10-18

Branch: `ui/ve-analyzer-v50-reconcile`. Frozen v50 HTML is **behavior/visual reference**, not production JavaScript authority. Do not merge to `main` without explicit approval.

## User-reported regressions and production corrections

- **Missing / duplicated compact-header controls:** Literal `\\n` inside two TypeScript comments had swallowed the initial action attachment and toolbar visibility assignment. Restored real statements; retained semantic controls across v7 refresh. Exactly one visible Cell Evidence action; its existing semantic owner remains registered.
- **Target table without edit tools:** Target now has a separate session-local working-value owner and a shared selection/Brush/interpolation/history adapter. It does **not** alias VE Proposal. The original tune stays immutable. Mixture assessment, table display, and next analysis run consume the Target working values. Target Clear resets selected cells to source baseline (no invalid empty target cells). No ECU write/export is introduced.
- **Greyed selection tools:** Selection-dependent tools are accessible for configuration before selection. An actual edit still requires selected cells; Undo/Redo continue reflecting real history.
- **Advanced / Exclusions / Inputs showed the same content:** The `data-ve-tool-mode` selector now applies to the actual outer tool panel. A browser assertion opens all three and verifies relevant sections are scoped correctly. The Advanced semantic subtree, selectors and readiness body remain in place so v2 rebuild remains valid.
- **Popup direction / clipping:** Setup groups and contextual tool option menus now use viewport-aware positioning. Tool configuration measures after its fields have been inserted. Browser checks cover viewport containment at multiple widths.
- **Table dark bands / oversized whitespace:** Removed forced table element height. Measured row sizing fills the available table wrapper while preserving table-cell paint boundaries.
- **Target selector sizing:** Reserved native caret spacing and bounded selector width.
- **Stray bottom divider:** Suppressed an empty legacy content/summary shell only. Real mixture warnings are not decorative and remain visible.

## Validation and limitations

- Browser regressions cover compact header attachment, visible Evidence delegation, semantic reattachment, mode-separated tools, responsive menu bounds, Target working edit + Undo + VE isolation, and table-row viewport use.
- Full CI at `3f4bc26` passed (validate and staged/fallback Chromium) before the final Target Clear-label correction; rerun CI on the new head.
- Browser visual artifacts primarily use synthetic 16×16 tables; the user's real 32×32 VE/Target tables still require local manual acceptance.
- The UI is not considered finally accepted until the user tests real table selection, tool operations, modes, warnings and popup opening directions.
- Brush painting performance is **deferred** until UI/interaction acceptance.
