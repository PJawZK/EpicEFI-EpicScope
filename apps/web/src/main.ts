import './styles/tokens.css';
import './styles/app.css';
import './styles/log-import.css';
import './styles/timeline-graph.css';
import './styles/logger-ui.css';
import './styles/channel-value-search.css';
import './styles/histogram.css';
import './styles/performance-diagnostics.css';
import { mountAppShell } from './app/app-shell';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('EpicScope bootstrap failed: #app root was not found.');
}

mountAppShell(root);
