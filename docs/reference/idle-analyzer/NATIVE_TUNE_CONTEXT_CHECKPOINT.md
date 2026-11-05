# Native Idle Analyzer — settings / related tune context (Group G)

Branch: `ui/idle-analyzer-html-integration`. Parent: `9562a586d4973fd62d7c0d548a86c6ba183b26a7`. Implements the bounded native related-tune/settings reference boundary for roadmap steps 19–21. No push or main merge included. This checkpoint does not declare the entire HTML integrated or promote unverified runtime metrics to supported results.

## Implementation and authority reconciliation

The accepted HTML's Tune tables action becomes a native, read-only related-context dialog inside the shared EpicScope application. Mode defaults select base airflow, outer RPM PID, DC bias or idle ignition; the same scoped selector reaches ten exact contexts: base airflow, RPM target, RPM PID, PID multiplier, DC bias, DC position PID, separate ETB bias, idle advance, timing-error adjustment and timing PID. This is one shared viewer, not copied mode-specific tables or another parser.

Sources are the existing accepted normalized `TuneModel` and canonical MSQ loading path. Exact entry names, declared units, original dimensions/pages, identity, saved date, numeric values and text settings are preserved. The viewer does not use DOM text or `TuneModel.byName` as an ambiguity resolver. Duplicate entry names across pages are rejected for automatic geometry. Missing, malformed, nonfinite, value-count-mismatched or >1,024-cell entries stay unavailable. Strictly increasing finite vector axes and exact matching dimensions are required for reference lookup; raw valid entries remain inspectable when axes are not usable. Loaded tables are never sorted, repaired, silently transposed as 2D maps, or replaced by illustrative values.

One-dimensional curves are presented horizontally as a reference grid; the exact MSQ row/column dimensions remain in entry details. Grid selection reports reference-grid coordinates and loaded values, not an ECU operating point. Two-dimensional geometry reuses `createTuneTable2D`; explicit user-coordinate lookup reuses `locateTuneTablePoint`, including its linear/bilinear policy and endpoint clamping. Derived nonfinite output is unavailable. This policy is labeled a **loaded reference lookup**, not a verified firmware interpolation prediction. No recorded-data occupancy/highlight or automatic full-log curve evaluation is introduced.

The supplied original MSQ contains a real 8-point `dcIdleBiasBins`/`dcIdleBiasValues` curve and PID constants, but no artifact proves that it was flashed during this recording. Signature/file-name agreement, loading an INI, enum text such as “Idle Valve,” and the existence of a tune curve do not establish recording association, firmware implementation, actuator assignment or controller staging. Accordingly:

- The loaded DC curve is inspectable; **runtime tune-derived DC bias / mismatch remains unavailable**.
- The loaded raw outer PID maximum is 30 and minimum −6. **Firmware saturation/clamp coverage remains unavailable**, because runtime association, stage and engineering-scale equivalence are not established.
- Raw logged output and applied pp correction remain distinct. **Raw-to-applied attenuation/fade remains unavailable**; no subtraction, median loss or fixed +30 rule is fabricated.
- Dedicated motor duty, shared ETB feed-forward, ETB bias and DC bias remain separate. No assumed bias + P + I + D output sum is introduced.
- A loaded period of 0 ms is displayed as a setting; it is not proof of execution cadence. No t63, frequency, causal gain change or automatic tune recommendation is added.

The read-only viewer provides the useful accepted feature while leaving these analytical gates explicit. It does not solve missing provenance by asking the user to check a “verified” box. Future runtime attribution needs actual matching firmware behavior/units/staging and defensible recording/tune association. Read-only means no original, reviewed proposal, working VE, MSQ-save or ECU/Burn owner is changed.

## Owners, routing and reuse

`core/tune/idle-tune-context.ts` owns the exact related-entry catalogue, unique resolution and reference geometry. `idle-tune-context-view.ts` owns scoped dialog rendering and read-only interactions. Existing MSQ parser/normalizer, shared table mathematics, native dialog/table styling, owner evidence and AbortController lifetime are reused.

The Analyzer router supplies the latest accepted tune at Idle entry and performs tune-only updates through the existing route. It skips unchanged recorded context for tune-only routing. The Idle tune child stores the immutable model/source name and projects once per model, lazily when opened. Hidden/closed updates do not rebuild tables or request log data. Source-name-only changes update identity, retaining coordinates/projection. Real tune replacement/unload resets reference coordinates and withdraws stale geometry on the open dialog; failed candidate loading preserves the previous accepted model through the existing transaction owner.

