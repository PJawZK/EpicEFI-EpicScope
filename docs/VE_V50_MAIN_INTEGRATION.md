# VE v50 main integration candidate

## Source and preservation

- Main: `d401d40b9a65c2a19400db0b71a9aaf8cdff0c9c`.
- Validated development: `3a67965dba2660161df436c1317801a1487b6353`.
- Integration branch: `integration/ve-v50-main-20261026`.
- Common ancestor: `8fb99c0099408b74330d6468868424f1b94b05f5`.

A normal merge preserves both histories and the main-only passive-analyzer research proposal. There are no textual merge conflicts. Do not reset/force-replace main with the development branch. This integration introduces no additional runtime changes beyond the tested development commit. Package dependencies, base URL and existing storage schemas are unchanged.

## Deployment correction

Main's temporary Pages override explicitly checked out and labelled build `8ba0c7a45d18346e111b84f0d14066c3fefd887e`. A normal merge would preserve that pin because it was a main-only change. The candidate removes the override: checkout uses the workflow commit and `VITE_EPICSCOPE_BUILD_SHA` uses `github.sha`. After an accepted main merge, Pages will therefore build/report that actual merged commit. The PR-preview workflow remains separate and retains production main at the root.

Publishing this candidate does not deploy the production root: normal Pages deployment triggers only for main pushes/manual dispatch. No workflow dispatch, main merge or production deployment is included in preparation.

## Acceptance gates still open

1. Reproduce/investigate the user's unchanged large MLG short-read at byte1,102,854,995 against a known-working revision. A parser EOF interpretation does not prove the file is physically truncated. The candidate neither alters MLG parsing nor claims this failure resolved.
2. Manual Brave localhost native picker/write-permission and TunerStudio3.3.01 reopen/save/return acceptance. Verify access-only attachment retains completed analysis, working values, pins, delay and history. Missing native API support remains an explicit browser capability limitation.
3. Final PR/CI review and explicit acceptance before production merge. Branch-protection settings were not readable with the current GitHub integration (HTTP403), so no assumption is made about required administrative checks.

The browser filesystem API still cannot provide an atomic compare-and-swap lock against concurrent TunerStudio writes. Original user files are not automated write targets. No automatic ECU writes/Burn or Shim implementation is added.

## Validation

Exact gates, source-preservation comparisons, local commit, PR and logs are recorded in `/workspace/epicscope-ve-main-integration/`. Final results are appended after checks complete. Automated success is not manual UI acceptance.

Final local gates: typecheck/build passed (existing large-chunk warning); all999 units /141 files passed with two workers and unchanged assertions/timeouts; all1,454 staged/fallback browser checks /162 groups passed; built-production native-input workflows passed53 checks. Runtime source equality with3a67965 and exact preservation of main's research blob were verified. Pages YAML checkout/SHA/main-only trigger checks passed. These results do not close the user-file/manual acceptance gates above. GitHub CI results belong to the resulting PR, not these local logs.
