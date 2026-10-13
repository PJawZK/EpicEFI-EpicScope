from pathlib import Path
import re

# The primary guarded transform intentionally reaches its old semantic-test insertion guard last.
# Verify all product/test transformations before finishing that one file.
required_markers = {
    'apps/web/src/state/semantic-channel-roles.ts': ["'cooling.fanActive'", "'transient.instantMap'", "'wallFuelCorrectionValue'"],
    'apps/web/src/state/built-in-workspace-templates.ts': ["without requiring closed-loop boost control", "'cooling.fanActive'", "'transient.instantMap'", "live-MAP prediction and wall-film mass/correction"],
    'tests/web/epicefi-capability-starters.test.ts': ["mass-domain wall correction", "instantMAPValue", "wallFuelCorrectionValue"],
}
for filename, markers in required_markers.items():
    text = Path(filename).read_text()
    missing = [marker for marker in markers if marker not in text]
    if missing:
        raise SystemExit(f'{filename}: primary transform did not reach expected state: {missing}')

path = Path('tests/web/semantic-channel-roles.test.ts')
text = path.read_text()
text = text.replace(
    "      channel('effectiveMap', 'effectiveMap', 'Effective MAP'),\n      channel('fallbackMap', 'fallbackMap', 'fallbackMap'),",
    "      channel('effectiveMap', 'effectiveMap', 'Effective MAP'),\n      channel('instantMAPValue', 'instantMAPValue', 'Instant MAP'),\n      channel('fallbackMap', 'fallbackMap', 'fallbackMap'),",
    1,
)
text = text.replace(
    "      channel('wallFuelCorrection', 'wallFuelCorrection', 'AE: wall correction extra'),",
    "      channel('wallFuelCorrectionValue', 'wallFuelCorrectionValue', 'Fuel: wall correction'),\n      channel('wallFuelCorrection', 'wallFuelCorrection', 'fuel wallwetting injection time'),",
    1,
)
text = text.replace(
    "    expect(resolveSemanticChannelRole('transient.effectiveMap', channels).channel?.id).toBe('effectiveMap');\n    expect(resolveSemanticChannelRole('transient.aeFuel', channels).channel?.id).toBe('tpsAccelFuel');\n    expect(resolveSemanticChannelRole('transient.wallFuelCorrection', channels).channel?.id).toBe('wallFuelCorrection');",
    "    expect(resolveSemanticChannelRole('transient.effectiveMap', channels).channel?.id).toBe('effectiveMap');\n    expect(resolveSemanticChannelRole('transient.instantMap', channels).channel?.id).toBe('instantMAPValue');\n    expect(resolveSemanticChannelRole('transient.aeFuel', channels).channel?.id).toBe('tpsAccelFuel');\n    expect(resolveSemanticChannelRole('transient.wallFuelCorrection', channels).channel?.id).toBe('wallFuelCorrectionValue');",
    1,
)
extra = """

  it('resolves binary cooling fan activity independently from PWM fan command', () => {
    const channels = [
      channel('fan1m_state', 'fan1m_state', 'Fan 1 state'),
      channel('fan1Pwm', 'fan1Pwm', 'Fan 1 PWM'),
      channel('enableFan1', 'enableFan1', 'Enable Fan 1'),
    ];
    expect(resolveSemanticChannelRole('cooling.fanActive', channels).channel?.id).toBe('fan1m_state');
    expect(resolveSemanticChannelRole('cooling.fanCommand', channels).channel?.id).toBe('fan1Pwm');
  });

  it('prefers the wall-film mass correction over the separate wall-wetting injection-time channel', () => {
    const channels = [
      channel('instantMAPValue', 'instantMAPValue', 'Instant MAP'),
      channel('wallFuelCorrectionValue', 'wallFuelCorrectionValue', 'Fuel: wall correction'),
      channel('wallFuelCorrection', 'wallFuelCorrection', 'fuel wallwetting injection time'),
    ];
    expect(resolveSemanticChannelRole('transient.instantMap', channels).channel?.id).toBe('instantMAPValue');
    expect(resolveSemanticChannelRole('transient.wallFuelCorrection', channels).channel?.id).toBe('wallFuelCorrectionValue');
  });
"""
text, count = re.subn(r"\n\}\);\s*$", extra + "\n});\n", text, count=1)
if count != 1:
    raise SystemExit('semantic tests: final describe close not found')
path.write_text(text)
