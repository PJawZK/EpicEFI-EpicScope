from pathlib import Path

# Shared DOM controller: explicit H/V/2D tools + right-click configuration hook.
path = Path('apps/web/src/pages/ve-table-interaction-dom.ts')
text = path.read_text()
text = text.replace(
"""} from './ve-table-interaction';
""",
"""} from './ve-table-interaction';
import { installTableToolConfiguration, type TableToolConfigurationOwner } from './ve-table-tool-options-dom';
""", 1)
text = text.replace(
"""  readonly adjustBrushRadius?: (delta: 1 | -1) => void;
}
""",
"""  readonly adjustBrushRadius?: (delta: 1 | -1) => void;
  readonly configuration?: TableToolConfigurationOwner;
}
""", 1)
old = """  const smooth = createToolButton('Smooth', 'Smooth selected cells', () => run(() => session.smooth(preferences.smoothStrength())));
  const interpolate = createToolButton('Interpolate', 'Interpolate selected cells', () => run(() => session.interpolate(preferences.interpolation())));
  const pin = createToolButton('Pin', 'Pin or unpin selected cells', () => {
"""
new = """  const smooth = createToolButton('Smooth', 'Smooth selected cells · right-click settings', () => run(() => session.smooth(preferences.smoothStrength())));
  const interpolateWith = (axis: 'horizontal' | 'vertical' | 'both'): void => {
    const configured = preferences.interpolation();
    run(() => session.interpolate({ ...configured, axis }));
  };
  const interpolateHorizontal = createToolButton('H', 'Interpolate horizontally · right-click settings', () => interpolateWith('horizontal'));
  const interpolateVertical = createToolButton('V', 'Interpolate vertically · right-click settings', () => interpolateWith('vertical'));
  const interpolateBoth = createToolButton('2D', 'Interpolate both directions · right-click settings', () => interpolateWith('both'));
  const pin = createToolButton('Pin', 'Pin or unpin selected cells', () => {
"""
if old not in text:
    raise SystemExit('interpolation toolbar anchor missing')
text = text.replace(old, new, 1)
old = """  toolbar.append(undo, redo, decrement, increment, smooth, interpolate, pin, brush, revert, clear);

  const cellFor = (position: TableCellPosition): HTMLTableCellElement | undefined =>
"""
new = """  toolbar.append(undo, redo, decrement, increment, pin, brush, interpolateHorizontal, interpolateVertical, interpolateBoth, smooth, revert, clear);
  const closeToolConfiguration = preferences.configuration
    ? installTableToolConfiguration(toolbar, {
      decrement,
      increment,
      smooth,
      interpolateHorizontal,
      interpolateVertical,
      interpolateBoth,
      brush,
    }, preferences.configuration, () => refresh())
    : () => {};

  const cellFor = (position: TableCellPosition): HTMLTableCellElement | undefined =>
"""
if old not in text:
    raise SystemExit('toolbar append anchor missing')
text = text.replace(old, new, 1)
old = """    const radius = preferences.brush().radius;
    brush.title = `Continuous brush editing · radius ${radius}${preferences.adjustBrushRadius ? ' · mouse wheel adjusts radius' : ''}`;
  };
"""
new = """    const step = preferences.adjustmentStep();
    const smoothStrength = preferences.smoothStrength();
    const interpolation = preferences.interpolation();
    const brushOptions = preferences.brush();
    decrement.title = `Decrease selected cells by ${step} · right-click to change step`;
    increment.title = `Increase selected cells by ${step} · right-click to change step`;
    smooth.title = `Smooth selected cells · intensity ${smoothStrength.toFixed(2)} · right-click to change`;
    const interpolationSuffix = `strength ${(interpolation.strength ?? 1).toFixed(2)}${interpolation.clamp === false ? '' : ' · clamped'} · right-click settings`;
    interpolateHorizontal.title = `Interpolate horizontally · ${interpolation.method1d ?? 'linear'} · ${interpolationSuffix}`;
    interpolateVertical.title = `Interpolate vertically · ${interpolation.method1d ?? 'linear'} · ${interpolationSuffix}`;
    interpolateBoth.title = `Interpolate both directions · ${interpolation.method2d ?? 'bilinear'} · ${interpolationSuffix}`;
    brush.title = `Continuous brush editing · ${brushOptions.delta >= 0 ? '+' : ''}${brushOptions.delta} · radius ${brushOptions.radius} · strength ${(brushOptions.strength ?? 1).toFixed(2)} · ${brushOptions.falloff ?? 'linear'} falloff · Shift reverses${preferences.adjustBrushRadius ? ' · wheel changes radius' : ''} · right-click settings`;
  };
"""
if old not in text:
    raise SystemExit('refresh title anchor missing')
text = text.replace(old, new, 1)
old = """    destroyed = true;
    toolbar.remove();
  };
"""
new = """    closeToolConfiguration();
    destroyed = true;
    toolbar.remove();
  };
"""
if old not in text:
    raise SystemExit('destroy anchor missing')
text = text.replace(old, new, 1)
path.write_text(text)

