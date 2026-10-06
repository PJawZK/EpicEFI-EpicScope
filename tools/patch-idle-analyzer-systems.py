from pathlib import Path

path = Path('apps/web/src/pages/specialized-analyzer-suite-view.ts')
text = path.read_text()

text = text.replace(
"import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';\n",
"import { aggregateNumericSamples } from '../../../../core/analysis/numeric-aggregation';\nimport { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';\n",
1)

text = text.replace(
"interface RoleSpec {\n  readonly key: string;\n  readonly label: string;\n  readonly required?: boolean;\n}\n",
"type IdleSystem = 'combined' | 'dc-idle' | 'iac' | 'etb' | 'ignition';\n\ninterface RoleSpec {\n  readonly key: string;\n  readonly label: string;\n  readonly required?: boolean;\n  readonly systems?: readonly IdleSystem[];\n  readonly group?: string;\n}\n",
1)

text = text.replace(
"const SPECS: Record<SpecializedAnalyzerDomain, DomainSpec> = {\n",
"const IDLE_SYSTEMS: readonly { value: IdleSystem; label: string; description: string }[] = [\n  { value: 'combined', label: 'Combined', description: 'Inspect how the available idle-control systems respond together.' },\n  { value: 'dc-idle', label: 'DC Idle', description: 'Focus on the RPM controller, feed-forward and PID contributions.' },\n  { value: 'iac', label: 'IAC Valve', description: 'Focus on the idle-air valve command and available actuator headroom evidence.' },\n  { value: 'etb', label: 'ETB', description: 'Focus on electronic-throttle idle target, position and idle contribution.' },\n  { value: 'ignition', label: 'Ignition', description: 'Focus on idle spark advance and ignition correction.' },\n];\n\nconst SPECS: Record<SpecializedAnalyzerDomain, DomainSpec> = {\n",
1)

old_idle = """  idle: {\n    title: 'Idle',\n    description: 'Target/error, valve duty/bias/feed-forward, PID terms and sag/recovery evidence.',\n    roles: [\n      { key: 'rpm', label: 'RPM', required: true },\n      { key: 'target', label: 'Idle target' },\n      { key: 'valve', label: 'Idle valve duty' },\n      { key: 'bias', label: 'DC bias' },\n      { key: 'feedForward', label: 'Feed-forward' },\n      { key: 'p', label: 'P term' },\n      { key: 'i', label: 'I term' },\n      { key: 'd', label: 'D term' },\n    ],\n"""
new_idle = """  idle: {\n    title: 'Idle',\n    description: 'Sag/recovery analysis separated by DC Idle, IAC valve, ETB and ignition control evidence.',\n    roles: [\n      { key: 'rpm', label: 'RPM', required: true, group: 'Engine' },\n      { key: 'target', label: 'Idle target', required: true, group: 'Engine' },\n      { key: 'dcBiasOutput', label: 'DC Bias output (runtime)', systems: ['dc-idle'], group: 'DC Idle' },\n      { key: 'feedForward', label: 'Feed-forward', systems: ['dc-idle'], group: 'DC Idle' },\n      { key: 'p', label: 'P term', systems: ['dc-idle'], group: 'DC Idle' },\n      { key: 'i', label: 'I term', systems: ['dc-idle'], group: 'DC Idle' },\n      { key: 'd', label: 'D term', systems: ['dc-idle'], group: 'DC Idle' },\n      { key: 'valve', label: 'IAC valve duty', systems: ['iac'], group: 'IAC Valve' },\n      { key: 'etbTarget', label: 'ETB idle target', systems: ['etb'], group: 'ETB' },\n      { key: 'etbPosition', label: 'ETB position', systems: ['etb'], group: 'ETB' },\n      { key: 'etbContribution', label: 'ETB idle contribution', systems: ['etb'], group: 'ETB' },\n      { key: 'ignitionAdvance', label: 'Ignition advance', systems: ['ignition'], group: 'Ignition' },\n      { key: 'ignitionCorrection', label: 'Idle ignition correction', systems: ['ignition'], group: 'Ignition' },\n    ],\n"""
if old_idle not in text: raise SystemExit('idle spec block not found')
text = text.replace(old_idle, new_idle, 1)

