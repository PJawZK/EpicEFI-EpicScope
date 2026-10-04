from pathlib import Path

path = Path('apps/web/src/panels/range-qualification-panel.ts')
text = path.read_text(encoding='utf-8')
old = """  const setRange = (nextStartMs: number | undefined, nextEndMs: number | undefined): void => {
    startMs = nextStartMs;
    endMs = nextEndMs;
    const valid = startMs !== undefined && endMs !== undefined && startMs !== endMs;
    rangeText.textContent = valid
      ? `A/B span ${formatDurationMs(Math.abs(endMs - startMs))}`
      : 'Set A and B to define a range.';
    runButton.disabled = !valid || channels.length === 0;
    resetResult();
  };"""
new = """  const setRange = (nextStartMs: number | undefined, nextEndMs: number | undefined): void => {
    startMs = nextStartMs;
    endMs = nextEndMs;
    const valid = nextStartMs !== undefined && nextEndMs !== undefined && nextStartMs !== nextEndMs;
    rangeText.textContent = valid
      ? `A/B span ${formatDurationMs(Math.abs(nextEndMs - nextStartMs))}`
      : 'Set A and B to define a range.';
    runButton.disabled = !valid || channels.length === 0;
    resetResult();
  };"""
if old not in text:
    raise SystemExit('range qualification setRange anchor not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
