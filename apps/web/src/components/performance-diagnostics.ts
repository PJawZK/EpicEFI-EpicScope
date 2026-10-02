export interface LoadPerformanceRun {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly recordCount: number;
  readonly channelCount: number;
  readonly importTotalMs: number;
  readonly headerMs: number;
  readonly headerReadMs: number;
  readonly headerCpuMs: number;
  readonly recordScanMs: number;
  readonly recordReadMs: number;
  readonly recordCpuMs: number;
  readonly checksumBytes: number;
  readonly checksumCpuMs: number;
  readonly diagnosticCpuMs: number;
  readonly indexCpuMs: number;
  readonly finalizeMs: number;
  readonly uiPopulateMs: number;
  readonly sourceReadCount: number;
  readonly sourceBytesRead: number;
  readonly physicalReadCount: number;
  readonly physicalBytesRead: number;
  readonly cacheHitBytes: number;
  readonly cacheBytes: number;
  readonly cachePageCount: number;
}

export interface ChannelPerformanceRun {
  readonly channelName: string;
  readonly totalMs: number;
  readonly readDecodeMs: number;
  readonly scaleMs: number;
  readonly renderMs: number;
  readonly sampleCount: number;
}

export interface PerformanceDiagnosticsController {
  readonly element: HTMLElement;
  recordLoad(run: LoadPerformanceRun): void;
  recordChannel(run: ChannelPerformanceRun): void;
  clear(): void;
}

function ms(value: number): string {
  return `${value.toFixed(2)} ms`;
}

