// Native keyboard validation through the existing CDP transport, without app hooks.
export async function runNativeCompletionFocus({ call, evaluate, moduleBase }) {
  const invoke = (fn, args = '') => evaluate(`(async()=>{const m=await import('${moduleBase}ve-completion-focus.browser.mjs');return m.${fn}(${args});})()`, 30000);
  const press = async (key, shift = false) => {
    const params = { key, code: key, windowsVirtualKeyCode: key === 'Tab' ? 9 : 27, modifiers: shift ? 8 : 0 };
    await call('Input.dispatchKeyEvent', { ...params, type: 'keyDown' });
    await call('Input.dispatchKeyEvent', { ...params, type: 'keyUp' });
  };
  try {
    if (!await invoke('prepareVeCompletionFocusCheck')) throw Error('Summary did not receive initial focus');
    for (let i = 0; i < 4; i++) { await press('Tab'); await invoke('checkVeCompletionNativeFocus', '"inside"'); }
    for (let i = 0; i < 4; i++) { await press('Tab', true); await invoke('checkVeCompletionNativeFocus', '"inside"'); }
    await press('Escape'); await invoke('checkVeCompletionNativeFocus', '"closed"');
    return { passed: 3, checks: ['Native forward Tab stays in completion actions', 'Native reverse Tab stays in completion actions', 'Native Escape closes summary and restores Run focus'] };
  } finally { await invoke('disposeVeCompletionFocusCheck'); }
}
