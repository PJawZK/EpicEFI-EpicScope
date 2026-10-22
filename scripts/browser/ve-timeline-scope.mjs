export async function runNativeTimelineScope({ call, evaluate, moduleBase }) {
  const invoke = (fn, args = '') => evaluate(`(async()=>{const m=await import('${moduleBase}ve-timeline-scope.browser.mjs');return m.${fn}(${args});})()`,30000);
  const press = async (key, code, windowsVirtualKeyCode) => {
    for (const type of ['keyDown', 'keyUp']) await call('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode, ...(key === 'Enter' && type === 'keyDown' ? { text: '\r', unmodifiedText: '\r' } : {}) });
  };
  try {
    await invoke('prepareVeTimelineNativeCheck');
    await press(' ', 'Space', 32); await invoke('checkVeTimelineNativeCheck', '"ab",1');
    await press('Enter', 'Enter', 13); await invoke('checkVeTimelineNativeCheck', '"saved:0",2');
    return { passed: 2, checks: ['Native Space selects Logger A/B once without calculation', 'Native Enter selects a saved Logger range once without calculation'] };
  } finally { await invoke('disposeVeTimelineNativeCheck'); }
}
