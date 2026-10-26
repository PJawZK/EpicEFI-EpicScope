import fs from 'node:fs/promises';

/** Pixel evidence from real Chromium screenshots, not computed styles alone. */
export async function runVeHeatmapPaint({ call, evaluate, moduleBase, downloadDir }) {
  const original = await evaluate('({width:innerWidth,height:innerHeight,deviceScaleFactor:devicePixelRatio,mobile:false})');
  const invoke = fn => evaluate(`(async()=>{const m=await import('${moduleBase}ve-visual-presentation.browser.mjs');return m.${fn}();})()`,30000);
  const observed = [], checks = [];
  try {
    for (const scale of [1,1.25,1.5,2]) {
      await call('Emulation.setDeviceMetricsOverride',{width:1024,height:1000,deviceScaleFactor:scale,mobile:false});
      try {
        const rects = (await invoke('prepareVeHeatmapCapture')).filter(r=>r.width>0&&r.height>0);
        if(rects.length!==256) throw Error('Uniform heatmap fixture does not expose 256 cells');
        const {data}=await call('Page.captureScreenshot',{format:'png'});
        if(downloadDir) await fs.writeFile(`${downloadDir}/ve-heatmap-${scale}.png`,Buffer.from(data,'base64'));
        const result=await evaluate(`(async()=>{
          const image=new Image();image.src='data:image/png;base64,'+${JSON.stringify(data)};await image.decode();
          const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
          const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
          const rects=${JSON.stringify(rects)},scale=${scale},maxX=Math.max(...rects.map(r=>r.x+r.width)),maxY=Math.max(...rects.map(r=>r.y+r.height));
          let edges=0,darkEdges=0;
          for(const r of rects)for(const vertical of [false,true]){
            if(vertical?r.x+r.width>=maxX-.1:r.y+r.height>=maxY-.1)continue;
            const x=(vertical?r.x+r.width:r.x+r.width*.25)*scale,y=(vertical?r.y+r.height*.25:r.y+r.height)*scale;
            const points=[-1,0,1].map(d=>[Math.round(x+(vertical?d:0)),Math.round(y+(vertical?0:d))]);
            if(points.some(([x,y])=>x<0||y<0||x>=canvas.width||y>=canvas.height))continue;
            edges++;if(points.some(([x,y])=>{const i=(y*canvas.width+x)*4;return Math.max(pixels[i],pixels[i+1],pixels[i+2])<60;}))darkEdges++;
          }
          return{edges,darkEdges};
        })()`,30000);
        if(result.edges!==480||result.darkEdges!==0)throw Error(`Heatmap seams at DPR ${scale}: ${JSON.stringify(result)}`);
        observed.push({scale,...result});checks.push(`Uniform heatmap has no dark backing seams at DPR ${scale}`);
      } finally { await invoke('disposeVeHeatmapCapture'); }
    }
    return {passed:checks.length,checks,observed};
  } finally { await call('Emulation.setDeviceMetricsOverride',original); }
}
