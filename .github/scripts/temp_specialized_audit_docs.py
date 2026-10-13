from pathlib import Path
import re

p = Path('docs/PREPOPULATED_WORKSPACES.md')
s = p.read_text()

new_specialized = '''Implemented specialized starters:\n\n- **EpicEFI · MAP Predict + Wall Wetting** — predictive-MAP and wall-film transient diagnostics;\n- **EpicEFI · Fuel Rail Diagnostics** — high-pressure rail target/actual and HPFP control diagnostics;\n- **EpicEFI · ETB Control** — pedal/target/actual/error and ETB actuator diagnostics;\n- **EpicEFI · Dual Chamber Boost** — upper/lower wastegate plus open/closed-loop boost-control diagnostics;\n- **EpicEFI · Trigger + Sync Detailed** — tooth-angle, edge-counter and cam-sync diagnostics;\n- **EpicEFI · Injector + Ignition Timing** — injection SOI plus ignition timing-attribution diagnostics;\n- **EpicEFI · Engine Protection** — dynamic rev-limit, cut-reason and protection-state diagnostics.\n\nThe current specialized coverage audit is maintained in [`SPECIALIZED_WORKSPACE_COVERAGE.md`](SPECIALIZED_WORKSPACE_COVERAGE.md). Its current highest-value next candidates are **VVT Control**, **Anti-Lag**, **Launch Control**, **Traction Control** and **Transmission Control**. Per-cylinder/EGT work is deliberately deferred until the semantic layer can represent indexed channel families cleanly.\n\n'''
pattern = r'Implemented specialized starters:\n\n.*?\n\nCapability gating affects only starter discovery\.'
replacement = new_specialized + 'Capability gating affects only starter discovery.'
s, count = re.subn(pattern, replacement, s, count=1, flags=re.S)
assert count == 1

new_next = '''## Next implementation direction\n\nThe generic starter catalog is complete and seven capability-gated EpicEFI starters are merged. The next work should follow the evidence-ranked audit in [`SPECIALIZED_WORKSPACE_COVERAGE.md`](SPECIALIZED_WORKSPACE_COVERAGE.md):\n\n1. implement **EpicEFI · VVT Control** first;\n2. then consider **Anti-Lag**, **Launch Control**, **Traction Control** and **Transmission Control** in that order, re-checking the user-visible gap after each addition;\n3. keep Staged Injection and Closed-loop Fuel / STFT / LTFT as secondary candidates;\n4. do not model per-cylinder/EGT families as dozens of fixed roles — add indexed semantic channel-family support first;\n5. continue to add persistent user/schema semantic overrides only where automatic mapping is genuinely ambiguous.\n\nAll future starter implementations must reuse the same semantic resolver/materialization path rather than creating layout-specific resolver logic.\n'''
pattern = r'## Next implementation direction\n\n.*?All future starter implementations must reuse the same semantic resolver/materialization path rather than creating layout-specific resolver logic\.\n'
s, count = re.subn(pattern, new_next, s, count=1, flags=re.S)
assert count == 1
p.write_text(s)
