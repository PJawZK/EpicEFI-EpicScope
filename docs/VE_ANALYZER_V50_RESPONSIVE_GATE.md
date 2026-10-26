# VE Analyzer v50 responsive acceptance gate

Branch: `ui/ve-analyzer-v50-reconcile`

This is a branch-local acceptance note. It does not authorize merging v50 work into `main`.

The responsive browser gate exercises the real application VE Analyzer at 1024, 1366 and 1920 px desktop widths. Focused browser fixtures that run earlier in the same acceptance session can intentionally leave the application on another Analyzer domain or replace the tune with no remembered VE-table selection, so the gate explicitly:

1. switches the real application shell to Analyzer → VE Analyzer;
2. resolves the v50 root only below the visible `.analyzer-page`;
3. selects the first real VE/target table candidate when replacement fixtures left those selectors empty;
4. waits for a rendered visible workbench table before measuring geometry.

This distinguishes fixture-state problems from actual responsive defects. Once the production work surface is present, the gate verifies root/workbench/scope/setup/action containment, visible-table geometry, compact setup disclosure containment, and the Logger range handoff. Screenshots are captured at each width for visual inspection.

## Green checkpoint

Web CI run `39003820151` passed on branch head `9d5e9df3da10db65a23bdb5eb7e7c2df015cb3b4` after the visible-table selector was hardened.

The complete gate passed:

- TypeScript type-check;
- full Vitest suite;
- production build;
- staged Chromium acceptance;
- Worker-disabled fallback Chromium acceptance;
- shared v50 interaction acceptance;
- current-main native/Shift-click Lambda Delay acceptance;
- responsive checks at 1024, 1366 and 1920 px;
- existing Result View, Logger, source-integrity, observability and Diagnostics regressions.

The preceding green responsive artifact (`38984103048`) reported 638 browser assertions across 94 result groups and captured staged/fallback screenshots for all three desktop widths. Those screenshots were inspected after the run: no horizontal escape, clipped primary control surface, setup disclosure escape or Logger-handoff clipping was visible. Vertical scrolling at 1024 px is expected because the Lambda Delay section follows the dominant VE table and is not a responsive defect.

`main` remains unchanged. The next gate is user hands-on acceptance from this branch, followed by any justified fixes, full revalidation, and the final Codex branch audit before an integration PR is considered.
