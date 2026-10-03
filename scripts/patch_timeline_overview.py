from pathlib import Path

p = Path('apps/web/src/pages/logger-page.ts')
s = p.read_text()
old = """      channelPerformanceListener?.({
        ...performance,
        channelName: channel?.sourceName ?? performance.channelId,
      });
"""
new = old + """      if (runtime.id === activeWorkspace()?.activePaneId) {
        timeline.setOverviewContent(runtime.graph.getOverviewTraces(), logMarkers);
      }
"""
if old not in s:
    raise SystemExit('channel performance anchor not found')
p.write_text(s.replace(old, new, 1))
