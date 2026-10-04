from pathlib import Path

p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()
s = s.replace(
"  readonly drawMs: number;\n  readonly envelopeMs: number;\n",
"  readonly drawMs: number;\n  readonly envelopeMs: number;\n  readonly drawSetupMs: number;\n  readonly drawTraceMs: number;\n  readonly drawOverlayMs: number;\n",
1,
)
s = s.replace(
"  let measureEnvelopeBuild = false;\n  let measuredEnvelopeBuildMs = 0;\n",
"  let measureEnvelopeBuild = false;\n  let measuredEnvelopeBuildMs = 0;\n  let measuredDrawSetupMs = 0;\n  let measuredDrawTraceMs = 0;\n  let measuredDrawOverlayMs = 0;\n",
1,
)
s = s.replace(
"  const draw = (): void => {\n    const rect = canvas.getBoundingClientRect();\n",
"  const draw = (): void => {\n    const drawBreakdownStarted = measureEnvelopeBuild\n      ? (globalThis.performance?.now() ?? Date.now())\n      : 0;\n    const rect = canvas.getBoundingClientRect();\n",
1,
)
needle = "    const pixelWidth = Math.max(1, Math.floor(plotWidth));\n    for (let traceIndex = 0; traceIndex < traceEntries.length; traceIndex += 1) {\n"
replace = "    const pixelWidth = Math.max(1, Math.floor(plotWidth));\n    const tracePhaseStarted = measureEnvelopeBuild\n      ? (globalThis.performance?.now() ?? Date.now())\n      : 0;\n    const envelopeBeforeTracePhase = measuredEnvelopeBuildMs;\n    if (measureEnvelopeBuild) measuredDrawSetupMs += tracePhaseStarted - drawBreakdownStarted;\n    for (let traceIndex = 0; traceIndex < traceEntries.length; traceIndex += 1) {\n"
if needle not in s:
    raise SystemExit('trace phase start not found')
s = s.replace(needle, replace, 1)
needle = "    if (aTimeMs !== undefined || bTimeMs !== undefined) {\n"
replace = "    const overlayPhaseStarted = measureEnvelopeBuild\n      ? (globalThis.performance?.now() ?? Date.now())\n      : 0;\n    if (measureEnvelopeBuild) {\n      measuredDrawTraceMs += Math.max(\n        0,\n        overlayPhaseStarted - tracePhaseStarted - (measuredEnvelopeBuildMs - envelopeBeforeTracePhase),\n      );\n    }\n\n    if (aTimeMs !== undefined || bTimeMs !== undefined) {\n"
if needle not in s:
    raise SystemExit('overlay phase start not found')
s = s.replace(needle, replace, 1)
needle = "    if (cursorTimeMs >= visibleStartMs && cursorTimeMs <= visibleEndMs) {\n      const cursorX = xForTime(cursorTimeMs);\n      context.strokeStyle = 'rgba(216, 237, 248, 0.92)';\n      context.lineWidth = 1;\n      context.beginPath();\n      context.moveTo(cursorX + 0.5, inset);\n      context.lineTo(cursorX + 0.5, height - inset);\n      context.stroke();\n    }\n\n  };\n"
replace = "    if (cursorTimeMs >= visibleStartMs && cursorTimeMs <= visibleEndMs) {\n      const cursorX = xForTime(cursorTimeMs);\n      context.strokeStyle = 'rgba(216, 237, 248, 0.92)';\n      context.lineWidth = 1;\n      context.beginPath();\n      context.moveTo(cursorX + 0.5, inset);\n      context.lineTo(cursorX + 0.5, height - inset);\n      context.stroke();\n    }\n\n    if (measureEnvelopeBuild) {\n      measuredDrawOverlayMs += (globalThis.performance?.now() ?? Date.now()) - overlayPhaseStarted;\n    }\n\n  };\n"
if needle not in s:
    raise SystemExit('draw end not found')
