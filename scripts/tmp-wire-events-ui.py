from pathlib import Path

logger = Path('apps/web/src/pages/logger-page.ts')
text = logger.read_text(encoding='utf-8')

old = """import { createRangeQualificationPanel } from '../panels/range-qualification-panel';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';"""
new = """import { createRangeQualificationPanel } from '../panels/range-qualification-panel';
import { findNumericEvents } from '../../../../core/analysis/events';
import { qualifyNumericSamples } from '../../../../core/analysis/sample-qualification';"""
if old not in text:
    raise SystemExit('events import anchor not found')
text = text.replace(old, new, 1)

old = """  rangeQualification.setEvaluator((referenceChannelId, conditions) => {
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

  const analysisTrigger = timeline.element.querySelector<HTMLElement>('.timeline-analysis-context');"""
new = """  const activeAnalysisRanges = () => {
    const runtime = activePaneRuntime();
    if (!runtime) return undefined;
    return new Map(runtime.graph.getOverviewTraces().map((trace) => [
      trace.channelId,
      { range: trace.range, complete: false },
    ]));
  };

  rangeQualification.setEvaluator((referenceChannelId, conditions) => {
    if (analysisStartMs === undefined || analysisEndMs === undefined || analysisStartMs === analysisEndMs) {
      return undefined;
    }
    const channels = activeAnalysisRanges();
    if (!channels) return undefined;
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

  rangeQualification.setEventEvaluator((referenceChannelId, conditions, eventOptions) => {
    if (analysisStartMs === undefined || analysisEndMs === undefined || analysisStartMs === analysisEndMs) {
      return undefined;
    }
    const channels = activeAnalysisRanges();
    if (!channels) return undefined;
    try {
      return findNumericEvents({
        referenceChannelId,
        channels,
        conditions,
        timeRange: { startMs: analysisStartMs, endMs: analysisEndMs },
        eventOptions,
      });
    } catch {
      return undefined;
    }
  });

  const analysisTrigger = timeline.element.querySelector<HTMLElement>('.timeline-analysis-context');"""
if old not in text:
    raise SystemExit('events evaluator anchor not found')
logger.write_text(text.replace(old, new, 1), encoding='utf-8')

css = Path('apps/web/src/styles/logger-ui.css')
css_text = css.read_text(encoding='utf-8')
addition = r'''

/* Generic Events shares the selected-range condition editor. Timing rules are
   secondary/contextual; event-table presentation may be capped without
   changing the full analysis count. */
.range-events-options {
  border: 1px solid #263b4c;
  border-radius: 4px;
  background: #0b171f;
}

.range-events-options > summary {
  cursor: pointer;
  list-style: none;
  padding: 7px 9px;
  color: #8da2af;
  font-size: 9px;
  font-weight: 700;
}

.range-events-options > summary::-webkit-details-marker {
  display: none;
}

.range-events-options > summary::after {
  content: '▾';
  float: right;
  color: #627b8b;
}

.range-events-options[open] > summary::after {
  content: '▴';
}

.range-events-option-grid {
  display: grid;
  grid-template-columns: 150px 150px minmax(0, 1fr);
  gap: 8px;
  align-items: end;
  padding: 0 9px 9px;
}

.range-events-input-unit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  border: 1px solid #2f4b59;
  border-radius: 3px;
  background: #101d28;
}

.range-events-input-unit input {
  min-width: 0;
  height: 27px;
  border: 0;
  padding: 0 7px;
  background: transparent;
  color: #dbe8ef;
  font-size: 9px;
}

.range-events-input-unit em {
  padding-right: 7px;
  color: #6f8796;
  font-size: 8px;
  font-style: normal;
}

.range-events-run {
  min-height: 29px;
  border-color: #3b5969;
  background: #102331;
  color: #dceaf1;
}

.range-events-result {
  display: grid;
  gap: 7px;
}

.range-events-result[hidden] {
  display: none;
}

.range-events-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 5px;
}

.range-events-summary > div {
  min-width: 0;
  padding: 6px 8px;
  border: 1px solid #263b4c;
  border-radius: 3px;
  background: #0b171f;
}

.range-events-summary span,
.range-events-summary strong {
  display: block;
}

.range-events-summary span {
  color: #78909e;
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .04em;
}

.range-events-summary strong {
  margin-top: 3px;
  color: #e1edf3;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.range-events-table-wrap {
  max-height: 260px;
  overflow: auto;
  border: 1px solid #263b4c;
  border-radius: 3px;
  background: #09151d;
}

.range-events-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 8px;
}

.range-events-table th,
.range-events-table td {
  padding: 5px 6px;
  border-bottom: 1px solid #203340;
  text-align: right;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.range-events-table th:nth-child(2),
.range-events-table td:nth-child(2) {
  text-align: left;
}

.range-events-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #101d28;
  color: #78909e;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .03em;
}

.range-events-table td {
  color: #cbd9e1;
}

.range-events-render-status {
  color: #718896;
  font-size: 8px;
}

@media (max-width: 720px) {
  .range-events-option-grid {
    grid-template-columns: 1fr 1fr;
  }

  .range-events-option-grid .range-qualification-note {
    grid-column: 1 / -1;
  }

  .range-events-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
'''
if '.range-events-options {' not in css_text:
    css_text += addition
css.write_text(css_text, encoding='utf-8')