text = text.replace(
"    <div class=\"specialized-analyzer-controls\"></div>\n    <details class=\"specialized-analyzer-options\" open>",
"    <div class=\"specialized-analyzer-controls\"></div>\n    <div class=\"specialized-analyzer-guidance\" hidden><strong data-specialized=\"guidance-title\">What Analyze does</strong><span data-specialized=\"guidance-text\"></span></div>\n    <details class=\"specialized-analyzer-options\" open>",
1)

text = text.replace(
"  const controls = root.querySelector<HTMLElement>('.specialized-analyzer-controls');\n  const optionsGrid",
"  const controls = root.querySelector<HTMLElement>('.specialized-analyzer-controls');\n  const guidance = root.querySelector<HTMLElement>('.specialized-analyzer-guidance');\n  const optionsGrid",
1)
text = text.replace(
"  if (!controls || !optionsGrid || !empty || !content || !summary || !evidence || !evidenceCanvas || !evidenceAll || !tableHead || !tableBody)",
"  if (!controls || !guidance || !optionsGrid || !empty || !content || !summary || !evidence || !evidenceCanvas || !evidenceAll || !tableHead || !tableBody)",
1)

anchor = "  const selectedScope = () => {\n"
insert = """  const currentIdleSystem = (): IdleSystem => {\n    const value = controls.querySelector<HTMLSelectElement>('select[data-role=\"idle-system\"]')?.value as IdleSystem | undefined;\n    return IDLE_SYSTEMS.some((entry) => entry.value === value) ? value! : 'combined';\n  };\n\n  const idleRoleRelevant = (role: RoleSpec, system: IdleSystem): boolean =>\n    !role.systems?.length || system === 'combined' || role.systems.includes(system);\n\n  const updateIdleGuidance = (): void => {\n    if (domain !== 'idle') { guidance.hidden = true; return; }\n    guidance.hidden = false;\n    const system = currentIdleSystem();\n    const systemInfo = IDLE_SYSTEMS.find((entry) => entry.value === system) ?? IDLE_SYSTEMS[0]!;\n    const sag = optionNumber('sag', 100);\n    const settled = optionNumber('settled', 40);\n    field('guidance-title').textContent = `What Analyze does · ${systemInfo.label}`;\n    const biasNote = system === 'combined' || system === 'dc-idle'\n      ? ' DC Bias itself is a calibration curve/table; only a separately logged runtime bias output belongs in the channel selector.'\n      : '';\n    field('guidance-text').textContent = `${systemInfo.description} A sag starts when RPM is at least ${sag} RPM below Idle target; recovery ends when RPM returns inside ±${settled} RPM of target.${biasNote}`;\n  };\n\n"""
text = text.replace(anchor, insert + anchor, 1)

old_loop = """    for (const role of spec.roles) {\n      const id = roleSelect(role.key)?.value;\n      if (id) selected.set(role.key, id);\n      if (role.required && !id) { empty.hidden = false; content.hidden = true; return; }\n    }"""
new_loop = """    const idleSystem = domain === 'idle' ? currentIdleSystem() : 'combined';\n    for (const role of spec.roles) {\n      if (domain === 'idle' && !idleRoleRelevant(role, idleSystem)) continue;\n      const id = roleSelect(role.key)?.value;\n      if (id) selected.set(role.key, id);\n      if (role.required && !id) {\n        empty.hidden = false; content.hidden = true;\n        const strong = empty.querySelector('strong');\n        if (strong) strong.textContent = `Select ${role.label} before analyzing ${domain === 'idle' ? 'idle events' : 'this analyzer'}.`;\n        return;\n      }\n    }"""
if old_loop not in text: raise SystemExit('selection loop not found')
text = text.replace(old_loop, new_loop, 1)

text = text.replace("        const bias = traces.get('bias');", "        const dcBiasOutput = traces.get('dcBiasOutput');\n        const etbTarget = traces.get('etbTarget');\n        const etbPosition = traces.get('etbPosition');\n        const etbContribution = traces.get('etbContribution');\n        const ignitionAdvance = traces.get('ignitionAdvance');\n        const ignitionCorrection = traces.get('ignitionCorrection');", 1)
text = text.replace("...(bias ? { bias: bias.range } : {}),", "...(dcBiasOutput ? { bias: dcBiasOutput.range } : {}),", 1)

