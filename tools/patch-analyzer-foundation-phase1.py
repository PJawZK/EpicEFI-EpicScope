from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'pattern not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# Shared Analyzer -> Logger navigation capability.
replace_once(
    'apps/web/src/pages/logger-page.ts',
    """  readonly loadTraces: (\n    channelIds: readonly string[],\n    startMs?: number,\n    endMs?: number,\n  ) => Promise<readonly LoggerAnalysisTraceContext[]>;\n  readonly aTimeMs: number | undefined;\n""",
    """  readonly loadTraces: (\n    channelIds: readonly string[],\n    startMs?: number,\n    endMs?: number,\n  ) => Promise<readonly LoggerAnalysisTraceContext[]>;\n  /** Optional analysis-to-evidence navigation supplied by the application shell. */\n  readonly openSamplesInLogger?: (request: {\n    readonly sampleIndices: readonly number[];\n    readonly timeMs: readonly number[];\n    readonly label: string;\n  }) => void;\n  readonly aTimeMs: number | undefined;\n""",
)

replace_once(
    'apps/web/src/app/app-shell.ts',
    """    if (analyzerActive) {\n      analyzerPage.setContext(loggerPage.getAnalysisContext());\n      analyzerPage.setTuneModel(activeTuneModel, activeTuneSourceName);\n""",
    """    if (analyzerActive) {\n      analyzerPage.setContext({\n        ...loggerPage.getAnalysisContext(),\n        openSamplesInLogger: (request) => {\n          loggerPage.focusAnalysisTimes(request.timeMs);\n          appStatus.textContent = `Logger · ${request.label} · ${request.sampleIndices.length.toLocaleString()} evidence point${request.sampleIndices.length === 1 ? '' : 's'}`;\n          setEpicScopeMode('logger');\n        },\n      });\n      analyzerPage.setTuneModel(activeTuneModel, activeTuneSourceName);\n""",
)

# Specialized analyzer foundation.
path = Path('apps/web/src/pages/specialized-analyzer-suite-view.ts')
text = path.read_text()
text = text.replace(
    "import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';\n",
    "import type { LoggerAnalysisContext, LoggerAnalysisTraceContext } from './logger-page';\n"
    "import { suggestAnalyzerChannel } from './analyzer-channel-roles';\n"
    "import { analyzerScopeBounds, populateAnalyzerScopeSelect, selectedAnalyzerScope } from './analyzer-scope';\n",
    1,
)
old_scope = """  const selectedScope = (): { label: string; startMs: number; endMs: number } | undefined => {\n    const scope = controls.querySelector<HTMLSelectElement>('select[data-role=\"scope\"]');\n    if (!scope) return undefined;\n    if (scope.value === 'ab') {\n      if (context.aTimeMs === undefined || context.bTimeMs === undefined || context.aTimeMs === context.bTimeMs) return undefined;\n      return { label: 'Current A/B', startMs: context.aTimeMs, endMs: context.bTimeMs };\n    }\n    if (!scope.value.startsWith('saved:')) return undefined;\n    const index = Number(scope.value.slice(6));\n    const saved = Number.isInteger(index) ? context.savedRanges[index] : undefined;\n    return saved ? { label: saved.label, startMs: saved.startMs, endMs: saved.endMs } : undefined;\n  };\n"""
new_scope = """  const selectedScope = () => {\n    const scope = controls.querySelector<HTMLSelectElement>('select[data-role=\"scope\"]');\n    return scope ? selectedAnalyzerScope(scope, context) : undefined;\n  };\n"""
if old_scope not in text:
    raise SystemExit('specialized selectedScope block not found')
text = text.replace(old_scope, new_scope, 1)

