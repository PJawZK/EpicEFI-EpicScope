from pathlib import Path

p = Path('apps/web/src/pages/ve-analyzer-v50-presentation.ts')
s = p.read_text()
old = '''  const positionSetupDisclosure = (details: HTMLDetailsElement): void => {
    if (!details.open) return;
    const body = details.querySelector<HTMLElement>('.ve-v50-setup-body');
    const summary = details.querySelector<HTMLElement>(':scope > summary');
    if (!body || !summary) return;
    body.style.left = '0px';
    details.dataset.openDirection = 'down';
    const summaryRect = summary.getBoundingClientRect();
    const groupRect = details.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const pad = 8;
    const gap = 5;
    const roomBelow = window.innerHeight - summaryRect.bottom;
    const roomAbove = summaryRect.top;
    const direction = roomBelow < bodyRect.height + gap && roomAbove > roomBelow ? 'up' : 'down';
    details.dataset.openDirection = direction;
    const desiredViewportLeft = Math.max(pad, Math.min(groupRect.left, window.innerWidth - bodyRect.width - pad));
    body.style.left = `${desiredViewportLeft - groupRect.left}px`;
  };
'''
new = '''  const positionSetupDisclosure = (details: HTMLDetailsElement): void => {
    if (!details.open) return;
    const body = details.querySelector<HTMLElement>('.ve-v50-setup-body');
    const summary = details.querySelector<HTMLElement>(':scope > summary');
    if (!body || !summary) return;
    body.style.left = '0px';
    details.dataset.openDirection = 'down';
    const summaryRect = summary.getBoundingClientRect();
    const groupRect = details.getBoundingClientRect();
    const bodyRect = body.getBoundingClientRect();
    const pad = 8;
    const gap = 5;
    const roomBelow = window.innerHeight - summaryRect.bottom;
    const roomAbove = summaryRect.top;
    const direction = roomBelow < bodyRect.height + gap && roomAbove > roomBelow ? 'up' : 'down';
    details.dataset.openDirection = direction;

    // Place from viewport geometry rather than assuming the details border box is
    // the exact absolute-position containing block. Flex/grid ancestry can shift
    // that origin by a few pixels at narrow widths. Measure the real result and
    // perform one final correction so every disclosure stays inside the viewport.
    const maximumLeft = Math.max(pad, window.innerWidth - bodyRect.width - pad);
    const desiredViewportLeft = Math.max(pad, Math.min(groupRect.left, maximumLeft));
    body.style.left = `${desiredViewportLeft - groupRect.left}px`;

    const placed = body.getBoundingClientRect();
    let correction = 0;
    if (placed.left < pad) correction += pad - placed.left;
    if (placed.right + correction > window.innerWidth - pad) {
      correction -= placed.right + correction - (window.innerWidth - pad);
    }
    if (Math.abs(correction) > 0.01) {
      const currentLeft = Number.parseFloat(body.style.left) || 0;
      body.style.left = `${currentLeft + correction}px`;
    }
  };
'''
if old not in s:
    raise SystemExit('positionSetupDisclosure block not found')
p.write_text(s.replace(old, new, 1))

p = Path('apps/web/src/styles/ve-analyzer-v50-port.css')
s = p.read_text()
old = '''.ve-v50-port .ve-v50-setup-body {
  position: absolute;
  z-index: 80;
  top: calc(100% + 5px);
  left: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(150px, 1fr));
  gap: 8px;
  width: max-content;
  min-width: 330px;
  max-width: min(720px, calc(100vw - 32px));
'''
new = '''.ve-v50-port .ve-v50-setup-body {
  position: absolute;
  z-index: 80;
  top: calc(100% + 5px);
  left: 0;
  display: grid;
  box-sizing: border-box;
  grid-template-columns: repeat(2, minmax(150px, 1fr));
  gap: 8px;
  width: max-content;
  min-width: min(330px, calc(100vw - 16px));
  max-width: min(720px, calc(100vw - 16px));
'''
if old not in s:
    raise SystemExit('setup body CSS block not found')
p.write_text(s.replace(old, new, 1))
