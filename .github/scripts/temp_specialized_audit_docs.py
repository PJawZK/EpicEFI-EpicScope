from pathlib import Path

p = Path('docs/PREPOPULATED_WORKSPACES.md')
s = p.read_text()

start = s.index('Implemented specialized starters:')
end_marker = 'Capability gating affects only starter discovery.'
end = s.index(end_marker, start)
new_specialized = '''Implemented specialized starters:

- **EpicEFI · MAP Predict + Wall Wetting** — predictive-MAP and wall-film transient diagnostics;
- **EpicEFI · Fuel Rail Diagnostics** — high-pressure rail target/actual and HPFP control diagnostics;
- **EpicEFI · ETB Control** — pedal/target/actual/error and ETB actuator diagnostics;
- **EpicEFI · Dual Chamber Boost** — upper/lower wastegate plus open/closed-loop boost-control diagnostics;
- **EpicEFI · Trigger + Sync Detailed** — tooth-angle, edge-counter and cam-sync diagnostics;
- **EpicEFI · Injector + Ignition Timing** — injection SOI plus ignition timing-attribution diagnostics;
- **EpicEFI · Engine Protection** — dynamic rev-limit, cut-reason and protection-state diagnostics.

The current specialized coverage audit is maintained in [`SPECIALIZED_WORKSPACE_COVERAGE.md`](SPECIALIZED_WORKSPACE_COVERAGE.md). Its current highest-value next candidates are **VVT Control**, **Anti-Lag**, **Launch Control**, **Traction Control** and **Transmission Control**. Per-cylinder/EGT work is deliberately deferred until the semantic layer can represent indexed channel families cleanly.

'''
s = s[:start] + new_specialized + s[end:]

start = s.index('## Next implementation direction')
new_next = '''## Next implementation direction

The generic starter catalog is complete and seven capability-gated EpicEFI starters are merged. The next work should follow the evidence-ranked audit in [`SPECIALIZED_WORKSPACE_COVERAGE.md`](SPECIALIZED_WORKSPACE_COVERAGE.md):

1. implement **EpicEFI · VVT Control** first;
2. then consider **Anti-Lag**, **Launch Control**, **Traction Control** and **Transmission Control** in that order, re-checking the user-visible gap after each addition;
3. keep Staged Injection and Closed-loop Fuel / STFT / LTFT as secondary candidates;
4. do not model per-cylinder/EGT families as dozens of fixed roles — add indexed semantic channel-family support first;
5. continue to add persistent user/schema semantic overrides only where automatic mapping is genuinely ambiguous.

All future starter implementations must reuse the same semantic resolver/materialization path rather than creating layout-specific resolver logic.
'''
s = s[:start] + new_next
p.write_text(s)
