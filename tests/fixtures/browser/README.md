# Synthetic browser acceptance inputs

These are the small generated fixtures used by the existing target 1–3 browser acceptance runs, now retained in the checkout for `npm run test:browser`:

- `navigation.ini`: 16 scalar channel definitions and datalog labels.
- `navigation.mlg`: generated MLG channel samples compatible with that INI, with valid CRCs for the staged import path.
- `audit.msq`: synthetic uniform 16×16 VE and target-AFR tables and their axes.
- `delay.json`: synthetic 16×16 delay table with 100-ms working/recommended values.

They contain no private recording or vehicle calibration. Keep the fixtures mutually compatible: the full-shell checks depend on matching channels, table axes and valid recorded data. These are functional inputs, not a large-log performance benchmark. The component browser modules also build their own small in-memory fixtures for individual boundary and race assertions.
