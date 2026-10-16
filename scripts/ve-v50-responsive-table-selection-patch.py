from pathlib import Path
path = Path('scripts/browser/acceptance.mjs')
text = path.read_text()
anchor = """ await evaluate(`(()=>{const mode=document.querySelector('[data-epicscope-mode=analyzer]');mode?.click();const s=document.querySelector('.analyzer-header-view-select');if(!s)throw Error('Analyzer domain selector missing before responsive acceptance');s.value='ve';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(`!!document.querySelector('.analyzer-page:not([hidden]) .ve-analyzer-view.ve-v50-port:not([hidden])')`);

 for (const width of [1024,1366,1920]) {
"""
replacement = """ await evaluate(`(()=>{const mode=document.querySelector('[data-epicscope-mode=analyzer]');mode?.click();const s=document.querySelector('.analyzer-header-view-select');if(!s)throw Error('Analyzer domain selector missing before responsive acceptance');s.value='ve';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(`!!document.querySelector('.analyzer-page:not([hidden]) .ve-analyzer-view.ve-v50-port:not([hidden])')`);
 // Publication/replacement fixtures above can intentionally leave the shell with
 // a new tune and no remembered VE table. Select the first real table candidate so
 // responsive acceptance measures the actual rendered work surface, not an empty
 // "No table selected" placeholder.
 await evaluate(`(()=>{const root=document.querySelector('.analyzer-page:not([hidden]) .ve-analyzer-view.ve-v50-port:not([hidden])');for(const role of ['ve-table','target-table']){const s=root?.querySelector('select[data-role="'+role+'"]');if(!s)continue;const option=[...s.options].find(o=>o.value);if(option&&s.value!==option.value){s.value=option.value;s.dispatchEvent(new Event('change',{bubbles:true}));}}})()`);
 await wait(`!!document.querySelector('.analyzer-page:not([hidden]) .ve-analyzer-view.ve-v50-port:not([hidden]) .ve-workbench-table td')`);

 for (const width of [1024,1366,1920]) {
"""
if anchor not in text:
    raise SystemExit('visible VE responsive anchor missing')
path.write_text(text.replace(anchor, replacement, 1))