old_render_table = """  const renderTable = (title: string, headers: readonly string[], rows: readonly (readonly string[])[]): void => {\n    field('events-title').textContent = title;\n    field('events-count').textContent = rows.length.toLocaleString();\n    const headerRow = document.createElement('tr');\n    for (const header of headers) {\n      const th = document.createElement('th');\n      th.textContent = header;\n      headerRow.append(th);\n    }\n    tableHead.replaceChildren(headerRow);\n    tableBody.replaceChildren(...rows.slice(0, 200).map((values) => {\n      const tr = document.createElement('tr');\n      for (const value of values) {\n        const td = document.createElement('td');\n        td.textContent = value;\n        tr.append(td);\n      }\n      return tr;\n    }));\n  };\n"""
new_render_table = """  interface EvidenceNavigation {\n    readonly sampleIndices: readonly number[];\n    readonly timeMs: readonly number[];\n    readonly label: string;\n  }\n\n  const renderTable = (\n    title: string,\n    headers: readonly string[],\n    rows: readonly (readonly string[])[],\n    navigation: readonly EvidenceNavigation[] = [],\n  ): void => {\n    field('events-title').textContent = title;\n    field('events-count').textContent = rows.length.toLocaleString();\n    const headerRow = document.createElement('tr');\n    for (const header of headers) {\n      const th = document.createElement('th');\n      th.textContent = header;\n      headerRow.append(th);\n    }\n    tableHead.replaceChildren(headerRow);\n    tableBody.replaceChildren(...rows.slice(0, 200).map((values, index) => {\n      const tr = document.createElement('tr');\n      for (const value of values) {\n        const td = document.createElement('td');\n        td.textContent = value;\n        tr.append(td);\n      }\n      const target = navigation[index];\n      if (target && context.openSamplesInLogger) {\n        tr.classList.add('specialized-analyzer-event-row--navigable');\n        tr.tabIndex = 0;\n        tr.title = 'Open this event in Logger';\n        const open = (): void => context.openSamplesInLogger?.(target);\n        tr.addEventListener('click', open);\n        tr.addEventListener('keydown', (event) => {\n          if (event.key === 'Enter' || event.key === ' ') {\n            event.preventDefault();\n            open();\n          }\n        });\n      }\n      return tr;\n    }));\n  };\n\n  const eventNavigation = (\n    events: readonly { startSampleIndex: number; endSampleIndex: number; startTimeMs: number; endTimeMs: number }[],\n    label: string,\n  ): readonly EvidenceNavigation[] => events.map((event, index) => ({\n    sampleIndices: event.startSampleIndex === event.endSampleIndex\n      ? [event.startSampleIndex]\n      : [event.startSampleIndex, event.endSampleIndex],\n    timeMs: event.startTimeMs === event.endTimeMs\n      ? [event.startTimeMs]\n      : [event.startTimeMs, event.endTimeMs],\n    label: `${label} ${index + 1}`,\n  }));\n"""
if old_render_table not in text:
    raise SystemExit('specialized renderTable block not found')
text = text.replace(old_render_table, new_render_table, 1)

old_scope_primary = """    const startMs = Math.min(scope.startMs, scope.endMs);\n    const endMs = Math.max(scope.startMs, scope.endMs);\n    const channels = new Map([[primary.channel.id, { range: primary.range, complete: primary.complete }]]);\n    const qualified = qualifyNumericSamples({\n      referenceChannelId: primary.channel.id,\n      channels,\n      conditions: [],\n      timeRange: { startMs, endMs },\n    });\n    const complete = qualified.complete && selected.every((trace) => trace.complete || numericRangeCoversTime(trace.range, startMs, endMs));\n    return { scope, startMs, endMs, sampleIndices: qualified.eligibleSampleIndices, complete };\n"""
new_scope_primary = """    const { startMs, endMs } = analyzerScopeBounds(scope);\n    const channels = new Map([[primary.channel.id, { range: primary.range, complete: primary.complete }]]);\n    const qualified = qualifyNumericSamples({\n      referenceChannelId: primary.channel.id,\n      channels,\n      conditions: [],\n      ...(startMs !== undefined && endMs !== undefined ? { timeRange: { startMs, endMs } } : {}),\n    });\n    const complete = qualified.complete && selected.every((trace) => {\n      if (startMs === undefined || endMs === undefined) return trace.complete;\n      return trace.complete || numericRangeCoversTime(trace.range, startMs, endMs);\n    });\n    return { scope, startMs, endMs, sampleIndices: qualified.eligibleSampleIndices, complete };\n"""
if old_scope_primary not in text:
    raise SystemExit('specialized scopeForPrimary body not found')
text = text.replace(old_scope_primary, new_scope_primary, 1)

