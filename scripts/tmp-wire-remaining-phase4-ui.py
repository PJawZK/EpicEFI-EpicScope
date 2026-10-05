from pathlib import Path

analyzer = Path('apps/web/src/pages/analyzer-page.ts')
text = analyzer.read_text(encoding='utf-8')
text = text.replace(
"import { createBoostAnalyzerView } from './boost-analyzer-view';",
"import { createBoostAnalyzerView } from './boost-analyzer-view';\nimport {\n  createSpecializedAnalyzerSuiteView,\n  type SpecializedAnalyzerDomain,\n} from './specialized-analyzer-suite-view';",
1)
text = text.replace(
"  let currentView: 'compare' | 'tune-table' | 'boost' = 'compare';\n  const tuneTableView = createTuneTableView();\n  const boostView = createBoostAnalyzerView();",
"  type AnalyzerView = 'compare' | 'tune-table' | 'boost' | SpecializedAnalyzerDomain;\n  let currentView: AnalyzerView = 'compare';\n  const tuneTableView = createTuneTableView();\n  const boostView = createBoostAnalyzerView();\n  const specializedView = createSpecializedAnalyzerSuiteView();",
1)
text = text.replace(
"          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"boost\">Boost <span class=\"analyzer-experimental-tag\">EXP</span></button>",
"          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"boost\">Boost <span class=\"analyzer-experimental-tag\">EXP</span></button>\n          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"idle\">Idle <span class=\"analyzer-experimental-tag\">EXP</span></button>\n          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"ae-map\">AE / MAP <span class=\"analyzer-experimental-tag\">EXP</span></button>\n          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"fueling\">Fueling <span class=\"analyzer-experimental-tag\">EXP</span></button>\n          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"ignition\">Ignition <span class=\"analyzer-experimental-tag\">EXP</span></button>\n          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"fuel-injector\">Fuel / Injector <span class=\"analyzer-experimental-tag\">EXP</span></button>\n          <button type=\"button\" class=\"analyzer-view-choice\" data-analyzer-view=\"trigger-sync\">Trigger / Sync <span class=\"analyzer-experimental-tag\">EXP</span></button>",
1)
text = text.replace(
"  root.append(tuneTableView.element, boostView.element);",
"  root.append(tuneTableView.element, boostView.element, specializedView.element);",
1)
old = """  const setView = (view: 'compare' | 'tune-table' | 'boost'): void => {
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
new = """  const specializedTitles: Record<SpecializedAnalyzerDomain, [string, string]> = {
    idle: ['Idle analysis', 'Target/error, valve duty/bias/feed-forward, PID terms and sag/recovery behavior.'],
    'ae-map': ['AE / MAP Predict analysis', 'Tip-in/decel events, measured/predicted MAP response and AFR excursion.'],
    fueling: ['Fueling analysis', 'AFR target/actual error, lean/rich evidence and optional VE context.'],
    ignition: ['Ignition analysis', 'Advance, retard and knock-oriented evidence with grouped knock events.'],
    'fuel-injector': ['Fuel pressure / injector analysis', 'Rail pressure, injector PW/duty/deadtime and threshold-event evidence.'],
    'trigger-sync': ['Trigger / sync analysis', 'Synchronization dropouts, trigger errors and sync-loss counter events.'],
  };

  const setView = (view: AnalyzerView): void => {
    currentView = view;
    const compareActive = view === 'compare';
    const tuneActive = view === 'tune-table';
    const boostActive = view === 'boost';
    const specializedActive = !compareActive && !tuneActive && !boostActive;
    compareControls.hidden = !compareActive;
    tuneTableView.element.hidden = !tuneActive;
    boostView.element.hidden = !boostActive;
    specializedView.element.hidden = !specializedActive;
    for (const choice of viewChoices) {
      const selected = choice.dataset.analyzerView === view;
      choice.classList.toggle('analyzer-view-choice--active', selected);
      choice.setAttribute('aria-pressed', String(selected));
    }
    if (compareActive) {
      heading.textContent = 'Saved range comparison';
      description.textContent = 'Compare one active decoded channel across two saved Logger ranges.';
      render();
      return;
    }
    empty.hidden = true;
    content.hidden = true;
    if (tuneActive) {
      heading.textContent = 'Tune table correlation';
      description.textContent = 'Map decoded operating points and observed values into an explicitly selected MSQ table.';
      tuneTableView.refresh();
      return;
    }
    if (boostActive) {
      heading.textContent = 'Boost analysis';
      description.textContent = 'Analyze boost tracking, spool and steady-state behavior from active decoded channels.';
      boostView.refresh();
      return;
    }
    const [title, detail] = specializedTitles[view];
    heading.textContent = title;
    description.textContent = detail;
    specializedView.setDomain(view);
    specializedView.refresh();
  };"""
if old not in text:
    raise SystemExit('setView anchor not found')
text = text.replace(old, new, 1)
text = text.replace(
"    tuneTableView.setContext(nextContext);\n    boostView.setContext(nextContext);",
"    tuneTableView.setContext(nextContext);\n    boostView.setContext(nextContext);\n    specializedView.setContext(nextContext);",
1)
text = text.replace(
"      if (view === 'compare' || view === 'tune-table' || view === 'boost') setView(view);",
"      if (view === 'compare' || view === 'tune-table' || view === 'boost' || view === 'idle' || view === 'ae-map' || view === 'fueling' || view === 'ignition' || view === 'fuel-injector' || view === 'trigger-sync') setView(view);",
1)
text = text.replace(
"    refresh: () => currentView === 'compare' ? render() : currentView === 'tune-table' ? tuneTableView.refresh() : boostView.refresh(),",
"    refresh: () => {\n      if (currentView === 'compare') render();\n      else if (currentView === 'tune-table') tuneTableView.refresh();\n      else if (currentView === 'boost') boostView.refresh();\n      else specializedView.refresh();\n    },",
1)
analyzer.write_text(text, encoding='utf-8')

main = Path('apps/web/src/main.ts')
text = main.read_text(encoding='utf-8')
text = text.replace(
"import './styles/boost-analyzer.css';",
"import './styles/boost-analyzer.css';\nimport './styles/specialized-analyzer.css';",
1)
main.write_text(text, encoding='utf-8')
