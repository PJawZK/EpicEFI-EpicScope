from pathlib import Path
p = Path('.github/scripts/temp_scatter_csv_export.py')
text = p.read_text()
old = """old = '''- selected-region → Logger navigation focused on the strongest contiguous visit instead of the full first-to-last hit envelope;\\n- shared Logger timeline.\\n\\n### Scatter worthwhile future work\\n\\nThe initial richer evidence-selection slice is complete with box selection. Useful later additions include:\\n\\n- saved view/setup presets;\\n- CSV export of selected/all X/Y evidence;\\n- optional compact correlation/linear-fit summary where genuinely useful;\\n- replacement of the remaining timeline text/DOM bridge with direct shared state propagation.\\n\\nThe timeline-state replacement belongs with the planned cleanup/consolidation work unless it becomes a correctness problem earlier.\\n'''"""
new = """old = '''- selected-region → Logger navigation focused on the strongest contiguous visit instead of the full first-to-last hit envelope;\\n- shared Logger timeline.\\n\\n### Scatter worthwhile future work\\n\\nThe initial richer evidence-selection slice is complete with box selection. Useful later additions include:\\n\\n- CSV export of selected/all X/Y evidence;\\n- optional compact correlation/linear-fit summary where genuinely useful;\\n- replacement of the remaining timeline text/DOM bridge with direct shared state propagation.\\n\\nThe timeline-state replacement belongs with the planned cleanup/consolidation work unless it becomes a correctness problem earlier.\\n'''"""
if text.count(old) != 1:
    raise SystemExit(f'expected one transform anchor, found {text.count(old)}')
text = text.replace(old, new, 1)
text = text.replace('readonly xUnit?: string;', 'readonly xUnit?: string | undefined;')
text = text.replace('readonly yUnit?: string;', 'readonly yUnit?: string | undefined;')
text = text.replace('readonly selectedSampleIndices?: ArrayLike<number>;', 'readonly selectedSampleIndices?: ArrayLike<number> | undefined;')
p.write_text(text)