old_series = """        const idleSeries: AnalyzerEvidenceSeries[] = [\n          { label: 'RPM', range: rpm.range },\n          ...(target ? [{ label: 'Target', range: target.range }] : []),\n          ...(valve ? [{ label: 'Idle valve', range: valve.range }] : []),\n          ...(p ? [{ label: 'P term', range: p.range }] : []),\n          ...(i ? [{ label: 'I term', range: i.range }] : []),\n        ];"""
new_series = """        const idleSeries: AnalyzerEvidenceSeries[] = [\n          { label: 'RPM', range: rpm.range },\n          ...(target ? [{ label: 'Target', range: target.range }] : []),\n          ...(dcBiasOutput ? [{ label: 'DC Bias output', range: dcBiasOutput.range }] : []),\n          ...(feedForward ? [{ label: 'Feed-forward', range: feedForward.range }] : []),\n          ...(p ? [{ label: 'P term', range: p.range }] : []),\n          ...(i ? [{ label: 'I term', range: i.range }] : []),\n          ...(d ? [{ label: 'D term', range: d.range }] : []),\n          ...(valve ? [{ label: 'IAC valve duty', range: valve.range }] : []),\n          ...(etbTarget ? [{ label: 'ETB target', range: etbTarget.range }] : []),\n          ...(etbPosition ? [{ label: 'ETB position', range: etbPosition.range }] : []),\n          ...(etbContribution ? [{ label: 'ETB idle contribution', range: etbContribution.range }] : []),\n          ...(ignitionAdvance ? [{ label: 'Ignition advance', range: ignitionAdvance.range }] : []),\n          ...(ignitionCorrection ? [{ label: 'Idle ignition correction', range: ignitionCorrection.range }] : []),\n        ];"""
if old_series not in text: raise SystemExit('idle series not found')
text = text.replace(old_series, new_series, 1)

old_summary = """          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],\n          ['RPM mean', numberText(result.rpm.mean)], ['Target mean', numberText(result.target?.mean)],\n          ['Mean error', numberText(result.tracking?.meanError)], ['MAE', numberText(result.tracking?.meanAbsoluteError)],\n          ['Worst sag', numberText(result.sagEvents.length ? Math.min(...result.sagEvents.map((event) => event.minimumErrorRpm)) : undefined)],\n          ['Median recovery', result.sagEvents.length ? `${numberText(finiteMedian(result.sagEvents.map((event) => event.recoveryMs)), 0)} ms` : '—'],\n          ['Valve mean', numberText(result.valveDuty?.mean)], ['Bias mean', numberText(result.bias?.mean)],\n          ['Feed-forward mean', numberText(result.feedForward?.mean)], ['P / I / D mean', `${numberText(result.pTerm?.mean)} / ${numberText(result.iTerm?.mean)} / ${numberText(result.dTerm?.mean)}`],\n          ['Sag events', String(result.sagEvents.length)], ['Input samples', result.rpm.inputSampleCount.toLocaleString()],"""
new_summary = """          ['Idle system', IDLE_SYSTEMS.find((entry) => entry.value === idleSystem)?.label ?? 'Combined'],\n          ['Scope', scoped.scope.label], ['Coverage', result.complete ? 'Complete' : 'Partial decoded'],\n          ['RPM mean', numberText(result.rpm.mean)], ['Target mean', numberText(result.target?.mean)],\n          ['Mean error', numberText(result.tracking?.meanError)], ['MAE', numberText(result.tracking?.meanAbsoluteError)],\n          ['Worst sag', numberText(result.sagEvents.length ? Math.min(...result.sagEvents.map((event) => event.minimumErrorRpm)) : undefined)],\n          ['Median recovery', result.sagEvents.length ? `${numberText(finiteMedian(result.sagEvents.map((event) => event.recoveryMs)), 0)} ms` : '—'],\n          ['IAC valve mean', numberText(result.valveDuty?.mean)], ['DC Bias output mean', numberText(result.bias?.mean)],\n          ['Feed-forward mean', numberText(result.feedForward?.mean)], ['P / I / D mean', `${numberText(result.pTerm?.mean)} / ${numberText(result.iTerm?.mean)} / ${numberText(result.dTerm?.mean)}`],\n          ['ETB target / position', `${numberText(etbTarget ? aggregateNumericSamples(etbTarget.range, { sampleIndices: scoped.sampleIndices }).mean : undefined)} / ${numberText(etbPosition ? aggregateNumericSamples(etbPosition.range, { sampleIndices: scoped.sampleIndices }).mean : undefined)}`],\n          ['ETB contribution', numberText(etbContribution ? aggregateNumericSamples(etbContribution.range, { sampleIndices: scoped.sampleIndices }).mean : undefined)],\n          ['Ign advance / correction', `${numberText(ignitionAdvance ? aggregateNumericSamples(ignitionAdvance.range, { sampleIndices: scoped.sampleIndices }).mean : undefined)} / ${numberText(ignitionCorrection ? aggregateNumericSamples(ignitionCorrection.range, { sampleIndices: scoped.sampleIndices }).mean : undefined)}`],\n          ['Sag events', String(result.sagEvents.length)], ['Input samples', result.rpm.inputSampleCount.toLocaleString()],"""
if old_summary not in text: raise SystemExit('idle summary not found')
text = text.replace(old_summary, new_summary, 1)