Tune viewing/replacement does not cancel pending Stability/controller reads, rerun qualification or alter retained recorded evidence. That is intentional: these current recorded calculations do not consume the tune. Future genuinely tune-dependent calculations must capture their relevant tune/association revision and reject stale work at their existing owner boundary; this viewer is not a new source of analytical authority.

One delegated grid listener resolves row/column commands against the retained projection. Rendered cell text is never read as a value. No per-render cell listener accumulation, document-wide selector scan, observer, global event listener, lifecycle framework, dependency or raw-recording cache is introduced. Entry/cell rendering is bounded and only the selected panel builds a grid. Lookup queries are constant-size table operations, not full-log operations.

## Independent numerical and rejection cases

| Authored loaded reference | Expected |
| --- | --- |
| DC bins 0/10/18/30/45/60/80/100, values −40/−20/35/30/39/42/44/37; query 20 | 35 + (30−35) × (20−18)/(30−18) = 34.1666667 |
| Same DC curve; query −1 / 101 / exact18 | −40 / 37 / 35, via explicit endpoint clamping |
| Base X 0/100, Y900/1100; row-major10/20/30/40; query50,1000 | 25, bilinear center |
| Same base; query−10,1300 | 30, clamped X/Y |
| Duplicate curve name on a second page with plausible byName value | Ambiguous; no geometry/lookup |
| Repeated, descending or nonmonotonic axis; nonfinite values; dimensional mismatch; >1,024 cells | Lookup unavailable; no sorting, repair or invented shape |
| ETB curve with no DC curve | ETB is separately inspectable; no DC fallback |
| Missing units / raw PID limit30 / no tune / invalid coordinates / derived overflow | No inferred physical/runtime authority; unavailable lookup where appropriate |

No existing common interpolation formula changes. This is reference evaluation under a stated shared policy, not a mathematical audit/implementation of the missing exact firmware.

## Actual supplied-file browser replay

Production preview loaded the private canonical INI, 2,000-record MLG prefix and original/altered MSQs via the existing application controls. Native mouse/keyboard actions verified:

- Real DC bias: 8 points; query20 → **34.167 DC idle duty bias**, loaded reference only. Selecting its third grid cell reports the original value35.
- Real base airflow: 3 × 8 geometry; coolant-coordinate74 and target-coordinate900 → **13.500%**.
- Real `iacPidMultRpmBins`: `[800,1690,10,900,1780,110,990,1880]` is nonmonotonic. The raw sequence is inspectable, and reference lookup is blocked. No claim is made here that the loaded setting was active in the recording or what firmware would do with it.
- Outer/inner raw settings and units remain explicit; the distinct ETB bias has16 points; timing-error adjustment has13.
- Accepting the altered MSQ updates the dialog's model/identity and clears old lookup coordinates. Rejecting an intentionally malformed replacement retains the altered accepted MSQ and its34.167 reference lookup.
- Recorded facts remain unchanged throughout load, replacement, rejection and Logger/navigation: 1,995 valid RPM records, σ18.72RPM, RPM RMSE18.76RPM, inner I mean0.24raw, feed-forward mean25.78raw, signed motor mean25.60%, tracking RMSE1.92pp.
- Desktop and390px screenshots retain one shared header/footer, readable scoped controls and table scrolling inside the dialog; no page-width overflow or browser exceptions were observed.

Private bytes are not committed. These source numbers identify this available prefix/loaded reference, not original recording/tune association or full-size/hardware performance.

## Validation and next boundary

- Focused reference contracts: 7 tests passed.
- Full unit gate: 1,127 tests /156 files passed.
- Targeted staged/fallback browser gate: 278 checks /14 groups passed.
- Production build passed; existing >500kB bundle advisory remains.
- Native production replay: 15 action checkpoints passed.
- Full browser gate: 1,629 checks /168 result groups passed in staged and fallback configurations.

Artifacts: `/workspace/epicscope-idle-tune/`; logs: `/workspace/epicscope-idle-tune-*.log`. [Native parity inventory](NATIVE_PARITY_INVENTORY.md) separates working features, adaptations and explicit remaining gates. [Seven-stage status](NATIVE_STAGE_STATUS.md) remains partial overall.

Next major native boundary is Stage5 independent recording B / comparison ownership, before comparison calculations. Session persistence/plans, remaining verified runtime authority, layout refinement, shared help/tutorial and final manual/hardware acceptance remain open. No automatic progression or main merge is included. Stop for review at this checkpoint.
