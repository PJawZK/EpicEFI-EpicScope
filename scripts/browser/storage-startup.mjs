// Fault injection belongs to this isolated browser session, never production.
export async function runStorageStartupChecks({ call, evaluate, file, wait, fixture, moduleBase }) {
  const checks = [];
  const moduleUrl = moduleBase + 'storage-startup.browser.mjs';
  const invoke = (name, argument) => evaluate(`(async()=>{const m=await import(${JSON.stringify(moduleUrl)});return m.${name}(${argument === undefined ? '' : JSON.stringify(argument)});})()`);
  const seed = await invoke('seedStorageStartupChecks');
  if (seed.some(value => !value)) throw Error('Healthy storage did not persist startup fixtures');
  checks.push('healthy native storage persists all three existing artifact formats');
  const { identifier } = await call('Page.addScriptToEvaluateOnNewDocument', { source: `Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Injected storage getter denial', 'SecurityError'); } });` });
  try {
    await call('Page.reload');
    await wait('!!document.querySelector(".shim-live-state")');
    await wait('document.querySelector(".load-ini")?.dataset.loadState === "issue" && document.querySelector(".settings-persistence-status")?.textContent.includes("Reusable workspace not restored")');
    if (!await evaluate('document.querySelector(".settings-persistence-status")?.textContent.includes("Injected storage getter denial")')) throw Error('Storage getter failure was hidden from existing feedback');
    checks.push('throwing storage getter permits complete bootstrap and existing restore-error feedback');
    for (const [mode, selector] of [['analyzer', '.analyzer-page'], ['histogram', '.histogram-page'], ['logger', '.logger-page']]) {
      await evaluate(`document.querySelector('[data-epicscope-mode="${mode}"]').click()`);
      await wait(`document.querySelector(${JSON.stringify(selector)}).hidden === false`);
    }
    checks.push('Logger/Analyzer/Histogram navigation remains usable with storage denied');
    await file('input[accept=".ini,text/plain"]', fixture('navigation.ini'));
    await wait('document.querySelector(".load-ini")?.dataset.loadState === "success"');
    if (!await evaluate('document.querySelector(".settings-ini-status").textContent.includes("loaded this session")')) throw Error('Denied persistence discarded accepted in-memory INI catalog');
    checks.push('INI import remains usable in memory when its storage save is denied');
  } finally {
    await call('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  }
  await call('Page.reload');
  await wait('!!document.querySelector(".shim-live-state") && document.querySelector(".load-ini")?.dataset.loadState === "restored"');
  await wait('document.querySelector(".settings-persistence-status")?.textContent.includes("Reusable workspace structure restored locally")');
  if (!await evaluate('document.querySelector(".setting-playback-speed").value === "2" && document.querySelector(".settings-ini-status").textContent.includes("storage-check.ini")')) throw Error('Healthy reload did not restore seeded settings/INI source');
  checks.push('healthy reload restores original workspace and INI after getter access returns');
  await invoke('verifyStorageStartupRecovery', seed);
  checks.push('denied startup preserved durable data; recovered adapters load/save/remove normally');
  await call('Page.reload');
  await wait('!!document.querySelector(".shim-live-state") && document.querySelector(".settings-persistence-status")?.textContent.includes("first change")');
  checks.push('healthy empty-storage startup remains usable after removing test artifacts');
  return { passed: checks.length, checks };
}
