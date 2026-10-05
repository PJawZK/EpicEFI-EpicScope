from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    if old not in s:
        raise SystemExit(f'anchor not found in {path}: {old[:80]!r}')
    p.write_text(s.replace(old, new, 1), encoding='utf-8')


def replace_const_block(path, anchor, replacement):
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    start = s.find(anchor)
    if start < 0:
        raise SystemExit(f'block anchor not found in {path}: {anchor}')
    brace = s.find('{', start)
    depth = 0
    end = None
    for i in range(brace, len(s)):
        if s[i] == '{': depth += 1
        elif s[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                if s[end:end+1] == ';': end += 1
                break
    if end is None:
        raise SystemExit(f'unclosed block in {path}: {anchor}')
    p.write_text(s[:start] + replacement + s[end:], encoding='utf-8')

# Logger: full available channel catalog + scoped on-demand resolver.
replace_once(
    'apps/web/src/pages/logger-page.ts',
    "export interface LoggerAnalysisContext {\n  readonly traces: readonly LoggerAnalysisTraceContext[];\n  readonly aTimeMs: number | undefined;\n  readonly bTimeMs: number | undefined;\n  readonly savedRanges: readonly import('../state/workspace-state').SavedTimelineRangeState[];\n}",
    "export interface LoggerAnalysisContext {\n  /** Already-decoded traces from the active Logger pane, retained as a fast-path/fallback. */\n  readonly traces: readonly LoggerAnalysisTraceContext[];\n  /** Every numeric/bitfield channel that is actually available from the loaded log/binding. */\n  readonly channels: readonly ChannelDefinition[];\n  /** Decode only the channels an analysis task requests, scoped to the requested time window when possible. */\n  readonly loadTraces: (\n    channelIds: readonly string[],\n    startMs?: number,\n    endMs?: number,\n  ) => Promise<readonly LoggerAnalysisTraceContext[]>;\n  readonly aTimeMs: number | undefined;\n  readonly bTimeMs: number | undefined;\n  readonly savedRanges: readonly import('../state/workspace-state').SavedTimelineRangeState[];\n}"
)

logger_analysis = r'''  const getAnalysisContext = (): LoggerAnalysisContext => {
    const runtime = activePaneRuntime();
    const traces = runtime
      ? runtime.graph.getOverviewTraces().flatMap((trace) => {
          const channel = channelDefinitions.get(trace.channelId);
          if (!channel) return [];
          return [{
            channel,
            range: trace.range,
            complete: channelDataSource !== undefined
              && trace.range.startSampleIndex === 0
              && trace.range.values.length >= channelDataSource.sampleCount,
            color: trace.color,
          }];
        })
      : [];

    const channels = [...channelDefinitions.values()]
      .filter((channel) => !unavailableChannelIds.has(channel.id))
      .sort((left, right) => (left.displayName || left.sourceName).localeCompare(
        right.displayName || right.sourceName,
        undefined,
        { numeric: true, sensitivity: 'base' },
      ));
    const activeColors = new Map(traces.map((trace) => [trace.channel.id, trace.color]));
    const palette = ['#58aef6', '#ffb15a', '#7ddf8a', '#df7dcb', '#ffd45a', '#67d8d2', '#ff7f7f', '#9ca7ff'];
    const colorFor = (channelId: string): string => {
      const active = activeColors.get(channelId);
      if (active) return active;
      let hash = 0;
      for (let index = 0; index < channelId.length; index += 1) hash = ((hash * 31) + channelId.charCodeAt(index)) | 0;
      return palette[Math.abs(hash) % palette.length]!;
    };

    const loadTraces = async (
      channelIds: readonly string[],
      startMs?: number,
      endMs?: number,
    ): Promise<readonly LoggerAnalysisTraceContext[]> => {
      const source = channelDataSource;
      if (!source) return [];
      const requestedIds = [...new Set(channelIds)].filter((channelId) =>
        channelDefinitions.has(channelId) && !unavailableChannelIds.has(channelId));
      if (requestedIds.length === 0) return [];

      let startSampleIndex = 0;
      let sampleCount = source.sampleCount;
      if (
        startMs !== undefined
        && endMs !== undefined
        && Number.isFinite(startMs)
        && Number.isFinite(endMs)
        && source.sampleRangeForTime
      ) {
        const scoped = source.sampleRangeForTime(Math.min(startMs, endMs), Math.max(startMs, endMs));
        startSampleIndex = Math.max(0, Math.min(source.sampleCount, scoped.startSampleIndex));
        sampleCount = Math.max(0, Math.min(source.sampleCount - startSampleIndex, scoped.sampleCount));
      }
      if (sampleCount <= 0) return [];

      const ranges = new Map<string, NumericChannelRange>();
      if (source.readChannelsRange && requestedIds.length > 1) {
        const batch = await source.readChannelsRange(requestedIds, startSampleIndex, sampleCount);
        for (const [channelId, range] of batch.ranges) ranges.set(channelId, range);
      } else {
        const resolved = await Promise.all(requestedIds.map(async (channelId) => [
          channelId,
          await source.readChannelRange(channelId, startSampleIndex, sampleCount),
        ] as const));
        for (const [channelId, range] of resolved) ranges.set(channelId, range);
      }

      return requestedIds.flatMap((channelId) => {
        const channel = channelDefinitions.get(channelId);
        const range = ranges.get(channelId);
        if (!channel || !range) return [];
        return [{
          channel,
          range,
          complete: range.startSampleIndex <= startSampleIndex && range.values.length >= sampleCount,
          color: colorFor(channelId),
        }];
      });
    };

    return {
      traces,
      channels,
      loadTraces,
      aTimeMs: analysisStartMs,
      bTimeMs: analysisEndMs,
      savedRanges: timeline.getWorkspaceState().savedRanges.map((range) => ({ ...range })),
    };
  };'''
replace_const_block('apps/web/src/pages/logger-page.ts', '  const getAnalysisContext = (): LoggerAnalysisContext => {', logger_analysis)

# Histogram context + distribution selection.
replace_once(
    'apps/web/src/pages/histogram-page.ts',
    "export interface HistogramPageContext {\n  readonly traces: readonly HistogramTraceContext[];\n  readonly aTimeMs: number | undefined;\n  readonly bTimeMs: number | undefined;\n}",
    "export interface HistogramPageContext {\n  readonly traces: readonly HistogramTraceContext[];\n  readonly channels: readonly ChannelDefinition[];\n  readonly loadTraces: (channelIds: readonly string[], startMs?: number, endMs?: number) => Promise<readonly HistogramTraceContext[]>;\n  readonly aTimeMs: number | undefined;\n  readonly bTimeMs: number | undefined;\n}"
)
replace_once('apps/web/src/pages/histogram-page.ts',
    "let context: HistogramPageContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined };",
    "let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };")
replace_once('apps/web/src/pages/histogram-page.ts',
    "<div class=\"histogram-workspace-hint\">A/B range · active decoded Logger channels</div>",
    "<div class=\"histogram-workspace-hint\">A/B range · all available log channels · selected channels decode on demand</div>")
replace_once('apps/web/src/pages/histogram-page.ts',
    "<span>Set A and B in Logger and keep the channel active in the current graph pane.</span>",
    "<span>Set A and B in Logger, then select any available log channel here.</span>")
replace_once('apps/web/src/pages/histogram-page.ts',
    "  const selectedTrace = (): HistogramTraceContext | undefined => context.traces.find((trace) => trace.channel.id === channelSelect.value) ?? context.traces[0];\n",
    "")
replace_once('apps/web/src/pages/histogram-page.ts',
    "  const renderDistribution = (): void => {\n    const trace = selectedTrace();\n    if (!trace || !hasValidRange()) {",
    "  const renderDistribution = async (): Promise<void> => {\n    const channelId = channelSelect.value || context.channels[0]?.id;\n    if (!channelId || !hasValidRange()) {")
replace_once('apps/web/src/pages/histogram-page.ts',
    "    const startMs = Math.min(context.aTimeMs!, context.bTimeMs!);\n    const endMs = Math.max(context.aTimeMs!, context.bTimeMs!);\n    const channels = new Map([[trace.channel.id, { range: trace.range, complete: trace.complete }]]);",
    "    const startMs = Math.min(context.aTimeMs!, context.bTimeMs!);\n    const endMs = Math.max(context.aTimeMs!, context.bTimeMs!);\n    const [trace] = await context.loadTraces([channelId], startMs, endMs);\n    if (!trace) {\n      currentResult = undefined;\n      currentTrace = undefined;\n      empty.hidden = false;\n      canvas.hidden = true;\n      status.hidden = true;\n      return;\n    }\n    const channels = new Map([[trace.channel.id, { range: trace.range, complete: trace.complete }]]);")
replace_once('apps/web/src/pages/histogram-page.ts',
    "    for (const trace of context.traces) channelSelect.add(new Option(trace.channel.displayName || trace.channel.sourceName, trace.channel.id));\n    if (previousChannel && context.traces.some((trace) => trace.channel.id === previousChannel)) channelSelect.value = previousChannel;",
    "    for (const channel of context.channels) channelSelect.add(new Option(channel.displayName || channel.sourceName, channel.id));\n    if (previousChannel && context.channels.some((channel) => channel.id === previousChannel)) channelSelect.value = previousChannel;")
replace_once('apps/web/src/pages/histogram-page.ts',
    "    if (activeView === 'distribution') renderDistribution();",
    "    if (activeView === 'distribution') void renderDistribution();")
replace_once('apps/web/src/pages/histogram-page.ts',
    "  channelSelect.addEventListener('change', renderDistribution);\n  binCountSelect.addEventListener('change', renderDistribution);",
    "  channelSelect.addEventListener('change', () => { void renderDistribution(); });\n  binCountSelect.addEventListener('change', () => { void renderDistribution(); });")

# Heatmap: full catalog selectors + scoped on-demand selected traces.
replace_once('apps/web/src/pages/heatmap-view.ts',
    "let context: HistogramPageContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined };",
    "let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };")
replace_once('apps/web/src/pages/heatmap-view.ts',
    "  const traceFor = (channelId: string): HistogramTraceContext | undefined => context.traces.find((trace) => trace.channel.id === channelId);\n",
    "")
replace_once('apps/web/src/pages/heatmap-view.ts',
    "<strong>Heatmap needs a selected range and two active channels.</strong>\n        <span>Set A/B in Logger and keep the required channels active in the current graph pane.</span>",
    "<strong>Heatmap needs a selected range and two available channels.</strong>\n        <span>Set A/B in Logger, then choose any X/Y/value channels present in the loaded log.</span>")
replace_const_block('apps/web/src/pages/heatmap-view.ts', '  const render = (): void => {', r'''  const render = async (): Promise<void> => {
    const xId = xSelect.value || context.channels[0]?.id;
    const yId = ySelect.value || context.channels[1]?.id || context.channels[0]?.id;
    const aggregation = selectedAggregation();
    const valueId = aggregation === 'count' ? undefined : (valueSelect.value || context.channels[0]?.id);
    valueField.hidden = aggregation === 'count';

    if (!xId || !yId || context.channels.length < 2 || !hasValidRange() || (aggregation !== 'count' && !valueId)) {
      currentResult = undefined;
      currentXTrace = undefined;
      currentYTrace = undefined;
      empty.hidden = false;
      canvas.hidden = true;
      status.hidden = true;
      return;
    }

    const startMs = Math.min(context.aTimeMs!, context.bTimeMs!);
    const endMs = Math.max(context.aTimeMs!, context.bTimeMs!);
    const loaded = await context.loadTraces([xId, yId, ...(valueId ? [valueId] : [])], startMs, endMs);
    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const xTrace = byId.get(xId);
    const yTrace = byId.get(yId);
    const valueTrace = valueId ? byId.get(valueId) : undefined;
    if (!xTrace || !yTrace || (aggregation !== 'count' && !valueTrace)) {
      currentResult = undefined;
      currentXTrace = undefined;
      currentYTrace = undefined;
      empty.hidden = false;
      canvas.hidden = true;
      status.hidden = true;
      return;
    }

    const channels = new Map([[xTrace.channel.id, { range: xTrace.range, complete: xTrace.complete }]]);
    const scoped = qualifyNumericSamples({ referenceChannelId: xTrace.channel.id, channels, conditions: [], timeRange: { startMs, endMs } });

    currentResult = buildNumericHeatmap(xTrace.range, yTrace.range, {
      sampleIndices: scoped.eligibleSampleIndices,
      xBinCount: Number(xBinsSelect.value),
      yBinCount: Number(yBinsSelect.value),
      aggregation,
      ...(valueTrace ? { valueRange: valueTrace.range } : {}),
    });
    currentXTrace = xTrace;
    currentYTrace = yTrace;

    const yComplete = yTrace.complete || numericRangeCoversTime(yTrace.range, startMs, endMs);
    const valueComplete = !valueTrace || valueTrace.complete || numericRangeCoversTime(valueTrace.range, startMs, endMs);
    const complete = scoped.complete && yComplete && valueComplete && currentResult.unavailableSampleCount === 0 && currentResult.valueUnavailableSampleCount === 0;
    const unit = cellValueUnit(aggregation, valueTrace);
    const cellMeaning = aggregation === 'count' ? 'Count' : `${aggregationLabel(aggregation)} · ${channelLabel(valueTrace!)}`;

    empty.hidden = true;
    canvas.hidden = false;
    status.hidden = false;
    summary('scope').textContent = `A/B ${((endMs - startMs) / 1000).toFixed(3)} s`;
    summary('coverage').textContent = complete ? 'Complete' : 'Partial decoded';
    summary('valid').textContent = currentResult.validPairSampleCount.toLocaleString();
    summary('binned').textContent = currentResult.binnedSampleCount.toLocaleString();
    summary('cell-value').textContent = cellMeaning;
    summary('cell-range').textContent = currentResult.cellValueMin === undefined || currentResult.cellValueMax === undefined
      ? '—'
      : `${formatNumber(currentResult.cellValueMin)}–${formatNumber(currentResult.cellValueMax)}${unit ? ` ${unit}` : ''}`;
    renderChart(currentResult, xTrace, yTrace);
  };''')
replace_once('apps/web/src/pages/heatmap-view.ts',
    "    for (const trace of context.traces) {\n      const label = channelLabel(trace);\n      xSelect.add(new Option(label, trace.channel.id));\n      ySelect.add(new Option(label, trace.channel.id));\n      valueSelect.add(new Option(label, trace.channel.id));\n    }\n    if (context.traces.some((trace) => trace.channel.id === previousX)) xSelect.value = previousX;\n    if (context.traces.some((trace) => trace.channel.id === previousY)) ySelect.value = previousY;\n    else if (context.traces[1]) ySelect.value = context.traces[1].channel.id;\n    if (context.traces.some((trace) => trace.channel.id === previousValue)) valueSelect.value = previousValue;",
    "    for (const channel of context.channels) {\n      const label = channel.displayName || channel.sourceName;\n      xSelect.add(new Option(label, channel.id));\n      ySelect.add(new Option(label, channel.id));\n      valueSelect.add(new Option(label, channel.id));\n    }\n    if (context.channels.some((channel) => channel.id === previousX)) xSelect.value = previousX;\n    if (context.channels.some((channel) => channel.id === previousY)) ySelect.value = previousY;\n    else if (context.channels[1]) ySelect.value = context.channels[1].id;\n    if (context.channels.some((channel) => channel.id === previousValue)) valueSelect.value = previousValue;")
replace_once('apps/web/src/pages/heatmap-view.ts', "    render();\n  };\n\n  [xSelect", "    void render();\n  };\n\n  [xSelect")
replace_once('apps/web/src/pages/heatmap-view.ts',
    "].forEach((control) => control.addEventListener('change', render));",
    "].forEach((control) => control.addEventListener('change', () => { void render(); }));")
replace_once('apps/web/src/pages/heatmap-view.ts',
    "  return { element: root, setContext, refresh: render };",
    "  return { element: root, setContext, refresh: () => { void render(); } };")

# Scatter: full catalog + on-demand pair decode.
replace_once('apps/web/src/pages/scatter-view.ts',
    "let context: HistogramPageContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined };",
    "let context: HistogramPageContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined };")
replace_once('apps/web/src/pages/scatter-view.ts',
    "  const traceFor = (channelId: string): HistogramTraceContext | undefined =>\n    context.traces.find((trace) => trace.channel.id === channelId);\n\n",
    "")
replace_once('apps/web/src/pages/scatter-view.ts',
    "<strong>Scatter needs a selected range and two active channels.</strong>\n      <span>Return to Logger, set A and B, and keep both X and Y channels active in the current graph pane.</span>",
    "<strong>Scatter needs a selected range and two available channels.</strong>\n      <span>Set A/B in Logger, then choose any X and Y channels present in the loaded log.</span>")
replace_const_block('apps/web/src/pages/scatter-view.ts', '  const render = (): void => {', r'''  const render = async (): Promise<void> => {
    const xId = xSelect.value || context.channels[0]?.id;
    const yId = ySelect.value || context.channels[1]?.id || context.channels[0]?.id;
    if (!xId || !yId || context.channels.length < 2 || !hasValidRange()) {
      currentResult = undefined;
      renderedPointCount = 0;
      empty.hidden = false;
      content.hidden = true;
      refreshButton.disabled = true;
      return;
    }

    refreshButton.disabled = false;
    const startMs = Math.min(context.aTimeMs!, context.bTimeMs!);
    const endMs = Math.max(context.aTimeMs!, context.bTimeMs!);
    const loaded = await context.loadTraces([xId, yId], startMs, endMs);
    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));
    const xTrace = byId.get(xId);
    const yTrace = byId.get(yId);
    if (!xTrace || !yTrace) {
      currentResult = undefined;
      renderedPointCount = 0;
      empty.hidden = false;
      content.hidden = true;
      return;
    }
    const channels = new Map([[xTrace.channel.id, { range: xTrace.range, complete: xTrace.complete }]]);
    const scoped = qualifyNumericSamples({
      referenceChannelId: xTrace.channel.id,
      channels,
      conditions: [],
      timeRange: { startMs, endMs },
    });
    currentResult = buildNumericScatter(xTrace.range, yTrace.range, { sampleIndices: scoped.eligibleSampleIndices });

    const yComplete = yTrace.complete || numericRangeCoversTime(yTrace.range, startMs, endMs);
    const complete = scoped.complete && yComplete && currentResult.unavailableSampleCount === 0;
    empty.hidden = true;
    content.hidden = false;
    summary('scope').textContent = `${((endMs - startMs) / 1000).toFixed(3)} s`;
    summary('coverage').textContent = complete ? 'Complete' : 'Partial decoded';
    summary('input').textContent = currentResult.inputSampleCount.toLocaleString();
    summary('valid').textContent = currentResult.validPairSampleCount.toLocaleString();
    summary('invalid').textContent = currentResult.invalidSampleCount.toLocaleString();
    summary('unavailable').textContent = currentResult.unavailableSampleCount.toLocaleString();
    summary('x-range').textContent = currentResult.xMin === undefined || currentResult.xMax === undefined
      ? '—'
      : `${formatNumber(currentResult.xMin)} – ${formatNumber(currentResult.xMax)}${xTrace.channel.unit ? ` ${xTrace.channel.unit}` : ''}`;
    summary('y-range').textContent = currentResult.yMin === undefined || currentResult.yMax === undefined
      ? '—'
      : `${formatNumber(currentResult.yMin)} – ${formatNumber(currentResult.yMax)}${yTrace.channel.unit ? ` ${yTrace.channel.unit}` : ''}`;
    renderChart(currentResult, xTrace, yTrace);
    summary('rendered').textContent = renderedPointCount.toLocaleString();
  };''')
replace_once('apps/web/src/pages/scatter-view.ts',
    "    for (const trace of context.traces) select.add(new Option(channelLabel(trace), trace.channel.id));\n    if (context.traces.some((trace) => trace.channel.id === preferred)) select.value = preferred;\n    else if (context.traces[fallbackIndex]) select.value = context.traces[fallbackIndex]!.channel.id;",
    "    for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));\n    if (context.channels.some((channel) => channel.id === preferred)) select.value = preferred;\n    else if (context.channels[fallbackIndex]) select.value = context.channels[fallbackIndex]!.id;")
replace_once('apps/web/src/pages/scatter-view.ts', "    render();\n  };\n\n  xSelect", "    void render();\n  };\n\n  xSelect")
replace_once('apps/web/src/pages/scatter-view.ts',
    "  xSelect.addEventListener('change', render);\n  ySelect.addEventListener('change', render);\n  refreshButton.addEventListener('click', render);",
    "  xSelect.addEventListener('change', () => { void render(); });\n  ySelect.addEventListener('change', () => { void render(); });\n  refreshButton.addEventListener('click', () => { void render(); });")
replace_once('apps/web/src/pages/scatter-view.ts',
    "    refresh: render,",
    "    refresh: () => { void render(); },")

# Analyzer range compare uses full catalog and resolves selected channel on demand.
replace_once('apps/web/src/pages/analyzer-page.ts',
    "let context: LoggerAnalysisContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };",
    "let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };")
replace_once('apps/web/src/pages/analyzer-page.ts',
    "  const selectedTrace = (): LoggerAnalysisTraceContext | undefined =>\n    context.traces.find((trace) => trace.channel.id === channelSelect.value) ?? context.traces[0];\n\n",
    "")
replace_once('apps/web/src/pages/analyzer-page.ts',
    "<strong>Analyzer needs one active channel and two saved ranges.</strong>\n      <span>Return to Logger, keep the channel active in the current pane, and save at least two A/B ranges.</span>",
    "<strong>Analyzer needs one available channel and two saved ranges.</strong>\n      <span>Save at least two A/B ranges in Logger, then choose any channel present in the loaded log.</span>")
replace_once('apps/web/src/pages/analyzer-page.ts',
    "  const render = (): void => {\n    if (currentView !== 'compare') return;\n    const trace = selectedTrace();\n    const leftRange = selectedRange(leftSelect);\n    const rightRange = selectedRange(rightSelect);\n    if (!trace || !leftRange || !rightRange || context.savedRanges.length < 2) {",
    "  const render = async (): Promise<void> => {\n    if (currentView !== 'compare') return;\n    const channelId = channelSelect.value || context.channels[0]?.id;\n    const leftRange = selectedRange(leftSelect);\n    const rightRange = selectedRange(rightSelect);\n    if (!channelId || !leftRange || !rightRange || context.savedRanges.length < 2) {")
replace_once('apps/web/src/pages/analyzer-page.ts',
    "    refreshButton.disabled = false;\n    const channels = new Map([[trace.channel.id, { range: trace.range, complete: trace.complete }]]);",
    "    refreshButton.disabled = false;\n    const loadStartMs = Math.min(leftRange.startMs, leftRange.endMs, rightRange.startMs, rightRange.endMs);\n    const loadEndMs = Math.max(leftRange.startMs, leftRange.endMs, rightRange.startMs, rightRange.endMs);\n    const [trace] = await context.loadTraces([channelId], loadStartMs, loadEndMs);\n    if (!trace) { empty.hidden = false; content.hidden = true; return; }\n    const channels = new Map([[trace.channel.id, { range: trace.range, complete: trace.complete }]]);")
replace_once('apps/web/src/pages/analyzer-page.ts',
    "    for (const trace of context.traces) channelSelect.add(new Option(channelLabel(trace), trace.channel.id));\n    if (context.traces.some((trace) => trace.channel.id === preferred)) channelSelect.value = preferred;",
    "    for (const channel of context.channels) channelSelect.add(new Option(channel.displayName || channel.sourceName, channel.id));\n    if (context.channels.some((channel) => channel.id === preferred)) channelSelect.value = preferred;")
replace_once('apps/web/src/pages/analyzer-page.ts',
    "      description.textContent = 'Compare one active decoded channel across two saved Logger ranges.';\n      render();",
    "      description.textContent = 'Compare any available log channel across two saved Logger ranges.';\n      void render();")
replace_once('apps/web/src/pages/analyzer-page.ts',
    "      description.textContent = 'Analyze boost tracking, spool and steady-state behavior from active decoded channels.';",
    "      description.textContent = 'Analyze boost tracking, spool and steady-state behavior using any channels available in the loaded log.';")
replace_once('apps/web/src/pages/analyzer-page.ts', "    render();\n  };\n\n  channelSelect", "    void render();\n  };\n\n  channelSelect")
replace_once('apps/web/src/pages/analyzer-page.ts',
    "  channelSelect.addEventListener('change', render);\n  leftSelect.addEventListener('change', render);\n  rightSelect.addEventListener('change', render);\n  refreshButton.addEventListener('click', render);",
    "  channelSelect.addEventListener('change', () => { void render(); });\n  leftSelect.addEventListener('change', () => { void render(); });\n  rightSelect.addEventListener('change', () => { void render(); });\n  refreshButton.addEventListener('click', () => { void render(); });")
replace_once('apps/web/src/pages/analyzer-page.ts',
    "      if (currentView === 'compare') render();",
    "      if (currentView === 'compare') void render();")

# Tune table: full channel catalog and on-demand scoped X/Y/Observed decode.
replace_once('apps/web/src/pages/tune-table-view.ts',
    "let context: LoggerAnalysisContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };",
    "let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };")
replace_once('apps/web/src/pages/tune-table-view.ts',
    "  const traceFor = (channelId: string): LoggerAnalysisTraceContext | undefined =>\n    context.traces.find((trace) => trace.channel.id === channelId);\n\n",
    "")
replace_once('apps/web/src/pages/tune-table-view.ts',
    "<strong>Tune Table needs an MSQ tune, active decoded traces, and a valid scope.</strong>\n      <span>Load an MSQ from Load Data, keep the required X/Y/observed channels active in Logger, and select A/B or a saved range.</span>",
    "<strong>Tune Table needs an MSQ tune, available log channels, and a valid scope.</strong>\n      <span>Load an MSQ, select any available X/Y/observed channels, and choose A/B or a saved range.</span>")
replace_once('apps/web/src/pages/tune-table-view.ts',
    "    for (const trace of context.traces) select.add(new Option(channelLabel(trace), trace.channel.id));\n    if (context.traces.some((trace) => trace.channel.id === preferred)) select.value = preferred;\n    else if (context.traces[fallbackIndex]) select.value = context.traces[fallbackIndex]!.channel.id;",
    "    for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));\n    if (context.channels.some((channel) => channel.id === preferred)) select.value = preferred;\n    else if (context.channels[fallbackIndex]) select.value = context.channels[fallbackIndex]!.id;")
replace_once('apps/web/src/pages/tune-table-view.ts',
    "  const render = (): void => {",
    "  const render = async (): Promise<void> => {")
replace_once('apps/web/src/pages/tune-table-view.ts',
    "    const scope = selectedScope();\n    const xTrace = traceFor(xChannelSelect.value) ?? context.traces[0];\n    const yTrace = traceFor(yChannelSelect.value) ?? context.traces[1] ?? context.traces[0];\n    const observedTrace = traceFor(observedSelect.value) ?? context.traces[2] ?? context.traces[0];\n    if (!tuneModel || !scope || !xTrace || !yTrace || !observedTrace || !tableSelect.value || !xAxisSelect.value || !yAxisSelect.value) {",
    "    const scope = selectedScope();\n    const xId = xChannelSelect.value || context.channels[0]?.id;\n    const yId = yChannelSelect.value || context.channels[1]?.id || context.channels[0]?.id;\n    const observedId = observedSelect.value || context.channels[2]?.id || context.channels[0]?.id;\n    if (!tuneModel || !scope || !xId || !yId || !observedId || !tableSelect.value || !xAxisSelect.value || !yAxisSelect.value) {")
replace_once('apps/web/src/pages/tune-table-view.ts',
    "    const startMs = Math.min(scope.startMs, scope.endMs);\n    const endMs = Math.max(scope.startMs, scope.endMs);\n    const channels = new Map([[xTrace.channel.id, { range: xTrace.range, complete: xTrace.complete }]]);",
    "    const startMs = Math.min(scope.startMs, scope.endMs);\n    const endMs = Math.max(scope.startMs, scope.endMs);\n    const loaded = await context.loadTraces([xId, yId, observedId], startMs, endMs);\n    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));\n    const xTrace = byId.get(xId);\n    const yTrace = byId.get(yId);\n    const observedTrace = byId.get(observedId);\n    if (!xTrace || !yTrace || !observedTrace) { empty.hidden = false; content.hidden = true; return; }\n    const channels = new Map([[xTrace.channel.id, { range: xTrace.range, complete: xTrace.complete }]]);")
replace_once('apps/web/src/pages/tune-table-view.ts', "    render();\n  };\n\n  const setTuneModel", "    void render();\n  };\n\n  const setTuneModel")
replace_once('apps/web/src/pages/tune-table-view.ts', "    render();\n  };\n\n  tableSelect", "    void render();\n  };\n\n  tableSelect")
replace_once('apps/web/src/pages/tune-table-view.ts',
    "  tableSelect.addEventListener('change', () => { syncAxisCandidates(); render(); });\n  xAxisSelect.addEventListener('change', render);\n  yAxisSelect.addEventListener('change', render);\n  xChannelSelect.addEventListener('change', render);\n  yChannelSelect.addEventListener('change', render);\n  observedSelect.addEventListener('change', render);\n  scopeSelect.addEventListener('change', render);\n  errorToggle.addEventListener('change', render);\n  refreshButton.addEventListener('click', render);\n\n  return { element: root, setContext, setTuneModel, refresh: render };",
    "  tableSelect.addEventListener('change', () => { syncAxisCandidates(); void render(); });\n  xAxisSelect.addEventListener('change', () => { void render(); });\n  yAxisSelect.addEventListener('change', () => { void render(); });\n  xChannelSelect.addEventListener('change', () => { void render(); });\n  yChannelSelect.addEventListener('change', () => { void render(); });\n  observedSelect.addEventListener('change', () => { void render(); });\n  scopeSelect.addEventListener('change', () => { void render(); });\n  errorToggle.addEventListener('change', () => { void render(); });\n  refreshButton.addEventListener('click', () => { void render(); });\n\n  return { element: root, setContext, setTuneModel, refresh: () => { void render(); } };"
)

# Boost: all available channels + scoped on-demand decode.
replace_once('apps/web/src/pages/boost-analyzer-view.ts',
    "let context: LoggerAnalysisContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };",
    "let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };")
replace_once('apps/web/src/pages/boost-analyzer-view.ts',
    "  const traceFor = (id: string): LoggerAnalysisTraceContext | undefined =>\n    id ? context.traces.find((trace) => trace.channel.id === id) : undefined;\n\n",
    "")
replace_once('apps/web/src/pages/boost-analyzer-view.ts',
    "    for (const trace of context.traces) select.add(new Option(channelLabel(trace), trace.channel.id));",
    "    for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));")
replace_once('apps/web/src/pages/boost-analyzer-view.ts',
    "  const render = (): void => {\n    const measured = traceFor(measuredSelect.value) ?? context.traces[0];\n    const target = traceFor(targetSelect.value);\n    const rpm = traceFor(rpmSelect.value);\n    const upper = traceFor(upperSelect.value);\n    const lower = traceFor(lowerSelect.value);\n    const scope = selectedScope();\n    if (!measured || !scope) {",
    "  const render = async (): Promise<void> => {\n    const measuredId = measuredSelect.value || context.channels[0]?.id;\n    const targetId = targetSelect.value || undefined;\n    const rpmId = rpmSelect.value || undefined;\n    const upperId = upperSelect.value || undefined;\n    const lowerId = lowerSelect.value || undefined;\n    const scope = selectedScope();\n    if (!measuredId || !scope) {")
replace_once('apps/web/src/pages/boost-analyzer-view.ts',
    "    const startMs = Math.min(scope.startMs, scope.endMs);\n    const endMs = Math.max(scope.startMs, scope.endMs);\n    const channels = new Map([[measured.channel.id, { range: measured.range, complete: measured.complete }]]);",
    "    const startMs = Math.min(scope.startMs, scope.endMs);\n    const endMs = Math.max(scope.startMs, scope.endMs);\n    const loaded = await context.loadTraces([measuredId, targetId, rpmId, upperId, lowerId].filter((id): id is string => id !== undefined), startMs, endMs);\n    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));\n    const measured = byId.get(measuredId);\n    const target = targetId ? byId.get(targetId) : undefined;\n    const rpm = rpmId ? byId.get(rpmId) : undefined;\n    const upper = upperId ? byId.get(upperId) : undefined;\n    const lower = lowerId ? byId.get(lowerId) : undefined;\n    if (!measured) { empty.hidden = false; content.hidden = true; return; }\n    const channels = new Map([[measured.channel.id, { range: measured.range, complete: measured.complete }]]);")
replace_once('apps/web/src/pages/boost-analyzer-view.ts',
    "    measuredSelect.replaceChildren(...context.traces.map((trace) => new Option(channelLabel(trace), trace.channel.id)));\n    if (context.traces.some((trace) => trace.channel.id === previousMeasured)) measuredSelect.value = previousMeasured;",
    "    measuredSelect.replaceChildren(...context.channels.map((channel) => new Option(channel.displayName || channel.sourceName, channel.id)));\n    if (context.channels.some((channel) => channel.id === previousMeasured)) measuredSelect.value = previousMeasured;")
replace_once('apps/web/src/pages/boost-analyzer-view.ts', "    render();\n  };\n\n  for (const select", "    void render();\n  };\n\n  for (const select")
replace_once('apps/web/src/pages/boost-analyzer-view.ts',
    "  for (const select of [measuredSelect, targetSelect, rpmSelect, upperSelect, lowerSelect, scopeSelect]) select.addEventListener('change', render);\n  for (const input of [spoolEnabled, spoolStart, spoolTarget, spoolFraction, spoolDuration, steadyEnabled, steadyTargetRate, steadyMeasuredRate, steadyDuration]) input.addEventListener('change', render);\n  refreshButton.addEventListener('click', render);\n\n  return { element: root, setContext, refresh: render };",
    "  for (const select of [measuredSelect, targetSelect, rpmSelect, upperSelect, lowerSelect, scopeSelect]) select.addEventListener('change', () => { void render(); });\n  for (const input of [spoolEnabled, spoolStart, spoolTarget, spoolFraction, spoolDuration, steadyEnabled, steadyTargetRate, steadyMeasuredRate, steadyDuration]) input.addEventListener('change', () => { void render(); });\n  refreshButton.addEventListener('click', () => { void render(); });\n\n  return { element: root, setContext, refresh: () => { void render(); } };"
)
replace_once('apps/web/src/pages/boost-analyzer-view.ts',
    "<strong>Boost analysis needs an active measured-pressure channel and a valid scope.</strong>",
    "<strong>Boost analysis needs a measured-pressure channel available in the log and a valid scope.</strong>")

# Specialized Analyzer: role selectors from full catalog and scoped selected-role decode.
replace_once('apps/web/src/pages/specialized-analyzer-suite-view.ts',
    "let context: LoggerAnalysisContext = { traces: [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };",
    "let context: LoggerAnalysisContext = { traces: [], channels: [], loadTraces: async () => [], aTimeMs: undefined, bTimeMs: undefined, savedRanges: [] };")
replace_once('apps/web/src/pages/specialized-analyzer-suite-view.ts',
    "  const traceFor = (id: string | undefined): LoggerAnalysisTraceContext | undefined =>\n    id ? context.traces.find((trace) => trace.channel.id === id) : undefined;\n\n",
    "")
replace_once('apps/web/src/pages/specialized-analyzer-suite-view.ts',
    "<strong>Select the required active channel and a valid scope.</strong>\n      <span>Only already-decoded active Logger traces are used. Optional channels can remain unselected.</span>",
    "<strong>Select the required available channel and a valid scope.</strong>\n      <span>All channels present in the loaded log are available; selected roles decode on demand. Optional roles can remain unselected.</span>")
replace_once('apps/web/src/pages/specialized-analyzer-suite-view.ts',
    "  const analyzeCurrent = (): void => {\n    const spec = SPECS[domain];\n    const traces = new Map<string, LoggerAnalysisTraceContext>();\n    for (const role of spec.roles) {\n      const select = roleSelect(role.key);\n      const trace = traceFor(select?.value);\n      if (trace) traces.set(role.key, trace);\n      if (role.required && !trace) {\n        empty.hidden = false;\n        content.hidden = true;\n        return;\n      }\n    }\n    const primary = traces.get(spec.roles.find((role) => role.required)?.key ?? '');\n    if (!primary) {\n      empty.hidden = false;\n      content.hidden = true;\n      return;\n    }\n    const scoped = scopeForPrimary(primary, [...traces.values()]);",
    "  const analyzeCurrent = async (): Promise<void> => {\n    const spec = SPECS[domain];\n    const selected = new Map<string, string>();\n    for (const role of spec.roles) {\n      const id = roleSelect(role.key)?.value;\n      if (id) selected.set(role.key, id);\n      if (role.required && !id) { empty.hidden = false; content.hidden = true; return; }\n    }\n    const scope = selectedScope();\n    if (!scope) { empty.hidden = false; content.hidden = true; return; }\n    const startMs = Math.min(scope.startMs, scope.endMs);\n    const endMs = Math.max(scope.startMs, scope.endMs);\n    const loaded = await context.loadTraces([...selected.values()], startMs, endMs);\n    const byId = new Map(loaded.map((trace) => [trace.channel.id, trace]));\n    const traces = new Map<string, LoggerAnalysisTraceContext>();\n    for (const [key, id] of selected) {\n      const trace = byId.get(id);\n      if (trace) traces.set(key, trace);\n    }\n    const primaryKey = spec.roles.find((role) => role.required)?.key ?? '';\n    const primary = traces.get(primaryKey);\n    if (!primary) { empty.hidden = false; content.hidden = true; return; }\n    const scoped = scopeForPrimary(primary, [...traces.values()]);")
replace_once('apps/web/src/pages/specialized-analyzer-suite-view.ts',
    "      for (const trace of context.traces) select.add(new Option(channelLabel(trace), trace.channel.id));\n      const remembered = rememberedSelections.get(`${domain}:${role.key}`);\n      if (remembered && [...select.options].some((option) => option.value === remembered)) select.value = remembered;\n      else if (role.required && context.traces[0]) select.value = context.traces[0].channel.id;\n      select.addEventListener('change', () => { rememberedSelections.set(`${domain}:${role.key}`, select.value); analyzeCurrent(); });",
    "      for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));\n      const remembered = rememberedSelections.get(`${domain}:${role.key}`);\n      if (remembered && [...select.options].some((option) => option.value === remembered)) select.value = remembered;\n      else if (role.required && context.channels[0]) select.value = context.channels[0].id;\n      select.addEventListener('change', () => { rememberedSelections.set(`${domain}:${role.key}`, select.value); void analyzeCurrent(); });")
replace_once('apps/web/src/pages/specialized-analyzer-suite-view.ts',
    "    scopeSelect.addEventListener('change', () => { rememberedSelections.set(`${domain}:scope`, scopeSelect.value); analyzeCurrent(); });",
    "    scopeSelect.addEventListener('change', () => { rememberedSelections.set(`${domain}:scope`, scopeSelect.value); void analyzeCurrent(); });")
replace_once('apps/web/src/pages/specialized-analyzer-suite-view.ts',
    "    button.addEventListener('click', analyzeCurrent);",
    "    button.addEventListener('click', () => { void analyzeCurrent(); });")
replace_once('apps/web/src/pages/specialized-analyzer-suite-view.ts',
    "      input.addEventListener('change', analyzeCurrent);",
    "      input.addEventListener('change', () => { void analyzeCurrent(); });")
replace_once('apps/web/src/pages/specialized-analyzer-suite-view.ts',
    "    analyzeCurrent();\n  };",
    "    void analyzeCurrent();\n  };")
replace_once('apps/web/src/pages/specialized-analyzer-suite-view.ts',
    "    refresh: analyzeCurrent,",
    "    refresh: () => { void analyzeCurrent(); },")

# Update copy that still implies active-Logger-only channel authority.
for path in [
    'apps/web/src/pages/analyzer-page.ts',
    'apps/web/src/pages/tune-table-view.ts',
    'apps/web/src/pages/boost-analyzer-view.ts',
    'apps/web/src/pages/specialized-analyzer-suite-view.ts',
    'apps/web/src/pages/histogram-page.ts',
    'apps/web/src/pages/heatmap-view.ts',
    'apps/web/src/pages/scatter-view.ts',
]:
    p = Path(path)
    s = p.read_text(encoding='utf-8')
    s = s.replace('active decoded channel', 'available log channel')
    s = s.replace('active decoded channels', 'available log channels')
    p.write_text(s, encoding='utf-8')
