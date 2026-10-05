from pathlib import Path

path = Path('apps/web/src/pages/analyzer-page.ts')
text = path.read_text(encoding='utf-8')
text = text.replace(
"import { createTuneTableView } from './tune-table-view';",
"import { createTuneTableView } from './tune-table-view';\nimport { createBoostAnalyzerView } from './boost-analyzer-view';",
1)
text = text.replace(
"  let currentView: 'compare' | 'tune-table' = 'compare';\n  const tuneTableView = createTuneTableView();",
"  let currentView: 'compare' | 'tune-table' | 'boost' = 'compare';\n  const tuneTableView = createTuneTableView();\n  const boostView = createBoostAnalyzerView();",
1)
text = text.replace(
"          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"tune-table\">Tune Table</button>",
"          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"tune-table\">Tune Table</button>\n          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"boost\">Boost <span class=\"analyzer-experimental-tag\">EXP</span></button>",
1)
text = text.replace(
"  root.append(tuneTableView.element);",
"  root.append(tuneTableView.element, boostView.element);",
1)
old = """  const setView = (view: 'compare' | 'tune-table'): void => {
    currentView = view;
    const compareActive = view === 'compare';
    compareControls.hidden = !compareActive;
    tuneTableView.element.hidden = compareActive;
    for (const choice of viewChoices) {
      const selected = choice.dataset.analyzerView === view;
      choice.classList.toggle('analyzer-view-choice--active', selected);
      choice.setAttribute('aria-pressed', String(selected));
    }
    heading.textContent = compareActive ? 'Saved range comparison' : 'Tune table correlation';
    description.textContent = compareActive
      ? 'Compare one active decoded channel across two saved Logger ranges.'
      : 'Map decoded operating points and observed values into an explicitly selected MSQ table.';
    if (compareActive) render();
    else {
      empty.hidden = true;
      content.hidden = true;
      tuneTableView.refresh();
    }
  };"""
new = """  const setView = (view: 'compare' | 'tune-table' | 'boost'): void => {
    currentView = view;
    const compareActive = view === 'compare';
    const tuneActive = view === 'tune-table';
    const boostActive = view === 'boost';
    compareControls.hidden = !compareActive;
    tuneTableView.element.hidden = !tuneActive;
    boostView.element.hidden = !boostActive;
    for (const choice of viewChoices) {
      const selected = choice.dataset.analyzerView === view;
      choice.classList.toggle('analyzer-view-choice--active', selected);
      choice.setAttribute('aria-pressed', String(selected));
    }
    heading.textContent = compareActive ? 'Saved range comparison' : tuneActive ? 'Tune table correlation' : 'Boost analysis';
    description.textContent = compareActive
      ? 'Compare one active decoded channel across two saved Logger ranges.'
      : tuneActive
        ? 'Map decoded operating points and observed values into an explicitly selected MSQ table.'
        : 'Analyze boost tracking, spool and steady-state behavior from active decoded channels.';
    if (compareActive) render();
    else {
      empty.hidden = true;
      content.hidden = true;
      if (tuneActive) tuneTableView.refresh();
      else boostView.refresh();
    }
  };"""
if old not in text:
    raise SystemExit('Analyzer setView anchor not found')
text = text.replace(old, new, 1)
text = text.replace(
"    tuneTableView.setContext(nextContext);\n    fillChannelSelect(previousChannel);",
"    tuneTableView.setContext(nextContext);\n    boostView.setContext(nextContext);\n    fillChannelSelect(previousChannel);",
1)
text = text.replace(
"      if (view === 'compare' || view === 'tune-table') setView(view);",
"      if (view === 'compare' || view === 'tune-table' || view === 'boost') setView(view);",
1)
text = text.replace(
"    refresh: () => currentView === 'compare' ? render() : tuneTableView.refresh(),",
"    refresh: () => currentView === 'compare' ? render() : currentView === 'tune-table' ? tuneTableView.refresh() : boostView.refresh(),",
1)
path.write_text(text, encoding='utf-8')
