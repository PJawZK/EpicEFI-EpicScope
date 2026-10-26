# Idle Analyzer — standalone HTML integration workstream

**Branch:** `ui/idle-analyzer-html-integration`  
**Base:** EpicScope `main` at `702c880a29baa28b762ac26f7f7ed55ef01239ef` (2026-10-26)  
**Scope:** Offline HTML prototype + design/validation documentation **only**.  
**Explicit boundary:** No modifications to EpicScope production application, runtime, parser, tests, dependencies, release workflows, firmware, or ECU; no merge to `main`.

## Source files

- [Idle Analyzer v3.5.6 reference](Idle_Analyzer_v3_5_6_Reference.html) — accepted compact adaptive workspace, true October 20 embedded MLG evidence, secondary September 30 MLG import, corrected matching-interval finder and chronology warnings.
- [Idle Analyzer v3.5.7 — source navigation](Idle_Analyzer_v3_5_7_Source_Navigation.html) — preserved, offline HTML experiment. Adds two-source timeline navigation and source-labeled detected events without changing the v3.5.6 diagnosis/parser calculations.
- [Idle Analyzer v3.5.8 — A/B region navigation](Idle_Analyzer_v3_5_8_AB_Region_Navigation.html) — latest experimental standalone snapshot: A can create a real manual region at unmarked timeline positions (Alt+click forces one within existing ranges), and both timeline tracks support Home/End/arrow-key navigation. B manual interval selection and source identity remain preserved.
- [Previous functional maturity audit](READINESS_AUDIT_v3_5_6.md) — status and integration cautions established prior to v3.5.7.

The HTML files are **versioned standalone snapshots**. Changes in this branch must remain in these documents while the user evaluates their behavior. Production porting requires separate authorization.

## v3.5.7 changes and observations

1. Compare mode replaces the ordinary single timeline visualization with **A/B source timelines**, each in its own original recording time domain. File identity and relative scale are displayed separately. The main plot still uses normalized relative display time according to the chosen alignment.
2. Clicking within a **second-recording timeline** selects a same-duration **manual B interval** centered on the clicked source time; the A reference remains untouched. Clicking A selects an already defined reference region. Both selections remain user-reviewable; neither implies a tuning improvement.
3. **Detected events & operating windows** displays A/B source-labeled region cards and up to five detected sag events per source. Clicking a card zooms the **shared plot viewport** to the corresponding time. The zoom remains display-only; the actual analysis windows are unchanged by zoom.
4. If the second MLG is unavailable after reopening the standalone file, the second-source timeline identifies that state and offers **Compare sources**. There is no stale or synthetic comparison evidence.
5. The previous automatic comparative candidate-region finder, chrono warnings, graph zoom and peak-preserving rendering remain present.

**Validated in browser (2026-10-26):**
- Chromium with HTML content loaded into an isolated page; no JS errors during same-recording comparison and event-click-to-zoom.
- Full independent `2026-09-30_12.09.28.mlg` imported successfully, revealing nine auto windows; two source timelines rendered correctly.
- Clicking B source at 93% of the track moved B selection to 733.39–745.79 seconds, retaining the original A baseline.
- 390 px width: no document-level horizontal overflow during the same two-log comparison.

**Important:** This is interaction testing, not mathematical approval of every diagnostic mode, user-configurable watch threshold, or derived conclusion. The file still includes independently implemented MLG parsing and illustrative tuning content that must **not** become production authority.

## Current outstanding gaps

- Use real matching INI and MSQ source authority for every table, channel unit, scale, calibration value and firmware-specific behavior.
- Compare mode needs a more robust source manager, optionally two manually selectable A/B intervals, independent source validity, state persistence and repeatable multiple recordings.
- Replace fixed and demo scaffolding with versioned, testable source contracts. Validate MLG CRC/retry semantics against EpicScope production parser.
- Independently test each diagnostic mode, controller terminology, hypotheses, and thresholds against real recordings and alternate conditions.
- Allow graph/evidence selection to open the actual Logger sample/time range when integrated in production; the present standalone Logger action remains a placeholder.
- Do not score reversed chronology, unmatched tests, missing tune identity, or unmeasured mechanical/electrical loads as tune improvement.
- Preserve the no-write/no-Burn boundary until explicit future approval.

## Integration plan — HTML first

1. Continue refining the HTML workflow **on this branch** with explicit acceptance tests and source-labeled evidence.
2. Establish test fixtures/contracts based on existing EpicScope owners: `core/parsers/mlg/*`, `core/analysis/idle-control-diagnostics.ts`, `core/analysis/specialized-analyzers.ts`, `apps/web/src/pages/specialized-analyzer-suite-view.ts`, and Logger analysis context. Do not copy the standalone parser into application code.
3. Freeze an accepted HTML design/interaction reference and numerical source specification. Only then propose a **separate scoped production implementation** and ask for authorization.
4. Never merge this experimental branch merely because browser checks pass.

## Local acceptance suggestion

In v3.5.7, open **Compare → Operating conditions** to see independent A/B event cards. Then use **Compare → Before / after tuning** and import September 30. Try clicking the imported B timeline: the B interval should move, the blue reference trace should stay on October 20, and the comparison assessment should remain cautious about calibration provenance.

## v3.5.8 development checkpoint (2026-10-26)

- Built from the exact v3.5.7 Git blob SHA `a57452448e25eff1b42561440bae2b8f134ca93b` on this branch. The accepted display and core calculations have not deliberately been changed.
- A timeline clicking empty space creates an actual manual reference region based on the selected interval duration; Alt+click forces manual A creation. B's imported-source interval is independently movable, retaining its own duration where already manual.
- Timeline keyboard controls: Left/Right move by a quarter of the selected window, Home/End move to source boundaries, Enter/Space select the current center. A's new reference selection is persisted through the existing real-source preference path.
- This is **source-level verification only**. Browser interaction, numeric diagnostics and responsive UI checks remain **pending** for v3.5.8. Do not merge, port to production or represent the new snapshot as accepted until tested.
- Next: browser-test both modes with the September 30 recording, check A/B independence, re-open restore, event navigation, keyboard access, and 390px responsiveness. Then advance source/channel authority, comparison-session persistence and incomplete placeholders.
