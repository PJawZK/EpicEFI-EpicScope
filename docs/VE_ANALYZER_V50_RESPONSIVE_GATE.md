# VE Analyzer v50 responsive acceptance gate

Branch: `ui/ve-analyzer-v50-reconcile`

This is a branch-local acceptance note. It does not authorize merging v50 work into `main`.

The responsive browser gate exercises the real application VE Analyzer at 1024, 1366 and 1920 px desktop widths. Focused browser fixtures that run earlier in the same acceptance session can intentionally leave the application on another Analyzer domain or replace the tune with no remembered VE-table selection, so the gate explicitly:

1. switches the real application shell to Analyzer → VE Analyzer;
2. resolves the v50 root only below the visible `.analyzer-page`;
3. selects the first real VE/target table candidate when replacement fixtures left those selectors empty;
4. waits for a rendered workbench table before measuring geometry.

This distinguishes fixture-state problems from actual responsive defects. Once the production work surface is present, the gate verifies root/workbench/scope/setup/action containment, table overflow geometry, compact setup disclosure containment, and the Logger range handoff. Screenshots are captured at each width for visual inspection.
