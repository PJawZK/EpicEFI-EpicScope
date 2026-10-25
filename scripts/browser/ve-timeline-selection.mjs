// Native shell integration complements controller-dispatched gesture cases.
export async function runNativeVeTimelineSelection({ call, evaluate, moduleBase }) {
  await evaluate(`document.querySelectorAll('.ve-analyzer-view .ve-v50-tool-surface:not([hidden]) .ve-v50-tool-surface-close').forEach(button=>button.click())`);
  await evaluate(`document.querySelector('[data-ve-timeline-scope="full"]').click()`);
  const before = await evaluate(`(async()=>{const m=await import('${moduleBase}observability-lifecycle.browser.mjs');const records=m.readApplicationObservability().records;const root=document.querySelector('.analyzer-page:not([hidden]) .ve-analyzer-view');const track=root.querySelector('[data-ve-range-track]'),handle=root.querySelector('[data-ve-range-handle="a"]'),r=track.getBoundingClientRect();return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},start:Number(handle.getAttribute('aria-valuemin')),end:Number(handle.getAttribute('aria-valuemax')),context:records.filter(r=>r.name==='analysis.context.changed').at(-1)};})()`);
  const start = { x: Math.round(before.rect.x + before.rect.width * 0.2), y: before.rect.y + before.rect.height / 2 };
  const end = { x: Math.round(before.rect.x + before.rect.width * 0.8), y: start.y };
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start });
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...start, button: 'left', buttons: 1, modifiers: 8, clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', ...end, button: 'left', buttons: 1, modifiers: 8 });
  const preview = await evaluate(`(async()=>{const m=await import('${moduleBase}observability-lifecycle.browser.mjs');return {scope:document.querySelector('.ve-analyzer-view select[data-role=scope]').value,context:m.readApplicationObservability().records.filter(r=>r.name==='analysis.context.changed').at(-1)};})()`);
  if (preview.scope !== 'full' || preview.context.sequence !== before.context.sequence) throw Error('Native range preview published analytical authority');
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...end, button: 'left', buttons: 0, modifiers: 8, clickCount: 1 });
  const expected = [start.x, end.x].map(x => before.start + (x - before.rect.x) / before.rect.width * (before.end - before.start));
  const inspect = () => evaluate(`(async()=>{const m=await import('${moduleBase}observability-lifecycle.browser.mjs');return {scope:document.querySelector('.ve-analyzer-view select[data-role=scope]').value,context:m.readApplicationObservability().records.filter(r=>r.name==='analysis.context.changed').at(-1)};})()`);
  const committed = await inspect();
  if (committed.scope !== 'ab' || Math.abs(committed.context.metadata.aTimeMs - expected[0]) > 1e-6 || Math.abs(committed.context.metadata.bTimeMs - expected[1]) > 1e-6) throw Error('Native selection did not reach Logger A/B authority');
  await evaluate(`document.querySelector('[data-epicscope-mode=logger]').click();document.querySelector('[data-epicscope-mode=analyzer]').click()`);
  const returned = await inspect();
  if (returned.scope !== 'ab' || returned.context.metadata.aTimeMs !== committed.context.metadata.aTimeMs || returned.context.metadata.bTimeMs !== committed.context.metadata.bTimeMs) throw Error('Logger round trip lost selected VE range');
  await evaluate(`document.querySelector('[data-ve-timeline-scope="full"]').click()`);
  // Later shell replacement fixtures require a completed Full Log baseline.
  // Restore it explicitly: changing scope correctly invalidated the old one.
  await evaluate(`(async()=>{const m=await import('${moduleBase}ve-completion-contract.browser.mjs');return m.runVeShellCompletionChecks();})()`,60000);
  return { passed: 2, checks: ['Native captured Shift-drag previews locally then commits real Logger A/B and selects it', 'Logger/Analyzer return retains the selected range; Full Log remains separately selectable'], observed: { expected, accepted: [committed.context.metadata.aTimeMs, committed.context.metadata.bTimeMs] } };
}
