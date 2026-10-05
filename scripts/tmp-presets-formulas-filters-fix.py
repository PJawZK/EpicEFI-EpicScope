from pathlib import Path

p = Path('scripts/tmp-presets-formulas-filters.py')
s = p.read_text(encoding='utf-8')
start = s.index('# Render: replace conditions/request loading and qualification with logical/grouped.')
end = s.index('# Filter description grouped.', start)
section = r'''# Render: replace conditions/request loading and qualification with logical/grouped.
s = rep(s,
    "    const conditions = enabledConditions();",
    "    const groups = qualificationGroups();\n    const filterChannelIds = groups.flatMap((group) => group.conditions.map((condition) => condition.channelId));",
    'render groups')
old = """    const requestedIds = [...new Set([
      xId,
      yId,
      ...(zId ? [zId] : []),
      ...(deltaId ? [deltaId] : []),
      ...conditions.map((condition) => condition.channelId),
    ])];
    const loaded = await context.loadTraces(requestedIds, scope.startMs, scope.endMs);
    if (generation !== renderGeneration) return;
    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const xTrace = byId.get(xId);
    const yTrace = byId.get(yId);
    const zTrace = zId ? byId.get(zId) : undefined;
    const deltaTrace = deltaId ? byId.get(deltaId) : undefined;
"""
new = """    const requestedIds = [...new Set([
      xId,
      yId,
      ...(zId ? [zId] : []),
      ...(deltaId ? [deltaId] : []),
      ...filterChannelIds,
    ])];
    let byId: ReadonlyMap<string, HistogramTraceContext>;
    try {
      byId = await materializeLogicalTraces(requestedIds, scope);
    } catch (error) {
      if (generation !== renderGeneration) return;
      currentResult = undefined;
      empty.hidden = false;
      empty.querySelector('strong')!.textContent = 'Calculated field could not be evaluated.';
      empty.querySelector('span')!.textContent = error instanceof Error ? error.message : 'Check the saved formula.';
      canvas.hidden = true;
      status.hidden = true;
      exportButton.disabled = true;
      return;
    }
    if (generation !== renderGeneration) return;
    const xTrace = byId.get(xId);
    const yTrace = byId.get(yId);
    const zTrace = zId ? byId.get(zId) : undefined;
    const deltaTrace = deltaId ? byId.get(deltaId) : undefined;
"""
if old not in s: raise SystemExit('missing render loading block')
s = s.replace(old, new, 1)

old = """    const qualificationChannels = new Map<string, { range: HistogramTraceContext['range']; complete: boolean }>();
    qualificationChannels.set(xTrace.channel.id, { range: xTrace.range, complete: xTrace.complete });
    for (const condition of conditions) {
      const trace = byId.get(condition.channelId);
      if (trace) qualificationChannels.set(trace.channel.id, { range: trace.range, complete: trace.complete });
    }
    const qualified = qualifyNumericSamples({
      referenceChannelId: xTrace.channel.id,
      channels: qualificationChannels,
      conditions,
      ...(scope.startMs !== undefined && scope.endMs !== undefined
        ? { timeRange: { startMs: scope.startMs, endMs: scope.endMs } }
        : {}),
    });
"""
new = """    const qualificationChannels = new Map<string, { range: HistogramTraceContext['range']; complete: boolean }>();
    qualificationChannels.set(xId, { range: xTrace.range, complete: xTrace.complete });
    for (const channelId of filterChannelIds) {
      const trace = byId.get(channelId);
      if (trace) qualificationChannels.set(channelId, { range: trace.range, complete: trace.complete });
    }
    const qualified = qualifyNumericSampleGroups({
      referenceChannelId: xId,
      channels: qualificationChannels,
      groupLogic: filterBetweenLogicSelect.value as NumericQualificationLogic,
      groups,
      ...(scope.startMs !== undefined && scope.endMs !== undefined
        ? { timeRange: { startMs: scope.startMs, endMs: scope.endMs } }
        : {}),
    });
"""
if old not in s: raise SystemExit('missing qualification block')
s = s.replace(old, new, 1)

'''
s = s[:start] + section + s[end:]
s = s.replace("marker = \"  addFilterButton.addEventListener('click', addFilter);\"", "marker = \"  addFilterButton.addEventListener('click', () => addFilter());\"")
p.write_text(s, encoding='utf-8')
Path('scripts/tmp-presets-formulas-filters-fix.py').unlink(missing_ok=True)