old_load = """    const startMs = Math.min(scope.startMs, scope.endMs);\n    const endMs = Math.max(scope.startMs, scope.endMs);\n    const loaded = await context.loadTraces([...selected.values()], startMs, endMs);\n"""
new_load = """    const { startMs, endMs } = analyzerScopeBounds(scope);\n    const loaded = await context.loadTraces([...selected.values()], startMs, endMs);\n"""
if old_load not in text:
    raise SystemExit('specialized load scope block not found')
text = text.replace(old_load, new_load, 1)

# Event tables become evidence navigation surfaces.
replacements = [
    (
      "renderTable('Sag / recovery events', ['#', 'Start', 'End', 'Duration', 'Min error RPM', 'Recovery'], result.sagEvents.map((event, index) => [String(index + 1), timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.minimumErrorRpm), event.recoveryMs === undefined ? '—' : `${event.recoveryMs.toFixed(0)} ms`]));",
      "renderTable('Sag / recovery events', ['#', 'Start', 'End', 'Duration', 'Min error RPM', 'Recovery'], result.sagEvents.map((event, index) => [String(index + 1), timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.minimumErrorRpm), event.recoveryMs === undefined ? '—' : `${event.recoveryMs.toFixed(0)} ms`]), eventNavigation(result.sagEvents, 'Idle sag'));",
    ),
    (
      "renderTable('Transient events', ['#', 'Type', 'Start', 'Duration', 'TPS Δ', 'MAP Δ', 'Predict error', 'AFR lean', 'AFR rich'], result.events.map((event, index) => [String(index + 1), event.direction, timeText(event.startTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.tpsDelta), numberText(event.mapDelta), numberText(event.predictionErrorAtEnd), numberText(event.afrLeanExcursion), numberText(event.afrRichExcursion)]));",
      "renderTable('Transient events', ['#', 'Type', 'Start', 'Duration', 'TPS Δ', 'MAP Δ', 'Predict error', 'AFR lean', 'AFR rich'], result.events.map((event, index) => [String(index + 1), event.direction, timeText(event.startTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.tpsDelta), numberText(event.mapDelta), numberText(event.predictionErrorAtEnd), numberText(event.afrLeanExcursion), numberText(event.afrRichExcursion)]), eventNavigation(result.events, 'AE / MAP transient'));",
    ),
    (
      "renderTable('Knock events', ['#', 'Start', 'End', 'Duration', 'Peak knock', 'Advance @ peak', 'Retard @ peak'], result.knockEvents.map((event, index) => [String(index + 1), timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.peakKnock), numberText(event.advanceAtPeak), numberText(event.retardAtPeak)]));",
      "renderTable('Knock events', ['#', 'Start', 'End', 'Duration', 'Peak knock', 'Advance @ peak', 'Retard @ peak'], result.knockEvents.map((event, index) => [String(index + 1), timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.peakKnock), numberText(event.advanceAtPeak), numberText(event.retardAtPeak)]), eventNavigation(result.knockEvents, 'Knock event'));",
    ),
    (
      "renderTable('Sync / trigger events', ['#', 'Reason', 'Start', 'End', 'Duration', 'Peak error', 'Loss Δ'], result.events.map((event, index) => [String(index + 1), event.reason, timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.peakError), numberText(event.lossCountDelta)]));",
      "renderTable('Sync / trigger events', ['#', 'Reason', 'Start', 'End', 'Duration', 'Peak error', 'Loss Δ'], result.events.map((event, index) => [String(index + 1), event.reason, timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.peakError), numberText(event.lossCountDelta)]), eventNavigation(result.events, 'Trigger / sync event'));",
    ),
]
for old, new in replacements:
    if old not in text:
        raise SystemExit(f'event table replacement not found: {old[:90]}')
    text = text.replace(old, new, 1)

old_fuel = """        const rows = [\n          ...result.lowPressureEvents.map((event, index) => [String(index + 1), 'Low pressure', timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.extremeValue)]),\n          ...result.highDutyEvents.map((event, index) => [String(index + 1), 'High duty', timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.extremeValue)]),\n        ];\n        renderTable('Pressure / injector threshold events', ['#', 'Type', 'Start', 'End', 'Duration', 'Extreme'], rows);\n"""
new_fuel = """        const pressureEvents = [\n          ...result.lowPressureEvents.map((event) => ({ type: 'Low pressure', event })),\n          ...result.highDutyEvents.map((event) => ({ type: 'High duty', event })),\n        ];\n        const rows = pressureEvents.map(({ type, event }, index) => [String(index + 1), type, timeText(event.startTimeMs), timeText(event.endTimeMs), `${event.durationMs.toFixed(0)} ms`, numberText(event.extremeValue)]);\n        renderTable(\n          'Pressure / injector threshold events',\n          ['#', 'Type', 'Start', 'End', 'Duration', 'Extreme'],\n          rows,\n          eventNavigation(pressureEvents.map(({ event }) => event), 'Fuel / injector event'),\n        );\n"""
if old_fuel not in text:
    raise SystemExit('fuel event block not found')
