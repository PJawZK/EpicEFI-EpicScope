from pathlib import Path
p = Path('tests/web/owner-evidence.browser.mjs')
s = p.read_text()
old = """async function wait(check,message){const end=performance.now()+10000;while(!check()){if(performance.now()>end)throw Error(message);await pause(10);}}\nexport async function runOwnerEvidenceChecks(){\n"""
new = """async function wait(check,message){const end=performance.now()+10000;while(!check()){if(performance.now()>end)throw Error(message);await pause(10);}}\nfunction openEvidence(root,cell){assert(cell,'Missing measured VE cell');cell.setPointerCapture=()=>{};cell.dispatchEvent(new PointerEvent('pointerdown',{pointerId:61,pointerType:'mouse',bubbles:true,cancelable:true}));cell.dispatchEvent(new PointerEvent('pointerup',{pointerId:61,pointerType:'mouse',bubbles:true,cancelable:true}));const tool=[...root.querySelectorAll('.ve-proposal-shared-toolbar button')].find(candidate=>candidate.title==='Cell Evidence');assert(tool,'Cell Evidence tool missing');tool.click();}\nexport async function runOwnerEvidenceChecks(){\n"""
if old not in s: raise SystemExit('helper insertion point missing')
s = s.replace(old, new, 1)
old = "assert(cell,'Missing measured evidence cell');cell.click();await pause(0);cell.click();await pause(0);"
new = "assert(cell,'Missing measured evidence cell');openEvidence(root,cell);await pause(0);openEvidence(root,cell);await pause(0);"
if old not in s: raise SystemExit('double popup open pattern missing')
s = s.replace(old, new, 1)
old = "cell.click();await pause(0);assert(fixture.reads()===reads,'Result View reopened popup with extra reads');"
new = "openEvidence(root,cell);await pause(0);assert(fixture.reads()===reads,'Result View reopened popup with extra reads');"
if old not in s: raise SystemExit('result-view popup open pattern missing')
s = s.replace(old, new, 1)
p.write_text(s)
