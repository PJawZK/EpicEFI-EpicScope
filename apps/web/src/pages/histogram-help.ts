import {
  addInlineHelpButton,
  type InlineHelpEntry,
} from '../components/inline-help';

const TABLE_GENERATOR_HELP: InlineHelpEntry = {
  title: 'Table Generator',
  text: 'Choose X and Y to define operating cells, then choose the cell statistic and optional Z value calculated inside each cell. Qualification is applied before binning. Click a populated cell to inspect its contributing samples and open that evidence in Logger.',
};

const CELL_STATISTIC_HELP: InlineHelpEntry = {
  title: 'Cell statistic',
  text: 'Controls what each table cell reports. Weighted Mean gives samples more influence near the X/Y cell center; the other choices use the qualified samples assigned to that cell directly.',
};

const Z_REFERENCE_HELP: InlineHelpEntry = {
  title: 'Z subtraction',
  text: 'When a second channel is selected here, EpicScope calculates Z minus that reference channel sample-by-sample before the chosen cell statistic is calculated.',
};

const QUALIFICATION_HELP: InlineHelpEntry = {
  title: 'Qualification',
  text: 'Applies a saved ALL/ANY filter set before this analysis. Rejected, invalid, or unavailable samples do not enter the result. The same saved qualification definitions are shared across Histogram analysis views.',
};

const DISTRIBUTION_METRIC_HELP: InlineHelpEntry = {
  title: 'Distribution Y axis',
  text: 'Count shows samples per bin. % Samples shows each bin as a share of valid qualified samples. Time integrates contiguous recorded time spent in each bin; recording or decoding gaps are not counted as time at a value.',
};

const DISTRIBUTION_BINS_HELP: InlineHelpEntry = {
  title: 'Distribution bins',
  text: 'Auto chooses a bin count from the observed qualified distribution. Manual uses the requested count. Comparisons always use one shared set of bin boundaries so the two scopes remain directly comparable.',
};

const DISTRIBUTION_VIEW_HELP: InlineHelpEntry = {
  title: 'Distribution view',
  text: 'Histogram shows the value in each individual bin. Cumulative shows the running percentage of the selected metric up to each channel value.',
};

const DISTRIBUTION_COMPARE_HELP: InlineHelpEntry = {
  title: 'Compare distributions',
  text: 'Adds a second analysis scope using the same channel, qualification, and bin boundaries. Use it to compare Full Log, Current A/B, or Saved Range evidence on equal geometry.',
};

const SCATTER_TRACE_HELP: InlineHelpEntry = {
  title: 'Scatter trace',
  text: 'Dots emphasize the relationship between X and Y samples. Lines connect the recorded sequence to show its path through the relationship; EpicScope breaks the path across large sample gaps instead of drawing through them.',
};

const SCATTER_HEAT_HELP: InlineHelpEntry = {
  title: 'Scatter density heat',
  text: 'Color represents local X/Y sample density. Density is calculated from the full qualified pair set even when the visible point drawing is reduced for browser performance.',
};

const SCATTER_SELECTION_HELP: InlineHelpEntry = {
  title: 'Scatter evidence selection',
  text: 'Drag a box inside the plot to select every qualified X/Y pair in that value region, including points omitted from the reduced visible drawing. The region count and bounds remain visible and the full selected evidence can be opened in Logger. A simple click still selects one rendered point.',
};

function addSelectHelp(root: HTMLElement, selector: string, help: InlineHelpEntry): void {
  const select = root.querySelector<HTMLSelectElement>(selector);
  const host = select?.closest('label')?.querySelector<HTMLElement>(':scope > span');
  if (!host) return;
  addInlineHelpButton(host, help).classList.add('epicscope-info-icon');
}

function replaceLegacyTableHelp(root: HTMLElement): void {
  const legacy = root.querySelector<HTMLDetailsElement>('.histogram-table-help');
  if (!legacy || legacy.dataset.sharedHelpInstalled === 'true') return;
  legacy.dataset.sharedHelpInstalled = 'true';
  legacy.hidden = true;

  const host = document.createElement('span');
  host.className = 'histogram-shared-help-slot';
  host.setAttribute('aria-label', 'Table Generator help');
  legacy.before(host);
  addInlineHelpButton(host, TABLE_GENERATOR_HELP).classList.add('epicscope-info-icon');
}

export function installHistogramHelp(root: HTMLElement): void {
  replaceLegacyTableHelp(root);

  addSelectHelp(root, '.histogram-table-aggregation', CELL_STATISTIC_HELP);
  addSelectHelp(root, '.histogram-table-delta', Z_REFERENCE_HELP);

  addSelectHelp(root, '.distribution-qualification', QUALIFICATION_HELP);
  addSelectHelp(root, '.distribution-metric', DISTRIBUTION_METRIC_HELP);
  addSelectHelp(root, '.distribution-bin-mode', DISTRIBUTION_BINS_HELP);
  addSelectHelp(root, '.distribution-display', DISTRIBUTION_VIEW_HELP);
  const compareHost = root.querySelector<HTMLElement>('.distribution-compare-toggle > span');
  if (compareHost) addInlineHelpButton(compareHost, DISTRIBUTION_COMPARE_HELP).classList.add('epicscope-info-icon');

  addSelectHelp(root, '.scatter-qualification', QUALIFICATION_HELP);
  addSelectHelp(root, '.scatter-trace-mode', SCATTER_TRACE_HELP);
  for (const selectionHost of root.querySelectorAll<HTMLElement>('.scatter-pane-select')) {
    addInlineHelpButton(selectionHost, SCATTER_SELECTION_HELP).classList.add('epicscope-info-icon');
  }
  for (const heatHost of root.querySelectorAll<HTMLElement>('.scatter-pane-z')) {
    addInlineHelpButton(heatHost, SCATTER_HEAT_HELP).classList.add('epicscope-info-icon');
  }
}
