from pathlib import Path

logger = Path('apps/web/src/pages/logger-page.ts')
text = logger.read_text(encoding='utf-8')

old = """import { createChannelValueSearchPanel } from '../panels/channel-value-search-panel';
import {
  normalizeWorkspaceChannelIds,"""
new = """import { createChannelValueSearchPanel } from '../panels/channel-value-search-panel';
import { createRangeQualificationPanel } from '../panels/range-qualification-panel';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';
import {
  normalizeWorkspaceChannelIds,"""
if old not in text:
    raise SystemExit('logger import anchor not found')
text = text.replace(old, new, 1)

old = """  const diagnostics = createParserDiagnosticsIndicator();
  const valueSearch = createChannelValueSearchPanel();
  const graphSelector = createGraphSelector();
  let viewport: TimelineViewport | undefined;
  let previousCursorTimeMs = 0;"""
new = """  const diagnostics = createParserDiagnosticsIndicator();
  const valueSearch = createChannelValueSearchPanel();
  const rangeQualification = createRangeQualificationPanel();
  const graphSelector = createGraphSelector();
  let viewport: TimelineViewport | undefined;
  let analysisStartMs: number | undefined;
  let analysisEndMs: number | undefined;
  let previousCursorTimeMs = 0;"""
if old not in text:
    raise SystemExit('logger construction anchor not found')
text = text.replace(old, new, 1)

old = """  const activePaneRuntime = () => {
    const pane = activePaneState();
    return paneRuntimes.find((runtime) => runtime.id === pane?.id) ?? paneRuntimes[0];
  };

  const refreshWorkspaceSelector = (): void => {"""
new = """  const activePaneRuntime = () => {
    const pane = activePaneState();
    return paneRuntimes.find((runtime) => runtime.id === pane?.id) ?? paneRuntimes[0];
  };

  const activeDecodedChannels = (): readonly ChannelDefinition[] => {
    const runtime = activePaneRuntime();
    return runtime
      ? [...runtime.activeChannelIds].flatMap((id) => {
          const channel = channelDefinitions.get(id);
          return channel ? [channel] : [];
        })
      : [];
  };

  rangeQualification.setEvaluator((referenceChannelId, conditions) => {
    const runtime = activePaneRuntime();
    if (!runtime || analysisStartMs === undefined || analysisEndMs === undefined || analysisStartMs === analysisEndMs) {
      return undefined;
    }
    const traces = runtime.graph.getOverviewTraces();
    const channels = new Map(traces.map((trace) => [
      trace.channelId,
      { range: trace.range, complete: false },
    ]));
    try {
      return qualifyNumericSamples({
        referenceChannelId,
        channels,
        conditions,
        timeRange: { startMs: analysisStartMs, endMs: analysisEndMs },
      });
    } catch {
      return undefined;
    }
  });

  const analysisTrigger = timeline.element.querySelector<HTMLElement>('.timeline-analysis-context');
  if (analysisTrigger) {
    analysisTrigger.setAttribute('role', 'button');
    analysisTrigger.tabIndex = 0;
    analysisTrigger.title = 'Analyze the selected A/B range';
    const openRangeAnalysis = (): void => {
      if (analysisStartMs === undefined || analysisEndMs === undefined || analysisStartMs === analysisEndMs) return;
      const channels = activeDecodedChannels();
      if (channels.length === 0) return;
      rangeQualification.setChannels(channels);
      rangeQualification.setRange(analysisStartMs, analysisEndMs);
      rangeQualification.open();
    };
    analysisTrigger.addEventListener('click', openRangeAnalysis);
    analysisTrigger.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      openRangeAnalysis();
    });
  }

  const refreshWorkspaceSelector = (): void => {"""
if old not in text:
    raise SystemExit('active pane runtime anchor not found')
text = text.replace(old, new, 1)

old = """  timeline.onAnnotationChange(({ aTimeMs, bTimeMs }) => {
    paneRuntimes.forEach((runtime) => runtime.graph.setAnalysisRange(aTimeMs, bTimeMs));
    refreshSelectedChannelStatistics();
  });"""
new = """  timeline.onAnnotationChange(({ aTimeMs, bTimeMs }) => {
    analysisStartMs = aTimeMs;
    analysisEndMs = bTimeMs;
    paneRuntimes.forEach((runtime) => runtime.graph.setAnalysisRange(aTimeMs, bTimeMs));
    rangeQualification.setRange(aTimeMs, bTimeMs);
    refreshSelectedChannelStatistics();
  });"""