function bytes(value: number): string {
  if (value >= 1024 * 1024 * 1024) return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(2)} KiB`;
  return `${value} B`;
}

export function createPerformanceDiagnostics(): PerformanceDiagnosticsController {
  const loadRuns: LoadPerformanceRun[] = [];
  const channelRuns: ChannelPerformanceRun[] = [];

  const root = document.createElement('div');
  root.className = 'performance-diagnostics-wrap';
  root.innerHTML = `
    <button type="button" class="performance-diagnostics-button" aria-haspopup="dialog" aria-expanded="false" title="Performance diagnostics">
      <span aria-hidden="true">⏱</span>
      <span>Perf</span>
    </button>
    <div class="performance-diagnostics-popover" role="dialog" aria-label="Performance diagnostics" hidden>
      <div class="performance-diagnostics-head">
        <div>
          <strong>Performance diagnostics</strong>
          <small>Current browser session</small>
        </div>
        <div class="performance-diagnostics-actions">
          <button type="button" class="performance-copy" disabled>Copy report</button>
          <button type="button" class="performance-clear" disabled>Clear</button>
          <button type="button" class="performance-close" aria-label="Close performance diagnostics">×</button>
        </div>
      </div>
      <div class="performance-empty">Open a log or select a channel to capture timings.</div>
      <div class="performance-content" hidden>
        <section>
          <strong>Latest log load</strong>
          <div class="performance-load"></div>
        </section>
        <section>
          <strong>Recent channel selections</strong>
          <div class="performance-channels"></div>
        </section>
      </div>
    </div>
  `;

  const button = root.querySelector<HTMLButtonElement>('.performance-diagnostics-button');
  const popover = root.querySelector<HTMLElement>('.performance-diagnostics-popover');
  const copyButton = root.querySelector<HTMLButtonElement>('.performance-copy');
  const clearButton = root.querySelector<HTMLButtonElement>('.performance-clear');
  const closeButton = root.querySelector<HTMLButtonElement>('.performance-close');
  const empty = root.querySelector<HTMLElement>('.performance-empty');
  const content = root.querySelector<HTMLElement>('.performance-content');
  const loadHost = root.querySelector<HTMLElement>('.performance-load');
  const channelsHost = root.querySelector<HTMLElement>('.performance-channels');

  if (!button || !popover || !copyButton || !clearButton || !closeButton || !empty || !content || !loadHost || !channelsHost) {
    throw new Error('Performance diagnostics structure is incomplete.');
  }

  const close = (): void => {
    popover.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  };

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    const open = popover.hidden === true;
    popover.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  });
  popover.addEventListener('click', (event) => event.stopPropagation());
  closeButton.addEventListener('click', close);
  document.addEventListener('click', close);

  const reportText = (): string => {
    const lines: string[] = ['EpicScope performance diagnostics'];
    const latestLoad = loadRuns[loadRuns.length - 1];
    if (latestLoad) {
      lines.push(
        '',
        '[Load]',
        `file=${latestLoad.fileName}`,
        `size=${latestLoad.fileSizeBytes} bytes`,
        `records=${latestLoad.recordCount}`,
        `channels=${latestLoad.channelCount}`,
        `total=${latestLoad.importTotalMs.toFixed(2)} ms`,
        `header=${latestLoad.headerMs.toFixed(2)} ms`,
        `headerRead=${latestLoad.headerReadMs.toFixed(2)} ms`,
        `headerCpu=${latestLoad.headerCpuMs.toFixed(2)} ms`,
        `recordScan=${latestLoad.recordScanMs.toFixed(2)} ms`,
        `recordRead=${latestLoad.recordReadMs.toFixed(2)} ms`,
        `recordCpu=${latestLoad.recordCpuMs.toFixed(2)} ms`,
        `checksumBytes=${latestLoad.checksumBytes}`,
        `checksumCpu=${latestLoad.checksumCpuMs.toFixed(2)} ms`,
        `diagnosticCpu=${latestLoad.diagnosticCpuMs.toFixed(2)} ms`,
        `indexCpu=${latestLoad.indexCpuMs.toFixed(2)} ms`,
        `finalize=${latestLoad.finalizeMs.toFixed(2)} ms`,
        `uiPopulate=${latestLoad.uiPopulateMs.toFixed(2)} ms`,
        `sourceReads=${latestLoad.sourceReadCount}`,
        `sourceBytes=${latestLoad.sourceBytesRead}`,
        `physicalReads=${latestLoad.physicalReadCount}`,
        `physicalBytes=${latestLoad.physicalBytesRead}`,
        `cacheHitBytes=${latestLoad.cacheHitBytes}`,
        `cacheBytes=${latestLoad.cacheBytes}`,
        `cachePages=${latestLoad.cachePageCount}`,
      );
    }
    if (channelRuns.length > 0) {
      lines.push('', '[Channel selections]');
      channelRuns.slice(-10).forEach((run, index) => {
        lines.push(
          `${index + 1}. ${run.channelName}: total=${run.totalMs.toFixed(2)} ms; readDecode=${run.readDecodeMs.toFixed(2)} ms; scale=${run.scaleMs.toFixed(2)} ms; render=${run.renderMs.toFixed(2)} ms; samples=${run.sampleCount}`,
        );
      });
    }
    return lines.join('\n');
  };

  const render = (): void => {
    const hasData = loadRuns.length > 0 || channelRuns.length > 0;
    empty.hidden = hasData;
    content.hidden = !hasData;
    copyButton.disabled = !hasData;
    clearButton.disabled = !hasData;

    loadHost.replaceChildren();
    const latestLoad = loadRuns[loadRuns.length - 1];
    if (latestLoad) {
      const rows: readonly [string, string][] = [
        ['File', latestLoad.fileName],
        ['Size', bytes(latestLoad.fileSizeBytes)],
        ['Total import', ms(latestLoad.importTotalMs)],
        ['Header total', ms(latestLoad.headerMs)],
        ['Header physical read', ms(latestLoad.headerReadMs)],
        ['Header CPU', ms(latestLoad.headerCpuMs)],
        ['Record scan / CRC / index', ms(latestLoad.recordScanMs)],
        ['Record source read', ms(latestLoad.recordReadMs)],
        ['Record CPU remainder', ms(latestLoad.recordCpuMs)],
        ['Checksum bytes', bytes(latestLoad.checksumBytes)],
        ['Checksum CPU (sampled)', ms(latestLoad.checksumCpuMs)],
        ['Diagnostic CPU', ms(latestLoad.diagnosticCpuMs)],
        ['Index/timestamp CPU', ms(latestLoad.indexCpuMs)],
        ['Parser finalize', ms(latestLoad.finalizeMs)],
        ['UI population', ms(latestLoad.uiPopulateMs)],
        ['Logical source reads', latestLoad.sourceReadCount.toLocaleString()],
        ['Logical source bytes', bytes(latestLoad.sourceBytesRead)],
        ['Physical Blob reads', latestLoad.physicalReadCount.toLocaleString()],
        ['Physical Blob bytes', bytes(latestLoad.physicalBytesRead)],
        ['Cache-hit bytes', bytes(latestLoad.cacheHitBytes)],
        ['Raw cache resident', `${bytes(latestLoad.cacheBytes)} · ${latestLoad.cachePageCount} pages`],
        ['Records', latestLoad.recordCount.toLocaleString()],
        ['Channels', latestLoad.channelCount.toLocaleString()],
      ];
      for (const [label, value] of rows) {
        const row = document.createElement('div');
        row.className = 'performance-row';
        const left = document.createElement('span');
        left.textContent = label;
        const right = document.createElement('strong');
        right.textContent = value;
        row.append(left, right);
        loadHost.append(row);
      }
    } else {
      loadHost.textContent = 'No load run captured.';
    }

    channelsHost.replaceChildren();
    if (channelRuns.length === 0) {
      channelsHost.textContent = 'No channel selections captured.';
    } else {
      for (const run of channelRuns.slice(-10).reverse()) {
        const card = document.createElement('div');
        card.className = 'performance-channel-card';
        const title = document.createElement('strong');
        title.textContent = run.channelName;
        const detail = document.createElement('span');
        detail.textContent = `${ms(run.totalMs)} total · ${ms(run.readDecodeMs)} read/decode · ${ms(run.scaleMs)} scale · ${ms(run.renderMs)} render`;
        card.append(title, detail);
        channelsHost.append(card);
      }
    }
  };

  copyButton.addEventListener('click', () => {
    void navigator.clipboard.writeText(reportText()).then(() => {
      const original = copyButton.textContent;
      copyButton.textContent = 'Copied';
      window.setTimeout(() => { copyButton.textContent = original; }, 1200);
    });
  });

  clearButton.addEventListener('click', () => {
    loadRuns.length = 0;
    channelRuns.length = 0;
    render();
  });

  render();

  return {
    element: root,
    recordLoad: (run) => {
      loadRuns.push(run);
      if (loadRuns.length > 20) loadRuns.shift();
      render();
    },
    recordChannel: (run) => {
      channelRuns.push(run);
      if (channelRuns.length > 50) channelRuns.shift();
      render();
    },
    clear: () => {
      loadRuns.length = 0;
      channelRuns.length = 0;
      render();
    },
  };
}
