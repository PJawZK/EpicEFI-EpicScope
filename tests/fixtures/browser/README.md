# Synthetic browser acceptance inputs

These are the small generated fixtures used by the existing target 1–3 browser acceptance runs, now retained in the checkout for `npm run test:browser`:

- `navigation.ini`: 16 scalar channel definitions and datalog labels.
- `navigation.mlg`: generated MLG channel samples compatible with that INI, with valid CRCs for the staged import path.
- `audit.msq`: synthetic uniform 16×16 VE and target-AFR tables and their axes.
- `delay.json`: synthetic 16×16 delay table with 100-ms working/recommended values.

They contain no private recording or vehicle calibration. Keep the fixtures mutually compatible: the full-shell checks depend on matching channels, table axes and valid recorded data. These are functional inputs, not a large-log performance benchmark. The component browser modules also build their own small in-memory fixtures for individual boundary and race assertions.

`storage-workspace.ts` supplies a small synthetic workspace, source identity and INI catalog shared by the storage-acquisition unit and real-browser startup/recovery checks added in target 6. It is a test fixture module rather than a file selected by the user.

`performance-parity.json` freezes the complete Perf text/UI output captured from the pre-stage-3 controller with deterministic measurement fixtures. `tests/web/performance-fixtures.ts` supplies those measurements; its 320459 sample count is metadata, not a generated large log. The browser migration checks compare exact output, exercise shared shell evidence after real file imports, and save recorder call/report timings as observations rather than timing assertions.

`parser-evidence-parity.json` freezes pre-stage-4 Parser text/UI/severity for clean, pending/recovered, CRC/counter and long-message/45-warning synthetic cases. `tests/web/parser-evidence-fixtures.ts` supplies the canonical lists. These fixtures establish report completeness and compatibility, not actual corrupted-file worker handling or a large recording benchmark.