if old not in text:
    raise SystemExit('timeline annotation anchor not found')
text = text.replace(old, new, 1)

old = """  timelineWrap.append(timeline.element, timelineToggle);
  page.append(workspaceRow, timelineWrap);

  const setChannelCatalog = ("""
new = """  timelineWrap.append(timeline.element, timelineToggle);
  page.append(workspaceRow, timelineWrap, rangeQualification.element);

  const setChannelCatalog = ("""
if old not in text:
    raise SystemExit('page append anchor not found')
text = text.replace(old, new, 1)

logger.write_text(text, encoding='utf-8')

css = Path('apps/web/src/styles/logger-ui.css')
css_text = css.read_text(encoding='utf-8')
css_text += """

/* Contextual A/B analysis: qualification stays off the permanent toolbar and
   evaluates only the active pane's already-decoded graph traces. */
.timeline-analysis-context--ready {
  cursor: pointer;
}
.timeline-analysis-context--ready:hover,
.timeline-analysis-context--ready:focus-visible {
  border-color: #3e7fa5;
  color: #d7edf9;
  background: #102a3b;
  outline: none;
}
.range-qualification-dialog {
  width: min(680px, calc(100vw - 32px));
  max-width: none;
  padding: 0;
  border: 1px solid #385064;
  border-radius: 6px;
  background: #0a141d;
  color: #dce7ee;
}
.range-qualification-dialog::backdrop {
  background: rgb(0 0 0 / .68);
}
.range-qualification-panel {
  display: grid;
  gap: 10px;
  padding: 12px;
}
.range-qualification-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 9px;
  border-bottom: 1px solid #263b4c;
}
.range-qualification-head strong,
.range-qualification-head small {
  display: block;
}
.range-qualification-head strong {
  font-size: 12px;
}
.range-qualification-head small {
  margin-top: 3px;
  color: #7f94a4;
  font-size: 9px;
}
.range-qualification-close {
  width: 28px;
  min-width: 28px;
  height: 28px;
  padding: 0;
  font-size: 16px;
}
.range-qualification-grid {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(0, 2fr);
  gap: 10px;
  align-items: end;
}
.range-qualification-field {
  display: grid;
  gap: 4px;
}
.range-qualification-field span,
.range-qualification-condition::before {
  color: #78909e;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.range-qualification-field select,
.range-qualification-condition select,
.range-qualification-condition input {
  height: 29px;
  border: 1px solid #2f4b59;
  border-radius: 3px;
  padding: 0 7px;
  background: #101d28;
  color: #dbe8ef;
  font-size: 9px;
}
.range-qualification-note {
  color: #7f94a4;
  font-size: 9px;
  line-height: 1.45;
}
.range-qualification-conditions {
  display: grid;
  gap: 5px;
}
.range-qualification-condition {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) 72px 120px 30px;
  gap: 5px;
  align-items: center;
}
.range-qualification-remove {
  width: 30px;
  min-width: 30px;
  height: 29px;
  padding: 0;
}
.range-qualification-actions {
  display: flex;
  align-items: center;
  gap: 7px;
}
.range-qualification-actions .grow {
  flex: 1 1 auto;
}
.range-qualification-add,
.range-qualification-run {
  min-height: 29px;
}
.range-qualification-run {
  border-color: #3479ae;
  background: #143653;
  color: #eef8ff;
}
.range-qualification-status {
  min-height: 18px;
  color: #93a8b5;
  font-size: 9px;
}
.range-qualification-result {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}
.range-qualification-result[hidden] {
  display: none;
}
.range-qualification-result > div {
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid #263b4c;
  border-radius: 3px;
  background: #0b171f;
}
.range-qualification-result span,
.range-qualification-result strong {
  display: block;
}
.range-qualification-result span {
  color: #78909e;
  font-size: 7px;
  text-transform: uppercase;
  letter-spacing: .04em;
}
.range-qualification-result strong {
  margin-top: 3px;
  overflow: hidden;
  color: #e1edf3;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 720px) {
  .range-qualification-grid {
    grid-template-columns: 1fr;
  }
  .range-qualification-condition {
    grid-template-columns: minmax(0, 1fr) 62px 100px 30px;
  }
  .range-qualification-result {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
"""
css.write_text(css_text, encoding='utf-8')
