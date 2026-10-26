# Documentation discrepancy ledger — 2026-10-26

This is an evidence and disposition index, **not** a list of instructions to modify runtime code. Current `main` source/tests and actual reproduced behavior take priority over documentation. When uncertain, label unknown rather than making a code change to fit a document.

Baseline for comparison: verified production runtime `f6bdbf78643754d1bf3398980bcad3583201fef9` (PR #467). The later Pass A and Pass B documentation commits do not claim further runtime validation.

| ID | Discrepancy / question | Supporting code or document evidence | Documentation disposition | Remaining verification |
| --- | --- | --- | --- | --- |
| D01 | Old `HANDOFF.md` instructs work on October 18 v50 branch and describes already merged work as pending | `main` merge PR #466 / #467; `docs/MLG_INCOMPLETE_TAIL_RECOVERY.md` | Corrected Pass A; full original handoff archived | None for historical labeling |
| D02 | Roadmap/README/Product still called UI polish and D-058 implementation the immediate future | Current `docs/OBSERVABILITY.md` reports foundation/stages 2–9 implemented; `main` Diagnostics surface | Labeled prior sequence as historical; addenda inserted | Verify each individual observability stage against its producers, persistence and UI/tests before claiming complete production parity |
| D03 | VE documents describe PR #462 as the latest accepted runtime | PR #466 integrated VE v50 and correction work; `core/analysis/ve-proposal.ts`, `apps/web/src/pages/ve-analyzer-view-v2.ts` | Current addenda added; prior validation history retained | Real user acceptance, dropdown, Brush and modal behavior |
| D04 | Product snapshot does not describe native MSQ same-file Save | `docs/VE_V50_MAIN_INTEGRATION.md`; integrated PR #466 | Added capability with permission and concurrency caveats | Real Brave/TunerStudio native picker/save/reopen and external-change behavior |
| D05 | MLG plan omits safe known-incomplete final block recovery | `core/parsers/mlg/mlg-records.ts` `incompleteTail` option and `docs/MLG_INCOMPLETE_TAIL_RECOVERY.md` | Added explicit strict-default/browser-opt-in addendum | User-machine timing and other real corrupt-file families |
| D06 | Research STATUS labels entire observability effort planned | `docs/OBSERVABILITY.md` describes implemented stages and future optional intelligence | Historical date labeled, status caveat added | Per-capability source-level and output parity audit; not yet established in this Pass B |
| D07 | VE follow-up Group 1 dropdown closure was not reproduced | `docs/VE_V50_FOLLOWUP_GROUP6_CELL_EVIDENCE.md` | Kept open as reproduction request, not claimed fixed | User-browser reproduction |
| D08 | VE numerical policy ambiguity can be mistaken for failing algorithms | Group 10 final handoff and later interpolation/pin corrections | Listed explicitly as policy/evidence questions | Review B02; R28/R29; one-pass delay refinement |
| D09 | Historical branch population can be mistaken for active unfinished work | GitHub branches; `main` integrated lineage | Kept separate from docs reconciliation | Pass C: ancestry, unique-commit and patch-equivalence audit before deletion |
| D10 | Some migration language in Observability implies implementation has yet to start | `docs/OBSERVABILITY.md` old future-tense sections and current implemented-status heading | Added interpretation note, preserved historical design | Establish exact `main` owner/test references before rewriting deep architecture prose |

## Documentation changes in Pass B

Updated: `ROADMAP.md`, `PRODUCT.md`, `VE_ANALYZER.md`, `VE_ANALYZER_WORKBENCH.md`, `ANALYZER.md`, `LOG_MLG_PLAN.md`, `OBSERVABILITY.md`, `research/STATUS.md`. Existing architecture and historical research paragraphs were retained. Editorial status addenda take precedence over old dated snapshot sections only where supported by identified implementation or integrated commits.

## Rules for closing ledger items

1. Inspect current production implementation and associated tests first, documenting paths and input/output behavior.
2. Use recorded CI, browser tests and actual original-file acceptance at the correct revision; distinguish reported from independently rerun results.
3. Correct misleading documentation without altering working code. A proposed runtime fix is separate work and requires a reproduction.
4. Mark the closure SHA and citation to source/test or user acceptance. Leave unresolved rows open.
