import type { ChannelDefinition } from '../../../../core/log-model/log-types';

let histogramChannelCatalog: readonly ChannelDefinition[] = [];
let histogramChannelDecorationQueued = false;
let histogramChannelObserver: MutationObserver | undefined;

export function histogramChannelOptionLabel(channel: ChannelDefinition): string {
  const name = channel.sourceName;
  const unit = channel.unit?.trim();
  return unit ? `${name} [${unit}]` : name;
}

export function decorateHistogramChannelOptions(root: ParentNode, channels: readonly ChannelDefinition[]): void {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));
  for (const option of root.querySelectorAll<HTMLOptionElement>('select option')) {
    const channel = byId.get(option.value);
    if (!channel) continue;
    const expected = histogramChannelOptionLabel(channel);
    if (option.textContent !== expected) option.textContent = expected;
  }
}

function queueHistogramChannelDecoration(): void {
  if (histogramChannelDecorationQueued || typeof document === 'undefined') return;
  histogramChannelDecorationQueued = true;
  queueMicrotask(() => {
    histogramChannelDecorationQueued = false;
    for (const root of document.querySelectorAll<HTMLElement>('.histogram-page')) {
      decorateHistogramChannelOptions(root, histogramChannelCatalog);
    }
  });
}

export function registerHistogramChannelCatalog(channels: readonly ChannelDefinition[]): void {
  histogramChannelCatalog = channels;
  if (typeof document === 'undefined') return;
  if (!histogramChannelObserver && typeof MutationObserver !== 'undefined') {
    histogramChannelObserver = new MutationObserver(() => { queueHistogramChannelDecoration(); });
    histogramChannelObserver.observe(document.documentElement, { childList: true, subtree: true });
  }
  queueHistogramChannelDecoration();
}