text = text.replace(old_fuel, new_fuel, 1)

# Replace role selection fallback and scope builder with smart role suggestions + Full Log.
old_role_choice = """      if (!role.required) select.add(new Option('(none)', ''));\n      for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));\n      const remembered = rememberedSelections.get(`${domain}:${role.key}`);\n      if (remembered && [...select.options].some((option) => option.value === remembered)) select.value = remembered;\n      else if (role.required && context.channels[0]) select.value = context.channels[0].id;\n      select.addEventListener('change', () => { rememberedSelections.set(`${domain}:${role.key}`, select.value); void analyzeCurrent(); });\n"""
new_role_choice = """      select.add(new Option(role.required ? '(select channel)' : '(none)', ''));\n      for (const channel of context.channels) select.add(new Option(channel.displayName || channel.sourceName, channel.id));\n      const remembered = rememberedSelections.get(`${domain}:${role.key}`);\n      if (remembered && [...select.options].some((option) => option.value === remembered)) {\n        select.value = remembered;\n      } else {\n        const suggested = suggestAnalyzerChannel(domain, role.key, context.channels);\n        if (suggested) {\n          select.value = suggested.id;\n          select.dataset.autoSelected = 'true';\n          select.title = `Auto-selected ${suggested.displayName || suggested.sourceName}; choose another channel to override.`;\n        }\n      }\n      select.addEventListener('change', () => {\n        delete select.dataset.autoSelected;\n        select.removeAttribute('title');\n        rememberedSelections.set(`${domain}:${role.key}`, select.value);\n        void analyzeCurrent();\n      });\n"""
if old_role_choice not in text:
    raise SystemExit('role selection block not found')
text = text.replace(old_role_choice, new_role_choice, 1)

old_scope_build = """    const scopeSelect = document.createElement('select');\n    scopeSelect.dataset.role = 'scope';\n    if (context.aTimeMs !== undefined && context.bTimeMs !== undefined && context.aTimeMs !== context.bTimeMs) scopeSelect.add(new Option('Current A/B', 'ab'));\n    context.savedRanges.forEach((saved, index) => scopeSelect.add(new Option(saved.label, `saved:${index}`)));\n    const rememberedScope = rememberedSelections.get(`${domain}:scope`);\n    if (rememberedScope && [...scopeSelect.options].some((option) => option.value === rememberedScope)) scopeSelect.value = rememberedScope;\n"""
new_scope_build = """    const scopeSelect = document.createElement('select');\n    scopeSelect.dataset.role = 'scope';\n    const rememberedScope = rememberedSelections.get(`${domain}:scope`) ?? 'full';\n    populateAnalyzerScopeSelect(scopeSelect, context, rememberedScope);\n"""
if old_scope_build not in text:
    raise SystemExit('scope build block not found')
text = text.replace(old_scope_build, new_scope_build, 1)
path.write_text(text)

# Styles for analyzer evidence navigation and smart selections.
css = Path('apps/web/src/styles/specialized-analyzer.css')
css_text = css.read_text()
append = """

.specialized-analyzer-controls select[data-auto-selected='true'] {
  border-color: #3f687a;
  box-shadow: inset 0 0 0 1px rgba(95, 160, 186, .12);
}

.specialized-analyzer-event-row--navigable {
  cursor: pointer;
}

.specialized-analyzer-event-row--navigable:hover,
.specialized-analyzer-event-row--navigable:focus {
  outline: none;
  background: #102431;
}

.specialized-analyzer-event-row--navigable:focus-visible {
  box-shadow: inset 0 0 0 1px #47788e;
}
"""
if '.specialized-analyzer-event-row--navigable' not in css_text:
    css.write_text(css_text.rstrip() + append)
