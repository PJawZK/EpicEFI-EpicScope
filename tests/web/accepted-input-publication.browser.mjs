// Full-shell browser regression. Start with a real INI, MSQ and MLG loaded.
// Fixtures are supplied by the browser runner; no production hooks are installed.
export async function runAcceptedInputPublicationChecks({ msqSource, iniSource, mlgBase64 }) {
  const checks = [];
  const record = (message) => { checks.push(message); console.info(`publication-check: ${message}`); };
  const assert = (value, message) => { if (!value) throw Error(message); };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 100));
  const wait = async (predicate, message) => {
    const deadline = performance.now() + 30000;
    while (!predicate()) {
      if (performance.now() > deadline) throw Error(message);
      await settle();
    }
    await settle();
  };
  const select = (selector, value) => {
    const control = document.querySelector(selector);
    assert(control && [...control.options].some((option) => option.value === value), `Missing ${selector}: ${value}`);
    control.value = value;
    control.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const mode = async (value) => {
    document.querySelector(`[data-epicscope-mode="${value}"]`).click();
    await settle();
  };
  const pick = (selector, name, contents) => {
    const input = document.querySelector(selector);
    const candidate = new File([contents], name, { lastModified: 123 });
    Object.defineProperty(input, 'files', { configurable: true, value: { item: () => candidate } });
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const tune = async (name, tableName) => {
    pick('input[accept^=".msq"]', name, msqSource.replaceAll('veTable', tableName));
    await wait(() => document.querySelector('.load-msq').dataset.loadState === 'success', `MSQ acceptance: ${name}`);
  };
  const tableOptions = () => [...document.querySelector('.histogram-table-msq-table').options].map((option) => option.value);
  const veSelect = () => document.querySelector('.ve-analyzer-view [data-role="rpm"]');
  const hasExtra = (selector) => [...document.querySelector(selector).options].some((option) => option.value.toLowerCase() === 'ini:publicationextra');
  // Keep the physical RPM label so the renamed logical entry binds to real data.
  const extraIni = iniSource.replace('rpm =', 'publicationExtra =').replace('entry = rpm,', 'entry = publicationExtra,');
  const ini = async (source, name) => {
    pick('input[accept=".ini,text/plain"]', name, source);
    await wait(() => !document.querySelector('.load-ini').disabled, `INI completion: ${name}`);
    assert(document.querySelector('.load-ini').dataset.loadState !== 'loading', 'INI remained pending');
  };

  await mode('histogram');
  select('.histogram-view-select', 'table');
  const hiddenVe = veSelect();
  await tune('histogram-current.msq', 'publicationTableA');
  assert(tableOptions().includes('publicationTableA') && !tableOptions().includes('veTable'), 'Open Histogram retained previous tune');
  assert(veSelect() === hiddenVe, 'Hidden VE rebuilt for Histogram tune acceptance');
  record('accepted MSQ updates open Histogram; hidden VE defers rebuild');

  const histogramOptions = document.querySelector('.histogram-table-msq-table').innerHTML;
  pick('input[accept^=".msq"]', 'rejected.msq', '<msq>');
  await wait(() => document.querySelector('.load-msq').dataset.loadState === 'issue', 'Expected rejected candidate');
  assert(document.querySelector('.histogram-table-msq-table').innerHTML === histogramOptions, 'Rejected tune changed Histogram');
  record('rejected MSQ preserves the open Histogram tune');

  await mode('analyzer');
  select('.analyzer-header-view-select', 'tune-table');
  await settle();
  assert(document.querySelector('[data-tune-table="source"]').textContent === 'histogram-current.msq', 'Analyzer did not receive deferred tune');
  await tune('analyzer-current.msq', 'publicationTableB');
  assert(document.querySelector('[data-tune-table="source"]').textContent === 'analyzer-current.msq', 'Open Analyzer retained old tune');
  assert(document.querySelector('.histogram-table-msq-table').innerHTML === histogramOptions, 'Hidden Histogram rebuilt');
  record('accepted MSQ updates open Analyzer; hidden Histogram defers');
  await mode('histogram');
  assert(tableOptions().includes('publicationTableB'), 'Histogram missed deferred tune');
  record('Histogram receives latest tune on entry');

  const beforeIniVe = veSelect();
  await ini(extraIni, 'publication-extra.ini');
  assert(hasExtra('.histogram-table-x'), 'Open Histogram missed accepted INI catalog: '+document.querySelector('.load-ini').title+' '+[...document.querySelector('.histogram-table-x').options].map(o=>o.value).join(','));
  assert(veSelect() === beforeIniVe, 'INI acceptance rebuilt hidden VE');
  record('accepted INI updates open Histogram after restore; hidden VE defers');
  await mode('analyzer');
  select('.analyzer-header-view-select', 've');
  await settle();
  assert(hasExtra('.ve-analyzer-view [data-role="actual"]'), 'Analyzer missed deferred INI catalog');
  await ini(iniSource, 'publication-original.ini');
  assert(!hasExtra('.ve-analyzer-view [data-role="actual"]'), 'Open VE retained replaced INI catalog');
  record('accepted INI updates open Analyzer after restore');

  const beforeRejectedIni = veSelect();
  const iniInput = document.querySelector('input[accept=".ini,text/plain"]');
  Object.defineProperty(iniInput, 'files', { configurable: true, value: { item: () => ({ name: 'unreadable.ini', text: async () => { throw Error('controlled read failure'); } }) } });
  iniInput.dispatchEvent(new Event('change', { bubbles: true }));
  await wait(() => document.querySelector('.load-ini').dataset.loadState === 'issue', 'Expected INI read rejection');
  assert(veSelect() === beforeRejectedIni, 'Rejected INI rebuilt accepted context');
  record('failed INI preparation leaves accepted Analyzer context untouched');

  document.querySelector('.setting-unload-ini').click();
  await wait(() => ![...veSelect().options].some((option) => option.value.startsWith('ini:')), 'INI unload not published');
  record('INI unload publishes raw channels to the open Analyzer');
  await ini(iniSource, 'publication-restored.ini');
  await mode('histogram');
  document.querySelector('.setting-unload-ini').click();
  await wait(() => ![...document.querySelector('.histogram-table-x').options].some((option) => option.value.startsWith('ini:')), 'Histogram missed INI unload');
  record('INI unload publishes raw channels to the open Histogram');
  await ini(iniSource, 'publication-bound.ini');

  await mode('analyzer');
  const beforeLogVe = veSelect();
  const bytes = Uint8Array.from(atob(mlgBase64), (char) => char.charCodeAt(0));
  const prefix = 'epicscope.web-workspace.v1:';
  const savedKey = Object.keys(localStorage).find((key) => key.startsWith(prefix));
  assert(savedKey, 'Expected a persisted baseline log workspace');
  const saved = JSON.parse(localStorage.getItem(savedKey));
  const sourceId = `file:publication-replacement.mlg:${bytes.length}:123`;
  saved.payload.sourceId = sourceId;
  saved.payload.sourceDisplayName = 'publication-replacement.mlg';
  Object.assign(saved.payload.workspace.logger.timeline, {
    aTimeMs: 200, bTimeMs: 800,
    savedRanges: [{ label: 'Publication scope', startMs: 200, endMs: 800 }],
  });
  localStorage.setItem(prefix + encodeURIComponent(sourceId), JSON.stringify(saved));
  pick('input[accept^=".mlg"]', 'publication-replacement.mlg', bytes);
  await wait(() => document.querySelector('.open-log').dataset.loadState === 'success', 'MLG validation/import incomplete');
  await wait(() => veSelect() !== beforeLogVe, 'Accepted MLG did not update the open Analyzer');
  assert(!document.querySelector('.analyzer-page').hidden, 'Publication changed the selected mode');
  record('MLG restore/validation updates the still-open Analyzer');
  assert([...document.querySelector('.ve-analyzer-view [data-role="scope"]').options].some((option) => option.textContent.includes('Publication scope')), 'Analyzer missed the restored saved scope');
  record('accepted log publication includes restored navigation scopes');

  await mode('histogram');
  document.querySelector('#app').dispatchEvent(new Event('epicscope:request-recorded-source-unload'));
  await settle();
  assert(document.querySelector('.loaded-log strong').textContent === 'No log loaded', 'Recorded source not released');
  assert(!document.querySelector('.histogram-table-empty').hidden, 'Histogram retained a result after source unload');
  record('recorded-source unload clears the open Histogram result');

  const { createHistogramPage } = await import('../../apps/web/src/pages/histogram-page');
  const { prepareMsqCandidate } = await import('../../apps/web/src/adapters/msq-candidate');
  const histogram = createHistogramPage();
  document.body.append(histogram.headerControl, histogram.element);
  histogram.element.hidden = false;
  let reads = 0;
  const channels = ['rpm', 'map', 'afr'].map((id) => ({ id, sourceName: id, displayName: id, valueType: 'number' }));
  const traces = channels.map((channel) => ({
    channel, color: '#58aef6', complete: true,
    range: { startSampleIndex: 0, timeMs: new Float64Array([0, 100]), values: new Float64Array([50, 60]), validity: new Uint8Array([1, 1]) },
  }));
  try {
    histogram.setContext({ traces, channels, aTimeMs: undefined, bTimeMs: undefined,
      loadTraces: async (ids) => { reads += 1; return traces.filter((trace) => ids.includes(trace.channel.id)); },
    });
    const view = histogram.headerControl.querySelector('select');
    for (const name of ['distribution', 'scatter', 'math-channels']) {
      view.value = name;
      view.dispatchEvent(new Event('change'));
      await settle();
      const before = reads;
      const tableName = `publication_${name}`;
      histogram.setTuneModel(prepareMsqCandidate(msqSource.replaceAll('veTable', tableName)), `${name}.msq`);
      await settle();
      assert(reads === before && view.value === name, `Tune replacement restarted ${name}`);
      view.value = 'table';
      view.dispatchEvent(new Event('change'));
      await settle();
      assert([...histogram.element.querySelector('.histogram-table-msq-table').options].some((option) => option.value === tableName), `Deferred tune missing after ${name}`);
      record(`tune-only update defers Table Generator and does not reload ${name}`);
    }
  } finally {
    histogram.element.remove();
    histogram.headerControl.remove();
  }

  return { passed: checks.length, checks };
}
