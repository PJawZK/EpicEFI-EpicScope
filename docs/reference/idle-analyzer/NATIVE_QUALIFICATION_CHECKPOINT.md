# Native Idle Analyzer — selected region qualification checkpoint

Branch: `ui/idle-analyzer-html-integration`. This is a bounded native Stability stage following `f7ecbb5f71e4ab64f907219c06f8deb9abe8d11e`; stop for manual acceptance. No push or merge is part of this checkpoint.

## Working behavior

The Qualification disclosure now applies explicitly selected conditions to recorded Stability analysis and candidate discovery. Qualification defaults **off**, preserving previous analysis until enabled. The existing RPM ceiling, an optional minimum coolant reference (default 70 °C), and an optional closed-input reference (default 3%) determine eligibility. Minimum duration remains a discovery rule.

Coolant requires a verified temperature channel with declared Celsius or Fahrenheit units. Thresholds convert, rather than modifying source values: 70 °C = 158 °F. Closed input requires an explicitly selected percentage channel and values between zero and the chosen maximum. Driver pedal and physical TPS are separate meanings; physical TPS never establishes released driver intent. The supplied INI identifies `coolant`, `throttlePedalPosition` and `TPSValue` accordingly. `DriverThrottleIntent` is not substituted for measured pedal position. Missing required mappings, units or aligned evidence produce an explicit unavailable result, never an RPM-only fallback.

Manual or genuinely bounds-edited managed regions can explicitly bypass conditions. This option defaults off, does not bypass source/sample validity, and does not apply to Full Log, Logger scope or discovery. Renaming a candidate alone does not enable bypass. Entirely bypassed manual scopes can run without unused conditional channels; mixed scopes still require their evidence. Overlapping regions remain deduplicated. Counts distinguish eligible, rejected, invalid, unavailable and explicitly bypassed samples.

Graphs deliberately retain raw recorded measurements, including condition-excluded samples. Metrics use the eligibility mask on original sample indices. Condition changes invalidate accepted evidence and reject stale async completions at the existing controller boundary. Unchanged retained full-source columns are reused for threshold edits; no parser, worker, storage or global lifecycle owner is replaced. Opening Channels or Qualification closes the other setup disclosure to preserve graph space.

## Implementation ownership

- `core/analysis/idle-qualification.ts`: source-valid, original-index eligibility and bypass partition, sharing the existing numeric qualification engine.
- `core/analysis/sample-qualification.ts`: opt-in selected indices and strict timestamp alignment; existing callers retain default behavior.
- `core/analysis/idle-stability.ts` and `idle-regions.ts`: consume eligibility for statistics and discovery; normalized region membership remains shared.
- `apps/web/src/pages/idle-qualification-plan.ts`: mapping/unit validation, semantic conditions and explicit bypass planning.
- `idle-analyzer-view.ts`: existing source/cache/generation authority, controls and accepted evidence. Assessment renders those results; DOM text is not analytical authority.
- Region session tracks actual bounds edits separately from label edits.

## Numerical and browser evidence

Real-file Chromium interaction used the supplied INI and a private 2,000-record MLG prefix through the production preview, with native mouse/keyboard actions. For included intervals 0–5 s and 15–20 s:

| Setting | Eligible valid RPM samples |
| --- | ---: |
| Qualification off | 771 |
| Coolant ≥70 °C, RPM ≤1200 | 572 |
| Coolant ≥−200 °C boundary probe | 771 |
| Coolant ≥200 °C boundary probe | 0 |
| Same 200 °C reference, explicit manual bypass | 771 |
| Closed driver pedal 0–3% | 771 |
| Physical TPS 0–3% | 768 |
| Qualification off again | 771 |

The interval reference contains 773 records; two source-invalid retry attempts are excluded. They are not inferred physical data loss. Extreme references above are test probes, not tuning recommendations. Discovery with the 200 °C reference yields zero candidates even with manual bypass checked. Missing coolant blocks discovery; an explicitly entirely bypassed manual analysis remains available with its limitation stated.

Existing diagnostics show one new analysis request for each actual threshold change, without another retained batch-start or physical-read increment. These observations establish reuse on the bounded recording, not a full-log hardware performance claim.

Validation:

- Production build and typecheck passed; existing large-bundle warning remains.
- Full unit suite: **1,057 tests across 147 files** passed. Focused qualification/stability/session suite: 33 tests, including more than 320,000 samples.
- Final full browser suite: **1,527 checks** passed, including worker and fallback configurations.
- Focused browser gate: **176 checks across 14 groups** passed.
- Native real-file workflow validates condition changes, discovery refusal, manual bypass, semantic input distinction and restoration of the original scope. Local evidence is under `/workspace/epicscope-idle-qualification/` and is not committed with private recording bytes.

An old stale-discovery test initially assumed a new source read that retained-column reuse now avoids. It was corrected to advance the actual source revision before asserting stale-completion rejection; the corrected suite passed. Final setup disclosure/wording corrections received a fresh production build and full browser gate.

## Limits and acceptance boundary

These are **selected reference conditions**, not proof of a firmware-qualified idle state. Controller-active, stationary vehicle, fan/load transitions and other diagnostic modes remain unimplemented. There is no causal tuning recommendation, ECU write, comparison implementation or tune modification. Qualification settings are session-local and reset to off on reload. Full large-log hardware benchmarking remains deferred.

The frozen HTML remains unchanged. Its synthetic idle/controller/speed flags are not imported as measured authority. Explicit opt-in qualification and manual bypass differ intentionally from implicit prototype behavior. Existing EpicScope header, footer, theme, Logger and canonical source interfaces remain shared.

Manual acceptance should check a known idle interval, the actual coolant/pedal/TPS units, condition toggles, missing-channel feedback, manual bypass counts and discovery independence. Stop here before extending modes or qualification criteria.
