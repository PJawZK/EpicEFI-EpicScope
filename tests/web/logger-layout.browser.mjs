// Layout/renderer contract exercised in the real Logger shell, with its existing resize owner.
const settle=async()=>{await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));await new Promise(resolve=>setTimeout(resolve,30));};
const assert=(value,message)=>{if(!value)throw Error(message);};
export async function runLoggerLayoutChecks(){
 const root=document.querySelector('.logger-page'),host=root?.querySelector('.graph-workspace'),layout=document.querySelector('.graph-layout-select'),arrange=document.querySelector('.graph-arrange-select');
 assert(root&&!root.hidden&&host&&layout&&arrange,'Active Logger required');const previous={layout:layout.value,arrange:arrange.value,height:host.style.height};const checks=[];
 const change=async(select,value)=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));await settle();};
 const panes=()=>[...host.querySelectorAll('.graph-window')].filter(p=>!p.hidden&&!p.classList.contains('graph-window--minimized'));
 const fits=label=>{for(const pane of panes()){
  const viewport=pane.querySelector('.graph-viewport').getBoundingClientRect(),canvas=pane.querySelector('canvas'),rect=canvas.getBoundingClientRect(),window=pane.getBoundingClientRect();
  assert(rect.height>0&&rect.top>=viewport.top-.5&&rect.bottom<=viewport.bottom+.5&&rect.bottom<=window.bottom+.5,`${label}: graph canvas clipped below its pane (${rect.height} > ${viewport.height})`);
  const dpr=Math.max(1,devicePixelRatio||1);assert(canvas.height===Math.max(1,Math.round(Math.round(rect.height)*dpr))&&canvas.width===Math.max(1,Math.round(Math.round(rect.width)*dpr)),`${label}: backing bitmap no longer matches available canvas/DPR`);
 }};
 try{
  await change(layout,'freeform');await change(arrange,'rows');assert(panes().length===5,'Rows did not show five panes');fits('horizontal rows');checks.push('all five horizontal row canvases and backing bitmaps fit their allocated panes');
  host.style.height='320px';await settle();fits('short rows');const rows=panes().map(p=>p.getBoundingClientRect()),extent=host.getBoundingClientRect();for(let i=1;i<rows.length;i++)assert(rows[i].top>=rows[i-1].bottom-.5,'CSS minimum overrides row geometry and overlaps panes');assert(rows.at(-1).bottom<=extent.bottom+.5,'Last row clipped by workspace');checks.push('short workspace preserves all five nonoverlapping rows without cutting off the final pane');
  const first=panes()[0];first.querySelector('.graph-pane-minimize').click();await settle();assert(first.classList.contains('graph-window--minimized')&&getComputedStyle(first.querySelector('.graph-viewport')).display==='none','Minimize regression');first.querySelector('.graph-pane-minimize').click();await settle();fits('restored rows');first.querySelector('.graph-pane-maximize').click();await settle();assert(panes().length===1,'Maximize did not hide other panes');fits('maximized');first.querySelector('.graph-pane-maximize').click();await settle();fits('restored after maximize');checks.push('minimize/maximize and restoration retain correct canvas ownership');
  for(const value of ['mosaic','columns','cascade']){await change(arrange,value);fits(value);}checks.push('other freeform arrangements render within their existing viewport geometry');
  host.style.height=previous.height;for(const value of ['single','grid4','grid5','grid6']){await change(layout,value);fits(value);}checks.push('single and grid layouts retain correctly sized graph bitmaps');
 }finally{host.style.height=previous.height;await change(layout,'freeform');if(previous.arrange!=='custom')await change(arrange,previous.arrange);await change(layout,previous.layout);}
 return {passed:checks.length,checks};
}