s = s.replace(needle, replace, 1)
s = s.replace(
"          drawMs: 0,\n          envelopeMs: 0,\n",
"          drawMs: 0,\n          envelopeMs: 0,\n          drawSetupMs: 0,\n          drawTraceMs: 0,\n          drawOverlayMs: 0,\n",
1,
)
s = s.replace(
"    measuredEnvelopeBuildMs = 0;\n    measureEnvelopeBuild = true;\n",
"    measuredEnvelopeBuildMs = 0;\n    measuredDrawSetupMs = 0;\n    measuredDrawTraceMs = 0;\n    measuredDrawOverlayMs = 0;\n    measureEnvelopeBuild = true;\n",
1,
)
s = s.replace(
"        drawMs,\n        envelopeMs,\n",
"        drawMs,\n        envelopeMs,\n        drawSetupMs: measuredDrawSetupMs,\n        drawTraceMs: measuredDrawTraceMs,\n        drawOverlayMs: measuredDrawOverlayMs,\n",
1,
)
p.write_text(s)

p = Path('apps/web/src/pages/logger-page.ts')
s = p.read_text()
s = s.replace(
"  readonly activationDrawMs: number;\n  readonly activationEnvelopeMs: number;\n",
"  readonly activationDrawMs: number;\n  readonly activationEnvelopeMs: number;\n  readonly activationDrawSetupMs: number;\n  readonly activationDrawTraceMs: number;\n  readonly activationDrawOverlayMs: number;\n",
1,
)
s = s.replace(
"    let activationDrawMs = 0;\n    let activationEnvelopeMs = 0;\n",
"    let activationDrawMs = 0;\n    let activationEnvelopeMs = 0;\n    let activationDrawSetupMs = 0;\n    let activationDrawTraceMs = 0;\n    let activationDrawOverlayMs = 0;\n",
1,
)
s = s.replace(
"          activationDrawMs += graphPerformance.drawMs;\n          activationEnvelopeMs += graphPerformance.envelopeMs;\n",
"          activationDrawMs += graphPerformance.drawMs;\n          activationEnvelopeMs += graphPerformance.envelopeMs;\n          activationDrawSetupMs += graphPerformance.drawSetupMs;\n          activationDrawTraceMs += graphPerformance.drawTraceMs;\n          activationDrawOverlayMs += graphPerformance.drawOverlayMs;\n",
1,
)
s = s.replace(
"      activationDrawMs,\n      activationEnvelopeMs,\n",
"      activationDrawMs,\n      activationEnvelopeMs,\n      activationDrawSetupMs,\n      activationDrawTraceMs,\n      activationDrawOverlayMs,\n",
1,
)
p.write_text(s)

p = Path('apps/web/src/components/performance-diagnostics.ts')
s = p.read_text()
s = s.replace(
"  readonly activationDrawMs: number;\n  readonly activationEnvelopeMs: number;\n",
"  readonly activationDrawMs: number;\n  readonly activationEnvelopeMs: number;\n  readonly activationDrawSetupMs: number;\n  readonly activationDrawTraceMs: number;\n  readonly activationDrawOverlayMs: number;\n",
1,
)
needle = "        `activationDraw=${latestRestore.activationDrawMs.toFixed(2)} ms`,\n        `activationEnvelope=${latestRestore.activationEnvelopeMs.toFixed(2)} ms`,\n        `activationDrawOther=${Math.max(0, latestRestore.activationDrawMs - latestRestore.activationEnvelopeMs).toFixed(2)} ms`,\n"
replace = "        `activationDraw=${latestRestore.activationDrawMs.toFixed(2)} ms`,\n        `activationEnvelope=${latestRestore.activationEnvelopeMs.toFixed(2)} ms`,\n        `activationDrawSetup=${latestRestore.activationDrawSetupMs.toFixed(2)} ms`,\n        `activationDrawTrace=${latestRestore.activationDrawTraceMs.toFixed(2)} ms`,\n        `activationDrawOverlay=${latestRestore.activationDrawOverlayMs.toFixed(2)} ms`,\n        `activationDrawRemainder=${Math.max(0, latestRestore.activationDrawMs - latestRestore.activationEnvelopeMs - latestRestore.activationDrawSetupMs - latestRestore.activationDrawTraceMs - latestRestore.activationDrawOverlayMs).toFixed(2)} ms`,\n"
if needle not in s:
    raise SystemExit('diagnostic lines not found')
s = s.replace(needle, replace, 1)
p.write_text(s)
