# Source identity is immutable presentation data

Date: 2026-10-14
Status: accepted

## Decision

EpicScope must present ECU, INI and MSQ source identities exactly as supplied by the source.

Examples:

- INI output-channel key `lambdaValue` is displayed as `lambdaValue`, not `Lambda` or `Actual mixture`.
- MSQ table `lambdaTable` is displayed as `lambdaTable`, regardless of EpicScope's interpretation of the values.
- ECU/Shim channel `RPMValue` is displayed as `RPMValue`, even if display metadata contains a friendlier label such as `Engine speed`.

Units may be shown alongside the literal identity, for example `fuelPressure_low [kPa]`. Units, semantic roles, categories, warnings and analysis interpretations are metadata; they do not replace the source identity.

## Separation of concerns

EpicScope may classify a source as serving a role such as:

- Actual mixture
- Target mixture
- RPM reference
- VE-table load
- Fuel pressure

Those role names belong to the control caption, readiness/evidence metadata or help text. They must not rename the selected source itself.

## AFR / Lambda implication

Names are evidence, not authority over stored values. A table named `lambdaTable` containing AFR-range values must remain named `lambdaTable` and be reported as an identity/value conflict. EpicScope must not silently rename or convert it.

Cross-scale AFR/Lambda conversion, if added later, requires explicit conversion authority such as the applicable stoichiometric/Gas Scale value. There is no hidden conversion.

## Current implementation

This decision is enforced in:

- Analyzer channel selector labels;
- Histogram channel selector labels;
- ts_shim channel-definition presentation;
- VE Analyzer target-table scale assessment, including identity-vs-value conflicts.

Existing semantic-role matching may continue to inspect display metadata internally for compatibility and suggestion scoring. That internal matching does not grant permission to show the semantic/display alias in place of the literal source name.
