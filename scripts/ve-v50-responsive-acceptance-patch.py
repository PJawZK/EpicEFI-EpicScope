from pathlib import Path
path = Path('scripts/browser/acceptance.mjs')
text = path.read_text()
anchor = """ const sharedDelayEdits=await evaluate(`(async()=>{const m=await import('${moduleBase}ve-shared-table-interaction.browser.mjs');return m.runVeSharedTableInteractionChecks();})()`,60000);
 log('shared delay interaction checks',{result:sharedDelayEdits});await record('shared-delay-interaction-result.json',sharedDelayEdits);

 await record('result-view.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-analyzer-result-view.browser.mjs');return m.runVeAnalyzerResultViewChecks();})()`,60000));
"""
replacement = """ const sharedDelayEdits=await evaluate(`(async()=>{const m=await import('${moduleBase}ve-shared-table-interaction.browser.mjs');return m.runVeSharedTableInteractionChecks();})()`,60000);
 log('shared delay interaction checks',{result:sharedDelayEdits});await record('shared-delay-interaction-result.json',sharedDelayEdits);

 for (const width of [1024,1366,1920]) {
   await call('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
   const responsive = await evaluate(`(async()=>{const m=await import('${moduleBase}ve-v50-responsive.browser.mjs');return m.runVeV50ResponsiveChecks(${width});})()`,60000);
   await record(`ve-v50-responsive-${width}.json`, responsive);
   await fs.mkdir(downloadDir, { recursive: true });
   const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
   await fs.writeFile(`${downloadDir}/ve-v50-${width}.png`, Buffer.from(screenshot.data, 'base64'));
 }
 await call('Emulation.setDeviceMetricsOverride', { width: 1366, height: 900, deviceScaleFactor: 1, mobile: false });

 await record('result-view.json', await evaluate(`(async()=>{const m=await import('${moduleBase}ve-analyzer-result-view.browser.mjs');return m.runVeAnalyzerResultViewChecks();})()`,60000));
"""
if anchor not in text:
    raise SystemExit('shared interaction acceptance anchor missing')
path.write_text(text.replace(anchor, replacement, 1))
