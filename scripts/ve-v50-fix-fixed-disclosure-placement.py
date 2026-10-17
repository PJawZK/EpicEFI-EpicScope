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
new = '''  const positionSetupDisclosure = (details: HTMLDetailsElement): void => {
    if (!details.open) return;
    const body = details.querySelector<HTMLElement>('.ve-v50-setup-body');
    const summary = details.querySelector<HTMLElement>(':scope > summary');
    if (!body || !summary) return;

    // Reset prior inline placement before measuring. At narrow widths the body is
    // fixed so it can escape the horizontally scrollable setup strip; at wider
    // widths it is absolute to its details owner.
    body.style.left = '';
    body.style.right = '';
    body.style.top = '';
    body.style.bottom = '';
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

    const fixed = getComputedStyle(body).position === 'fixed';
    const maximumLeft = Math.max(pad, window.innerWidth - bodyRect.width - pad);
    const desiredViewportLeft = Math.max(pad, Math.min(summaryRect.left, maximumLeft));

    if (fixed) {
      body.style.left = `${desiredViewportLeft}px`;
      body.style.right = 'auto';
      body.style.top = `${direction === 'up'
        ? Math.max(pad, summaryRect.top - bodyRect.height - gap)
        : Math.min(window.innerHeight - bodyRect.height - pad, summaryRect.bottom + gap)}px`;
      body.style.bottom = 'auto';
      return;
    }

    // Wide-screen absolute positioning: translate the desired viewport location
    // into the local details coordinate system, then correct against the measured
    // result so flex/grid border-box differences cannot leak a few pixels outside.
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
    raise SystemExit('current disclosure position function not found')
p.write_text(s.replace(old, new, 1))

p = Path('apps/web/src/styles/ve-analyzer-v50-port.css')
s = p.read_text()
old = '''  .ve-v50-port .ve-v50-setup-body {
    position: fixed;
    top: 112px;
    left: 16px;
    right: 16px;
    width: auto;
    max-width: none;
  }
'''
new = '''  .ve-v50-port .ve-v50-setup-body {
    position: fixed;
    top: auto;
    left: auto;
    right: auto;
    bottom: auto;
    width: max-content;
    max-width: calc(100vw - 16px);
  }
'''
if old not in s:
    raise SystemExit('narrow fixed disclosure media rule not found')
p.write_text(s.replace(old, new, 1))
