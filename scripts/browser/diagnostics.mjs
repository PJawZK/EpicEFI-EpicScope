import fs from 'node:fs/promises';
import path from 'node:path';
export async function runDiagnosticsAcceptance({call,evaluate,wait,moduleBase,downloadDir,record}){
 const expected=await evaluate(`(async()=>{const m=await import('${moduleBase}diagnostics.browser.mjs');return m.prepareIntegratedDiagnostics();})()`);
 await fs.rm(downloadDir,{recursive:true,force:true});await fs.mkdir(downloadDir,{recursive:true});
 const {targetInfo}=await call('Target.getTargetInfo');
 await call('Browser.setDownloadBehavior',{behavior:'allow',browserContextId:targetInfo.browserContextId,downloadPath:downloadDir});
 await evaluate(`document.querySelector('.diagnostics-export-bundle').click()`);
 await wait(`document.querySelector('.diagnostics-export-status').textContent.includes('exported')`);
 const deadline=Date.now()+15000;let file;
 while(Date.now()<deadline){const files=(await fs.readdir(downloadDir)).filter(f=>f.endsWith('.zip'));if(files.length===1){file=files[0];break;}await new Promise(r=>setTimeout(r,50));}
 if(!file)throw Error('Native diagnostic ZIP download did not complete');
 const bytes=await fs.readFile(path.join(downloadDir,file)),files=new Map();let offset=0;
 while(bytes.readUInt32LE(offset)===0x04034b50){const size=bytes.readUInt32LE(offset+18),length=bytes.readUInt16LE(offset+26),start=offset+30+length;files.set(bytes.subarray(offset+30,start).toString(),bytes.subarray(start,start+size).toString());offset=start+size;}
 const json=JSON.parse(files.get('observability.json'));
 if(files.get('report.txt')!==expected.reportText||json.sessionId!==expected.sessionId||json.records.length!==expected.records||!Array.isArray(json.parserDiagnostics)||!json.resources)throw Error('Downloaded text/structured capture identity or evidence diverged');
 await call('Page.captureScreenshot').then(async({data})=>fs.writeFile(path.join(downloadDir,'diagnostics.png'),Buffer.from(data,'base64')));
 await evaluate(`document.querySelector('.diagnostics-export-bundle').click();document.querySelector('.bug-report-close').click();`);
 await wait(`document.querySelector('.diagnostics-export-status').textContent.includes('cancelled')`);
 const cancelled=await evaluate(`document.querySelector('.bug-report-popover').hidden&&!document.querySelector('.diagnostics-export-bundle').disabled`);
 if(!cancelled||(await fs.readdir(downloadDir)).filter(f=>f.endsWith('.zip')).length!==1)throw Error('Closing Diagnostics failed to cancel pending export');
 await evaluate(`document.querySelector('.bug-report-button').click();document.querySelector('.bug-report-popover').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);
 if(!await evaluate(`document.querySelector('.bug-report-popover').hidden&&document.activeElement===document.querySelector('.bug-report-button')`))throw Error('Diagnostics Escape/focus ownership failed');
 await record('diagnostics-integrated.json',{passed:3,checks:['real Diagnostics lenses reuse one captured session without republishing context, reading traces or running VE','native ZIP download contains matching complete report and structured current/previous/Parser/resource evidence','closing Diagnostics cancels pending export without a second download; Escape closes locally and restores focus'],observed:{download:file,bytes:bytes.length,sessionId:json.sessionId,records:json.records.length}});
}
