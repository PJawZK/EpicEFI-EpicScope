import './styles/tokens.css';
import './styles/app.css';
import './styles/log-import.css';
import './styles/timeline-graph.css';
import './styles/logger-ui.css';
import './styles/workspace-starters.css';
import './styles/channel-value-search.css';
import './styles/histogram.css';
import './styles/histogram-workspace.css';
import './styles/histogram-table-generator.css';
import './styles/histogram-distribution.css';
import './styles/scatter-mlv.css';
import './styles/analyzer.css';
import './styles/boost-analyzer.css';
import './styles/boost-table-enhancements.css';
import './styles/specialized-analyzer.css';
import './styles/ve-analyzer-workbench.css';
import './styles/ve-delay-table.css';
import './styles/ve-analyzer-workflow.css';
import './styles/analyzer-information-hierarchy.css';
import './styles/performance-diagnostics.css';
import './styles/ui-refinements.css';
import { mountAppShell } from './app/app-shell';
import { applyUiRefinements } from './app/ui-refinements';
import { applyNavigationRefinements } from './app/ui-refinements-navigation';
import { installShimLiveUi } from './app/shim-live-ui';
import { installShimHttpUi } from './app/shim-http-ui';
import { installSourceTransitionUi } from './app/source-transition';
import { installBoostTableEnhancements } from './app/boost-table-enhancements';
import { installAnalyzerInformationHierarchy } from './app/analyzer-information-hierarchy';
import { installAnalyzerHelp } from './app/analyzer-help-installer';
import { installVeAnalyzerUiRefinements } from './app/ve-analyzer-ui-refinements';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('EpicScope bootstrap failed: #app root was not found.');
}

mountAppShell(root);
installShimLiveUi(root);
installShimHttpUi(root);
installSourceTransitionUi(root);
applyUiRefinements(root);
applyNavigationRefinements(root);
installBoostTableEnhancements(root);
installAnalyzerInformationHierarchy(root);
installAnalyzerHelp(root);
installVeAnalyzerUiRefinements(root);

root.querySelector<HTMLElement>('.histogram-table-size')?.remove();
const tableSizeSummary = root.querySelector<HTMLElement>('.histogram-table-options > summary');
if (tableSizeSummary) tableSizeSummary.textContent = 'Table Size';