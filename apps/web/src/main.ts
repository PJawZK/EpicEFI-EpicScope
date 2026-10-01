import './styles/tokens.css';
import './styles/app.css';
import './styles/log-import.css';
import { mountAppShell } from './app/app-shell';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('EpicScope bootstrap failed: #app root was not found.');
}

mountAppShell(root);
