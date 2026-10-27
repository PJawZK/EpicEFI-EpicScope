# Native Idle Analyzer — Viewed region checkpoint (Group A)

Branch: `ui/idle-analyzer-html-integration`. Extends the source/session and view owners reviewed in [the implementation plan](VIEWED_REGION_IMPLEMENTATION_PLAN.md). No main merge or push is included.

## Changed behavior

Select **Analysis scope → Viewed region**, then select a managed region in the existing focus control, manager View action or timeline marker. Graphs, Stability cards, Base Airflow cards and assessment now use that one interval. An excluded region can be explicitly analyzed without changing its checkbox. **Included regions combined** remains separate: graph focus changes do not alter combined metrics, and overlaps count once.

No selection, deletion or source/revision retirement withdraws old evidence and asks for a managed selection; Viewed never silently falls back to Full Log or chooses the first row. Splitting selects the first child under the retained ID; merging a selected target transfers to the retained merged ID and uses its actual new bounds. Presentation-only label/purpose changes retain calculations and graph viewport.

A timeline Shift-drag from Viewed commits the real Logger A/B and visibly switches analysis and graph focus to Current A/B. The discovery dropdown remains that same real Logger operation, now labelled **Use candidate as Logger A/B**; it is not a managed-region editor. Existing aggregate-scope drag behavior remains intact.

Qualification applies to the selected interval independently of inclusion. Explicit bypass additionally requires existing manual/bounds-edited provenance. Renaming, test purpose, splitting an untouched candidate and selecting an excluded region grant no bypass. Discovery never bypasses, and source validity remains mandatory.

## Ownership and retained behavior

- `idle-analyzer-view.ts` owns Idle-local `viewed`, stable managed selection, shared scope labels and the existing async request generation. All managed focus entry points use the same local action.
- `idle-region-session.ts` remains the sole managed-region/provenance owner, unchanged.
- `idle-qualification-plan.ts` compiles Viewed bypass from the selected region's real eligibility, rather than impersonating the legacy manual scope.
- Existing canonical columns, original sample indices and timestamp alignment remain authoritative. No new per-region full-log cache, worker boundary, global listener, observer or generic lifecycle wrapper was introduced.
- Switching to a different numerical interval recalculates from retained columns. Browser load-call assertions distinguish that CPU calculation from file reads. Mode/tab/presentation changes do not reread columns or restart numerical analysis.
- Shared Logger scope contracts, parsers, analytical primitives, VE production code and application chrome are unchanged. The manager's explanation now states its scope-dependent View behavior.

## Numerical references

Synthetic recorded RPM `[900,1000,1100,1300]` at `[0,100,200,300]` ms; target is 1000 RPM throughout. Source indices start at 10.

| Viewed bounds | Valid samples | Sample sigma (n−1), RPM | Error RMSE, RPM | Within ±40 | Base request mean | Applied correction mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0–100 ms | 2 | 70.71 | 70.71 | 50.0% | 21.00% | 1.00 pp |
| 200–300 ms | 2 | 141.42 | 223.61 | 0.0% | 25.00% | 1.00 pp |

Base request `[20,22,24,26]`%; applied correction `[-2,4,6,-4]` pp. These are independent arithmetic reference cases, not prototype-derived results. No numerical formula changed.

Real INI + private 2000-record MLG prefix, native production-build replay:

| Selection | Valid RPM | Sigma, RPM | Error RMSE, RPM |
| --- | ---: | ---: | ---: |
| Viewed A, 0–5 s | 337 | 15.16 | 15.16 |
| Viewed B, 15–20 s | 434 | 13.96 | 14.00 |
| Combined A+B | 771 | 14.49 | 14.52 |

B's request context: base 17.08%, applied −1.09 pp, final 15.99%, correction RMS 2.93 pp. Changing combined graph focus retained 771 samples and 14.52 RPM RMSE. Qualification produced the same B membership for this real interval; it is not evidence that qualification has no effect generally (separate tests exercise rejection/missing inputs).

## Validation

- Focused unit gate: 37/37 across qualification, managed session, Stability and Airflow.
- Full unit gate: 1,079 tests / 150 files passed, one worker.
- Production typecheck/build passed; existing chunk-size advisory remains.
- Final targeted browser gate: 202 checks / 14 result groups, worker and fallback configurations, passed after scope-specific wording refinements and added discovered-candidate Logger-transition assertion.
- Full browser gate: 1,553 checks / 168 result groups passed in worker/fallback configurations. Run before final text/selector-label refinements; final targeted gate above verifies those refinements and the extra candidate-command assertion. No numerical/lifecycle code changed after this full pass.
- Final native production-build replay: 10 action checkpoints passed with real INI/MLG, two selections, both modes, qualification, combined-scope invariance, Logger/Analyzer navigation retention and 390px no-overflow; no browser exceptions. Desktop screenshot inspection additionally verified scope/selector/timeline wording.
- `git diff --check`: passed.

Browser regressions cover unequal numerical selections; dropdown/manager/marker routes; excluded selection; combined invariance; label/purpose/viewport reuse; missing/deleted/replaced selections; navigation retention; split/merge; real Logger transition; late A after B; hidden completions; missing coolant and explicit provenance bypass; and 320,459-sample Viewed analysis with retained reads and bounded graph DOM. Existing browser cases continue to cover source revisions, units/catalog, qualification thresholds and canonical corrupt/retry handling.

Artifacts outside Git: `/workspace/epicscope-idle-viewed/`, `/workspace/epicscope-idle-viewed-unit.log`, `/workspace/epicscope-idle-viewed-build.log`, `/workspace/epicscope-idle-viewed-full-browser.log`. Private source bytes remain outside Git.

## Limitations and next boundary

This closes Group A (roadmap steps 1–3), not the whole HTML integration. Broad candidate-banner/clutter cleanup remains deferred until the feature inventory is complete. Independent B, other modes, tune context, persistence/plans and final manual acceptance remain open. Synthetic scale and a private real prefix do not establish 1GB/hardware responsiveness or substitute for unavailable original reference recordings.

Next: **Group B — DC Valve Tracking** (steps 4–6): establish compatible requested/measured position contracts and units, implement source-valid numerical evidence, then integrate graphs/assessment with focused unit/browser acceptance. Inspect the existing production implementation and reuse it where appropriate. Do not advance automatically from this checkpoint.

## Seven-stage completion

| Stage | Status |
| --- | --- |
| 1 — Fixtures/contracts | Partial overall; Viewed qualification and numerical regression cases added |
| 2 — Source/session | Primary-source foundation and Viewed extension complete; tune/independent-B extensions pending |
| 3 — Core analysis | Partial; existing Stability/Airflow reused unchanged |
| 4 — Native UI | Partial; Stability, Base Airflow and Viewed/combined workflow working |
| 5 — Independent B/comparison | Not started |
| 6 — Persistence/plans/Logger | Partial; source-authoritative Logger handoff/Viewed transition working |
| 7 — Acceptance | Open; full-feature/manual/hardware/final audit pending |
