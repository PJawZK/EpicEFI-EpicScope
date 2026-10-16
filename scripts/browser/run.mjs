import { runObservabilityRecovery } from './observability-recovery.mjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { connect, pause } from './cdp.mjs';
import { runAcceptance } from './acceptance.mjs';
import { runStorageStartupChecks } from './storage-startup.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.resolve(root, process.env.BROWSER_RESULTS_DIR || 'artifacts/browser');
const chrome = process.env.CHROME_BIN || 'chromium';
const started = new Date().toISOString();
const results = [];
let server, child, browser, temporary, chromeLog;
let stop;
let stopping = false;
const checkRunning = () => { if (stopping) throw Error('Browser run cancelled'); };
const interrupted = new Promise((_, reject) => { stop = reject; });
const onSignal = signal => stop(Error(`Interrupted by ${signal}`));
const sigint = () => onSignal('SIGINT');
const sigterm = () => onSignal('SIGTERM');
process.once('SIGINT', sigint);
process.once('SIGTERM', sigterm);
const deadline = setTimeout(() => stop(Error('Browser suite exceeded 10 minutes')), 600000);
const log = (label, details = {}) => console.log(JSON.stringify({ label, ...details }));
async function record(name, result) {
  checkRunning();
  if (!Number.isInteger(result?.passed) || result.passed < 1 || !Array.isArray(result.checks) || result.checks.length !== result.passed) {
    throw Error(`Invalid/empty browser result: ${name}: ${JSON.stringify(result)}`);
  }
  results.push({ name, ...result });
  await fs.writeFile(path.join(output, name), JSON.stringify(result, null, 2));
}
async function waitUntil(check, label, timeout = 30000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    checkRunning();
    if (child && (child.exitCode !== null || child.signalCode)) throw Error(`Chrome exited while waiting for ${label}`);
    try { if (await check()) return; }
    catch (error) {
      // A readiness poll may race document replacement. Retry only DevTools
      // context/navigation failures; assertions and application errors still fail.
      if (!/Execution context was destroyed|Cannot find context|Inspected target navigated or closed/i.test(String(error))) throw error;
    }
    await pause(100);
  }
  throw Error(`Timed out: ${label}`);
}
async function run() {
  await fs.mkdir(output, { recursive: true });
  // Clear only runner-owned files; never mix results from an earlier run.
  for (const name of await fs.readdir(output)) {
    if (/^(staged|fallback)-.*\.json$/.test(name) || ['summary.json', 'failure.json', 'failure.png', 'chrome.log'].includes(name)) {
      await fs.rm(path.join(output, name), { force: true });
    }
  }
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'epicscope-browser-'));
  server = await createServer({ root: path.join(root, 'apps/web'), configFile: path.join(root, 'vite.config.ts'), server: { host: '127.0.0.1', port: 0, open: false } });
  await server.listen();
  const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  const base = server.config.base;
  const moduleBase = `${base}@fs${root}/tests/web/`;
  chromeLog = await fs.open(path.join(output, 'chrome.log'), 'w');
  child = spawn(chrome, ['--headless', '--disable-dev-shm-usage', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${temporary}`, ...(process.env.CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), 'about:blank'], { stdio: ['ignore', chromeLog.fd, chromeLog.fd] });
  child.once('error', error => stop(Error(`Cannot start ${chrome}: ${error.message}. Set CHROME_BIN to an installed Chromium/Chrome executable.`)));
  let debugPort;
  await waitUntil(async () => {
    try { debugPort = Number((await fs.readFile(path.join(temporary, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); return debugPort > 0; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  }, 'Chrome DevTools startup');
  for (const mode of ['staged', 'fallback']) {
    browser = await connect(debugPort);
    const client = { ...browser };
    for (const method of ['call', 'evaluate', 'file']) {
      const invoke = browser[method];
      client[method] = (...args) => { checkRunning(); return invoke(...args); };
    }
    const errors = [];
    browser.on('Runtime.exceptionThrown', error => errors.push(error));
    await client.call('Runtime.enable');
    await client.call('Page.enable');
    await client.call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });
    if (mode === 'fallback') await client.call('Page.addScriptToEvaluateOnNewDocument', { source: 'globalThis.Worker = undefined;' });
    await client.call('Page.navigate', { url: origin + base });
    const wait = expression => waitUntil(() => client.evaluate(expression), expression, 120000);
    await wait('!!document.querySelector(".load-ini")');
    log('configuration', { mode });
    await record(`${mode}-storage-startup.json`, await runStorageStartupChecks({ ...client, wait, moduleBase, fixture: name => path.join(root, 'tests/fixtures/browser', name) }));
    await runAcceptance({ ...client, wait, moduleBase, mode, downloadDir: path.join(output, `${mode}-downloads`), fixture: name => path.join(root, 'tests/fixtures/browser', name), record: (name, result) => record(`${mode}-${name}`, result), log });
    // Real pointer capture and keyboard entry complement component-dispatched events.
    const coords = await client.evaluate(`(async()=>{const m=await import('${moduleBase}ve-delay-editing.browser.mjs');return m.prepareNativeDelayEdit();})()`, 60000);
    const [start, end] = coords;
    await client.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start });
    await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, button: 'left', buttons: 1, clickCount: 1 });
    await client.call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...end, button: 'left', buttons: 1 });
    await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...end, button: 'left', buttons: 0, clickCount: 1 });
    await pause(100);
    await client.call('Input.dispatchKeyEvent', { type: 'keyDown', key: '1', text: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
    await client.call('Input.dispatchKeyEvent', { type: 'keyUp', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
    await client.call('Input.insertText', { text: '75' });
    for (const type of ['keyDown', 'keyUp']) await client.call('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    const observed = await client.evaluate(`(async()=>{const m=await import('${moduleBase}ve-delay-editing.browser.mjs');return m.finishNativeDelayEdit();})()`, 60000);
    await record(`${mode}-native.json`, { passed: 1, checks: ['native pointer capture and keyboard commit preserve range editing'], observed });
    const shiftCoords = await client.evaluate(`(async()=>{const m=await import('${moduleBase}ve-delay-editing.browser.mjs');return m.prepareNativeDelayEdit();})()`, 60000);
    for (const [index, point] of shiftCoords.entries()) {
      const modifiers = index === 1 ? 8 : 0; // DevTools Shift modifier.
      await client.call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1, modifiers });
      await client.call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1, modifiers });
    }
    await client.call('Input.dispatchKeyEvent', { type: 'keyDown', key: '1', text: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
    await client.call('Input.dispatchKeyEvent', { type: 'keyUp', key: '1', code: 'Digit1', windowsVirtualKeyCode: 49 });
    await client.call('Input.insertText', { text: '75' });
    const preview = await client.evaluate(`(async()=>{const m=await import('${moduleBase}ve-delay-editing.browser.mjs');return m.readNativeDelayPreview();})()`);
    for (const type of ['keyDown', 'keyUp']) await client.call('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    const shiftObserved = await client.evaluate(`(async()=>{const m=await import('${moduleBase}ve-delay-editing.browser.mjs');return m.finishNativeDelayEdit();})()`);
    await record(`${mode}-native-shift.json`, { passed: 1, checks: ['native Shift-click rectangle and direct numeric live preview commit once without F2'], observed: { preview, ...shiftObserved } });
    await pause(100);
    const lifecycle = await client.evaluate(`(async()=>{const m=await import('${moduleBase}observability-lifecycle.browser.mjs');return m.runObservabilityLifecycleChecks();})()`,60000);
    await record(`${mode}-observability-lifecycle.json`, lifecycle);
    // Wait for the old document to leave before probing the newly mounted owner.
    await client.evaluate('window.__observabilityReloadPending = true');
    await client.call('Page.reload');
    await waitUntil(async () => {
      try { return await client.evaluate('!window.__observabilityReloadPending && !!document.querySelector(".load-ini")'); }
      catch (error) {
        if (/context.*destroyed|Cannot find context/i.test(String(error))) return false;
        throw error;
      }
    }, 'fresh observability document');
    const reloaded = await client.evaluate(`(async()=>{const m=await import('${moduleBase}observability-lifecycle.browser.mjs');const s=m.readApplicationObservability();if(!s)throw Error('Reloaded shell has no observability session');return {id:s.sessionId,starts:s.records.filter(r=>r.name==='session.started').length,errors:s.records.filter(r=>r.name.startsWith('runtime.')).length};})()`);
    if(reloaded.id===lifecycle.observed.sessionId||reloaded.starts!==1||reloaded.errors!==0)throw Error('Reload did not create an isolated fresh observability session');
    await record(`${mode}-observability-reload.json`, {passed:1,checks:['reload creates a fresh session without reviving previous in-memory runtime errors']});
    await runObservabilityRecovery({ ...client, wait, moduleBase, record: (name, result) => record(`${mode}-${name}`, result) });
    if (errors.length) throw Error(`Unhandled browser exceptions: ${JSON.stringify(errors)}`);
    await browser.close();
    browser = undefined;
  }
  const passed = results.reduce((sum, result) => sum + result.passed, 0);
  await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify({ started, status: 'passed', passed, results }, null, 2));
  log('PASS', { passed, output });
}
try {
  await Promise.race([run(), interrupted]);
} catch (error) {
  stopping = true;
  process.exitCode = 1;
  console.error(error.stack || error);
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify({ started, status: 'failed', error: String(error), results }, null, 2));
  if (browser) {
    try {
      const snapshot = await browser.evaluate('({url:location.href, text:document.body.innerText})');
      await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), snapshot }, null, 2));
      const { data } = await browser.call('Page.captureScreenshot', {}, 5000);
      await fs.writeFile(path.join(output, 'failure.png'), Buffer.from(data, 'base64'));
    } catch (diagnosticError) { console.error('Diagnostic capture:', String(diagnosticError)); }
  }
} finally {
  clearTimeout(deadline);
  process.removeListener('SIGINT', sigint);
  process.removeListener('SIGTERM', sigterm);
  if (browser) await browser.close().catch(error => console.error('Browser cleanup:', String(error)));
  if (child && child.exitCode === null && !child.signalCode) {
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), pause(3000)]);
    if (child.exitCode === null && !child.signalCode) child.kill('SIGKILL');
  }
  await server?.close();
  await chromeLog?.close();
  if (temporary) await fs.rm(temporary, { recursive: true, force: true });
}
