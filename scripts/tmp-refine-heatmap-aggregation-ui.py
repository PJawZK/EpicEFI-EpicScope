from pathlib import Path

view = Path('apps/web/src/pages/heatmap-view.ts')
text = view.read_text(encoding='utf-8')
old = """        const normalized = valueSpan > 0 && valueMin !== undefined
          ? Math.max(0, Math.min(1, (value - valueMin) / valueSpan))
          : 1;
        const intensity = result.aggregationMethod === 'count' ? Math.sqrt(normalized) : normalized;"""
new = """        const normalized = result.aggregationMethod === 'count'
          ? Math.max(0, Math.min(1, value / Math.max(1, result.maxCellCount)))
          : valueSpan > 0 && valueMin !== undefined
            ? Math.max(0, Math.min(1, (value - valueMin) / valueSpan))
            : 1;
        const intensity = result.aggregationMethod === 'count' ? Math.sqrt(normalized) : normalized;"""
if old not in text:
    raise SystemExit('Heatmap scaling anchor not found')
view.write_text(text.replace(old, new, 1), encoding='utf-8')

css = Path('apps/web/src/styles/histogram.css')
css_text = css.read_text(encoding='utf-8')
addition = """

.heatmap-value-evidence {
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 7px 9px;
  border: 1px solid #263b4c;
  border-radius: 4px;
  background: #0b171f;
  flex-wrap: wrap;
}

.heatmap-value-evidence[hidden] {
  display: none;
}

.heatmap-value-evidence span {
  color: #78909e;
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.heatmap-value-evidence strong {
  margin-left: 4px;
  color: #dceaf1;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  text-transform: none;
  letter-spacing: normal;
}
"""
if '.heatmap-value-evidence {' not in css_text:
    css_text += addition
css.write_text(css_text, encoding='utf-8')