# Lambda adapter: persisted preference owner rather than hardcoded defaults/session brush radius.
path = Path('apps/web/src/pages/ve-analyzer-delay-table-interaction.ts')
text = path.read_text()
text = text.replace(
"""import '../styles/ve-table-interaction-dom.css';
""",
"""import {
  brushOptions,
  interpolationOptions,
  loadVeTableToolPreferences,
  resetVeTableToolPreferences,
  saveVeTableToolPreferences,
  type VeTableToolPreferences,
} from '../state/ve-table-tool-preferences';
import '../styles/ve-table-interaction-dom.css';
""", 1)
old = """  const surface = new VeDelayTableEditSurface(owner);
  const session = new TableInteractionSession(surface);
  let brushRadius = 1;
  const dom = createTableInteractionDomController(session, {
    adjustmentStep: () => 10,
    smoothStrength: () => 0.5,
    interpolation: () => ({ axis: 'both', method1d: 'linear', method2d: 'boundary', strength: 1, clamp: true }),
    brush: () => ({ delta: 5, radius: brushRadius, strength: 1, falloff: 'linear' }),
    readValue: (position) => surface.valueAt(position),
    adjustBrushRadius: (delta) => { brushRadius = Math.max(0, Math.min(4, brushRadius + delta)); },
  }, {
"""
new = """  const surface = new VeDelayTableEditSurface(owner);
  const session = new TableInteractionSession(surface);
  let toolPreferences = loadVeTableToolPreferences('delay');
  const saveToolPreferences = (next: VeTableToolPreferences): void => {
    toolPreferences = saveVeTableToolPreferences('delay', next);
  };
  const resetToolPreference = (kind: 'step' | 'smooth' | 'interpolation' | 'brush'): void => {
    const defaults = resetVeTableToolPreferences('delay');
    if (kind === 'step') saveToolPreferences({ ...toolPreferences, adjustmentStep: defaults.adjustmentStep });
    else if (kind === 'smooth') saveToolPreferences({ ...toolPreferences, smoothStrength: defaults.smoothStrength });
    else if (kind === 'interpolation') saveToolPreferences({ ...toolPreferences, interpolation: defaults.interpolation });
    else saveToolPreferences({ ...toolPreferences, brush: defaults.brush });
  };
  const dom = createTableInteractionDomController(session, {
    adjustmentStep: () => toolPreferences.adjustmentStep,
    smoothStrength: () => toolPreferences.smoothStrength,
    interpolation: () => interpolationOptions(toolPreferences, 'both'),
    brush: () => brushOptions(toolPreferences),
    readValue: (position) => surface.valueAt(position),
    adjustBrushRadius: (delta) => saveToolPreferences({
      ...toolPreferences,
      brush: { ...toolPreferences.brush, radius: Math.max(1, Math.min(8, toolPreferences.brush.radius + delta)) },
    }),
    configuration: {
      label: 'Lambda Delay',
      adjustmentStep: () => toolPreferences.adjustmentStep,
      setAdjustmentStep: (value) => saveToolPreferences({ ...toolPreferences, adjustmentStep: value }),
      smoothStrength: () => toolPreferences.smoothStrength,
      setSmoothStrength: (value) => saveToolPreferences({ ...toolPreferences, smoothStrength: value }),
      interpolation: () => interpolationOptions(toolPreferences, 'both'),
      setInterpolation: (value) => saveToolPreferences({
        ...toolPreferences,
        interpolation: {
          method1d: value.method1d ?? toolPreferences.interpolation.method1d,
          method2d: value.method2d ?? toolPreferences.interpolation.method2d,
          strength: value.strength ?? toolPreferences.interpolation.strength,
          clamp: value.clamp ?? toolPreferences.interpolation.clamp,
        },
      }),
      brush: () => brushOptions(toolPreferences),
      setBrush: (value) => saveToolPreferences({
        ...toolPreferences,
        brush: {
          delta: value.delta,
          radius: value.radius,
          strength: value.strength ?? toolPreferences.brush.strength,
          falloff: value.falloff ?? toolPreferences.brush.falloff,
        },
      }),
      reset: resetToolPreference,
    },
  }, {
"""
if old not in text:
    raise SystemExit('Lambda preference block missing')
text = text.replace(old, new, 1)
path.write_text(text)

# Styling for contextual option popover.
path = Path('apps/web/src/styles/ve-table-interaction-dom.css')
text = path.read_text()
text += '''

.ve-table-edit-toolbar {
  position: relative;
}

.ve-table-tool-options {
  position: absolute;
  z-index: 120;
  display: grid;
  grid-template-columns: repeat(2, minmax(145px, 1fr));
  gap: 8px;
  width: min(310px, calc(100vw - 28px));
  padding: 10px;
  border: 1px solid #31505f;
  border-radius: 5px;
  background: #0b151e;
  box-shadow: 0 10px 28px rgba(0, 0, 0, .42);
}

.ve-table-tool-options-head,
.ve-table-tool-options-foot {
  grid-column: 1 / -1;
}

.ve-table-tool-options-head {
  display: grid;
  gap: 3px;
}

.ve-table-tool-options-head strong {
  color: #dce9ef;
  font-size: 10px;
}

.ve-table-tool-options-head span,
.ve-table-tool-options-foot {
  color: #8299a5;
  font-size: 8px;
  line-height: 1.35;
}

.ve-table-tool-options > label {
  display: grid;
  gap: 4px;
  min-width: 0;
  color: #8399a4;
  font-size: 8px;
  font-weight: 700;
}

.ve-table-tool-options input,
.ve-table-tool-options select {
  width: 100%;
  min-width: 0;
  min-height: 30px;
  padding: 0 6px;
  border: 1px solid #2f4b59;
  border-radius: 3px;
  background: #101d28;
  color: #dbe8ef;
}

.ve-table-tool-options .ve-table-tool-options-check {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 7px;
}

.ve-table-tool-options .ve-table-tool-options-check input {
  width: auto;
  min-height: 0;
}

.ve-table-tool-options-foot {
  display: flex;
  justify-content: flex-end;
}

.ve-table-tool-options-foot button {
  min-height: 28px;
}
'''
path.write_text(text)
