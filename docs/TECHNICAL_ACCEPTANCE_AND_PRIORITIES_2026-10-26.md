# EpicScope Pass D — Technical acceptance and evidence-based priorities

Date: 2026-10-26. Documentation-only planning baseline: production runtime `f6bdbf78643754d1bf3398980bcad3583201fef9`. Recheck current `main` before acting. Code and observed runtime behavior take precedence over this document. A green automated gate is not proof of user-machine behavior. No code changes, ECU write or Burn are authorized here.

## Classification and workflow

- **Acceptance** = verify currently implemented behavior against actual source files/browser/workspace; no presumed defect.
- **Reproduce** = suspected defect requiring original steps, actual result and minimal repeatable case before modifying production.
- **Policy** = a choice requiring explicit numerical/product decision and tests, not a failing implementation by definition.
- **Future scope** = new functionality requiring separate user authorization and design.

For every check record current HEAD, browser/OS, data identity or synthetic fixture, expected versus observed behavior, diagnostic evidence, pass/fail/unknown, and any subsequent fix/validation SHA. For file operations, work on backups first and preserve the original source checksum.

## Priority 0 — Accept the current real-data workflow

| ID | Class | Test / acceptance condition | Evidence and existing owners | Stop / escalation rule |
| --- | --- | --- | --- | --- |
| A01 | Acceptance | Original 1,102,856,192-byte MLG opens in local Web and hosted Pages. Reports 159,022 **structurally complete** records, excluded incomplete EOF, 28 unrecovered CRC exclusions, and Ready + warning; does not modify source. | `docs/MLG_INCOMPLETE_TAIL_RECOVERY.md`; `core/parsers/mlg/mlg-records.ts`; browser staged/fallback import paths | Counts or classification differ, or data invented/reordered: reproduce and investigate, not auto-relax integrity |
| A02 | Acceptance / performance | Record file-pick→index-ready, initial visible graph, repeated timeline navigation, A–B range changes, VE analysis duration, memory and Diagnostics ZIP. Distinguish decode/I/O from cached analysis; test warm/cold starts. | Logger/import, timeline, Diagnostics; `docs/OBSERVABILITY.md` | Measured freezes or high cost: capture diagnostics and focused repro; no generic optimization without evidence |
| A03 | Acceptance / file integrity | Verify browser capability and native picker permission in Brave on localhost; Save copy and same-file Save; reopen in TunerStudio 3.3.01; verify original/changed MSQ semantics and history/pins/delay after access-only attachment. | `docs/VE_V50_MAIN_INTEGRATION.md`, current file-access and save owners | Permission/reopen mismatch or external file concurrent edit: preserve backups and stop, no silent overwrite claims |
| A04 | Acceptance | Perform INI → MSQ → MLG, Logger → Analyzer → Histogram → Logger and restored workspace round-trip; verify channel identities, scope, warnings, diagnostics and no unexpected analysis rerun. | Current browser acceptance suites and application owners | Capture exact state transition and reproduce before code correction |

## Priority 1 — Targeted VE and UI acceptance

| ID | Class | Test / acceptance condition | Evidence | Stop / escalation rule |
| --- | --- | --- | --- | --- |
| V01 | Reproduce | Confirm or reject intermittent VE setup dropdown closes on first click. Repeat native pointer inside, outside, switching menus and setup rerender with user browser/zoom. | Follow-up Group 1 remained unconfirmed; `docs/VE_V50_FOLLOWUP_GROUP6_CELL_EVIDENCE.md` | Only change the responsible event/rerender owner with native-browser regression |
| V02 | Acceptance | With real 32×32 table, verify interpolation 0/0.5/1, H/V and both 2D methods, pinned/endpoints/blank cells, Undo/Redo, original vs generated vs review values. | Follow-up Groups 2–3 | Numeric mismatch: preserve exact cell coordinates, axes and input values before filing bug |
| V03 | Acceptance | Pin generated/edited working cells; rerun VE; verify protected values, truthful retained evidence and unpinned neighbors; confirm history retirement contract. | Follow-up Group 3 | No automatic analysis or tune/ECU mutation |
| V04 | Acceptance | Drag/select/move real A–B scope in VE, validate Logger synchronization/saved ranges, explicit rerun only and stale result rejection. | Follow-up Group 4 | Inconsistency: compare source identity/revision, not preview pixels |
| V05 | Acceptance | Grab Lambda Delay while table closed; check progress/error/retry, then explicit open/use; switch Result View and release-click evidence repeatedly, checking red/blue working-versus-original direction. | Follow-up Groups 5–6 | Failed discovery must preserve accepted working delay |
| V06 | Acceptance / performance | Test Brush sustained stroke responsiveness, pin skipping, cancel and single Undo transaction on 32×32 at actual browser zoom; dialog background-pointer and keyboard accessibility. | Group 10 handoff limitations | Keep performance and accessibility observations separate from numerical correctness |

## Priority 2 — Explicit numerical policy reviews

| ID | Class | Question | Decision needed |
| --- | --- | --- | --- |
| N01 | Policy | B02: exclude by engine-event time or observation time for state flags/recovery? | Define timebase and counterexample tests before altering alignment |
| N02 | Policy | R28/R29: how should stability judge cancelling excursions and long timestamp gaps? | Define continuity/stability semantics, then validate against controlled and real logs |
| N03 | Policy | One-pass Lambda Delay refinement versus iteration | Require demonstration of practical benefit and failure bounds before expanding cost/complexity |
| N04 | Policy / user authority | How should a future reviewed proposal be applied/exported safely? | Remains separate future project; never silently write to ECU or change loaded source tune |

Existing interpolation target-clamp/strength behavior is a documented implemented correction, not a new unresolved policy by default; see Group 2.

## Priority 3 — Separate future product and governance work

1. **Idle Analyzer maturity:** prioritize log evidence, transitions, DC valve/outer loop interaction, and controlled test cases before live adaptation; do not assume automated tuning.
2. **Boost and AE / MAP Predict:** advance from observed gaps, not new dashboards alone. Keep actuator polarity, engine-state causality and uncertainty explicit.
3. **Fuel Pressure / Injector and Trigger / Sync:** targeted maturity tests with relevant channel availability; do not invent sensor channels.
4. **Live analysis via `ts_shim`:** read-only source is established, but adding analytical live-mode behavior requires independent lifecycle, provenance and CPU budgets. Maintain one source owner and user-explicit run/activation.
5. **MLG v3 and native Linux production:** separate future compatibility/platform efforts, not current v1/v2 regressions.
6. **Passive diagnostic/correction analyzers:** research proposal only; do not schedule implementation without design approval.
7. **Governance:** old `ui/ve-analyzer-v50-port` has unique history; complete semantic/patch provenance audit before deletion. Keep `browser-previews` infrastructure.

## Verification gates for any later authorized runtime change

Reproduce baseline failure against current `main`; inspect owning source and existing tests; make the smallest justified fix. Validate targeted unit/browser and staged-worker/Worker-disabled paths, full production build and CI, affected production smoke/browser behavior, then manually accept on relevant real inputs. Record source SHA, actual commands/results and unresolved limitations. Never equate small synthetic fixtures with the unchanged large MLG or real hardware.

## Status

Pass D provides a documented test/decision order, **not** a declaration that A01–V06 were personally completed. Past Codex exact-file and automation reports are recorded evidence, and current manual acceptance remains open until the user supplies actual results. For discrepancies use [the ledger](DOC_DISCREPANCY_LEDGER.md), and for project status use [the handoff](HANDOFF.md).
