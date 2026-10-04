from pathlib import Path

# Graph: allow workspace restore to clear runtime state without intermediate DOM/canvas refreshes.
p = Path('apps/web/src/components/graph-viewport.ts')
s = p.read_text()
s = s.replace('  clearChannels(): void;\n', '  clearChannels(options?: { readonly render?: boolean }): void;\n', 1)
s = s.replace('  const clearChannels = (): void => {', '  const clearChannels = (options: { readonly render?: boolean } = {}): void => {', 1)
start = s.index('  const clearChannels = (options:')
end = s.index('\n  const refreshValidity =', start)
block = s[start:end]
block = block.replace('    renderReadout();\n', '    if (options.render !== false) renderReadout();\n', 1)
block = block.replace('    emitCursorValues();\n', '    if (options.render !== false) emitCursorValues();\n', 1)
# clearChannels currently performs a final draw; suppress only that restore-intermediate paint.
block = block.replace('    draw();\n', '    if (options.render !== false) draw();\n', 1)
s = s[:start] + block + s[end:]
p.write_text(s)

# Logger restore: use silent clear and avoid a second assigned-channel synchronization in paneRequests.
p = Path('apps/web/src/pages/logger-page.ts')
s = p.read_text()
s = s.replace('      runtime.graph.clearChannels();\n', '      runtime.graph.clearChannels({ render: false });\n', 1)
start = s.index('    const paneRequests = paneRuntimes.slice(0, visibleCount).map')
end = s.index('    const preparePaneRequestsMs = now() - prepareStageStarted;', start)
block = s[start:end]
needle = '      syncPaneAssignedChannels(runtime, pane);\n'
if needle not in block:
    raise SystemExit('paneRequests syncPaneAssignedChannels call not found')
block = block.replace(needle, '', 1)
s = s[:start] + block + s[end:]
p.write_text(s)