old_rebuild_start = """    field('description').textContent = spec.description;\n    controls.replaceChildren();\n    for (const role of spec.roles) {"""
new_rebuild_start = """    field('description').textContent = spec.description;\n    controls.replaceChildren();\n    if (domain === 'idle') {\n      const systemLabel = document.createElement('label');\n      const systemCaption = document.createElement('span');\n      systemCaption.textContent = 'Idle system';\n      const systemSelect = document.createElement('select');\n      systemSelect.dataset.role = 'idle-system';\n      for (const entry of IDLE_SYSTEMS) systemSelect.add(new Option(entry.label, entry.value));\n      systemSelect.value = rememberedSelections.get('idle:system') ?? 'combined';\n      systemSelect.addEventListener('change', () => { rememberedSelections.set('idle:system', systemSelect.value); rebuild(); });\n      systemLabel.append(systemCaption, systemSelect);\n      controls.append(systemLabel);\n    }\n    const idleSystem = domain === 'idle' ? currentIdleSystem() : 'combined';\n    for (const role of spec.roles) {\n      if (domain === 'idle' && !idleRoleRelevant(role, idleSystem)) continue;"""
if old_rebuild_start not in text: raise SystemExit('rebuild start not found')
text = text.replace(old_rebuild_start, new_rebuild_start, 1)

text = text.replace("      span.textContent = role.label;", "      span.textContent = role.group ? `${role.label} · ${role.group}` : role.label;", 1)
text = text.replace("    controls.append(button);\n\n    optionsGrid.replaceChildren();", "    controls.append(button);\n\n    optionsGrid.replaceChildren();", 1)
text = text.replace("      input.addEventListener('change', () => { void analyzeCurrent(); });", "      input.addEventListener('change', () => { updateIdleGuidance(); void analyzeCurrent(); });", 1)
text = text.replace("    void analyzeCurrent();\n  };", "    updateIdleGuidance();\n    void analyzeCurrent();\n  };", 1)

path.write_text(text)

css = Path('apps/web/src/styles/specialized-analyzer.css')
css_text = css.read_text()
css_text = css_text.replace(
".specialized-analyzer-options,\n.specialized-analyzer-summary,",
".specialized-analyzer-options,\n.specialized-analyzer-guidance,\n.specialized-analyzer-summary,",
1)
css_text += """\n\n.specialized-analyzer-guidance {\n  display: flex;\n  align-items: baseline;\n  gap: 9px;\n  padding: 7px 10px;\n  background: #0a151d;\n}\n.specialized-analyzer-guidance[hidden] { display: none; }\n.specialized-analyzer-guidance strong { flex: 0 0 auto; color: #a9bbc5; font-size: 9px; }\n.specialized-analyzer-guidance span { color: #78909e; font-size: 9px; line-height: 1.45; }\n"""
css.write_text(css_text)

docs = Path('docs/ANALYZER.md')
doc_text = docs.read_text()
doc_text += """\n\n## Idle systems\n\nIdle analysis separates common engine signals from DC Idle, IAC Valve, ETB and ignition evidence. RPM and Idle target are common and required for sag/recovery detection. The **Idle system** selector narrows the visible role mappings; **Combined** shows all available systems together. DC Bias is treated as calibration data rather than a runtime scalar: the analyzer only offers a **DC Bias output (runtime)** role when a distinct logged output/contribution channel is available. Analyze interprets **Sag threshold RPM** as how far RPM must fall below target to start an event, and **Settled band RPM** as the ±RPM band that ends recovery.\n"""
docs.write_text(doc_text)
