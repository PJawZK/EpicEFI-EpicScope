# 2026-10-14 — Fuel / Injector validation hold and VE Analyzer pivot

## Decision

Pause further Fuel Pressure / Injector feature expansion after the pressure-evidence quality checkpoint and make **VE Analyzer** the active Analyzer development track.

## Why Fuel / Injector is paused

Real-log validation now confirms the analyzer correctly distinguishes channel presence from usable pressure evidence:

- calibrated low-side/high-side pressure roles are separate from raw electrical inputs;
- CEL/check-engine channels are excluded from pressure roles;
- Conventional / port-injection and GDI / high-pressure architectures are explicit;
- pressure event context includes RPM, MAP/load, pressure, injector PW/duty/deadtime and exact event-extreme navigation;
- engine-off/very-low-RPM samples can be excluded from pressure diagnosis;
- constant-zero active pressure is treated as present but non-informative rather than generating false low-pressure events;
- negative calibrated values are counted/graded and can move a channel to Needs verification.

The representative July log does **not** provide trustworthy varying active pressure evidence for validating pressure sag/recovery or repeatability behavior: the selected injector-pressure-delta channel is constant zero and the low-side calibrated pressure signal contains enough negative values to require calibration/unit verification.

Therefore the following Fuel / Injector work is **validation-blocked**, not abandoned:

- pressure sag magnitude and recovery timing;
- repeated-event/repeatability summaries;
- pump/prime recovery where logged;
- pressure-versus-duty/PW correlation around real sag events;
- voltage/deadtime evidence tied to validated pressure events;
- any derived conventional rail differential based on low-side pressure and MAP.

Do not fabricate fixtures or derive pressure from a questionable channel merely to complete these features. Resume this track when a real log with trustworthy, varying pressure evidence is available.

## Why VE Analyzer becomes active

VE Analyzer is a mature, established calibration-analysis workflow and EpicScope already has the required evidence sources and foundations:

- recorded RPM/load/mixture/target/VE/fuel-command values are available in existing logs;
- Fueling Analyzer already provides mature semantic state qualification and trailing-window stability concepts;
- AFR-delay analysis already provides mixture-response timing evidence;
- Histogram/Table Generator already provides breakpoint/node weighting and evidence provenance;
- MSQ tune tables are already normalized and available for correlation;
- Analyzer already provides shared scope, semantic channel roles and Logger evidence navigation.

The behavioral contract is already preserved in `docs/VE_ANALYZER.md`, supported by the MLV and ECUMaster EMU PRO research under `docs/research/`.

## Active implementation order

The active VE Analyzer sequence is now:

1. VE Analyzer shell using shared scope/channel-role patterns;
2. visible semantic input resolution and VE table selection;
3. Recommended VE Analysis qualification preset with explicit resolved/unavailable exclusions;
4. table-aware RPM/load evidence-only operating map;
5. Lambda Delay working model (single / RPM curve / RPM×load table);
6. explicit **Grab lambda delays from log** discovery;
7. timestamp-based delay compensation;
8. weighted VE-node evidence accumulation;
9. prior/confidence/authority and correction-limit rejection;
10. result views, Logger evidence navigation and explicit review/export/application authority.

## Invariants

- Running VE analysis must never mutate tune/ECU state.
- Expensive lambda-delay discovery runs only by explicit user action.
- Recommendations must retain source evidence, qualification provenance and delay-model provenance.
- Weak/ambiguous evidence must remain observational or withheld rather than being made to look authoritative.
- Original research notes remain preserved; implementation state belongs in living status/handoff documentation.
