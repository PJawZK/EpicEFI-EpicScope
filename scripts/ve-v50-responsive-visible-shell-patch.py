from pathlib import Path
path = Path('scripts/browser/acceptance.mjs')
text = path.read_text()
anchor = """ const sharedDelayEdits=await evaluate(`(async()=>{const m=await import('${moduleBase}ve-shared-table-interaction.browser.mjs');return m.runVeSharedTableInteractionChecks();})()`,60000);
 log('shared delay interaction checks',{result:sharedDelayEdits});await record('shared-delay-interaction-result.json',sharedDelayEdits);

 for (const width of [1024,1366,1920]) {
"""
replacement = """ const sharedDelayEdits=await evaluate(`(async()=>{const m=await import('${moduleBase}ve-shared-table-interaction.browser.mjs');return m.runVeSharedTableInteractionChecks();})()`,60000);
 log('shared delay interaction checks',{result:sharedDelayEdits});await record('shared-delay-interaction-result.json',sharedDelayEdits);

 // Focus the real application shell before geometry assertions. Focused component
 // fixtures above intentionally create/remove their own Analyzer roots and may leave
 // the shell on another Analyzer domain.
 await evaluate(`(()=>{const mode=document.querySelector('[data-epicscope-mode=analyzer]');mode?.click();const s=document.querySelector('.analyzer-header-view-select');if(!s)throw Error('Analyzer domain selector missing before responsive acceptance');s.value='ve';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(`!!document.querySelector('.analyzer-page:not([hidden]) .ve-analyzer-view.ve-v50-port:not([hidden])')`);

 for (const width of [1024,1366,1920]) {
"""
if anchor not in text:
    raise SystemExit('responsive acceptance anchor missing')
path.write_text(text.replace(anchor, replacement, 1))
