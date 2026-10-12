import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export const SHIM_CHANNEL_CATALOG_EVENT = 'epicscope:shim-channel-catalog';

export interface ShimChannelCatalogEventDetail {
  readonly mode: 'available' | 'clear';
  readonly channels: readonly ChannelDefinition[];
  readonly sourceName: string;
}

export function dispatchShimChannelCatalog(
  root: HTMLElement,
  detail: ShimChannelCatalogEventDetail,
): void {
  root.dispatchEvent(new CustomEvent<ShimChannelCatalogEventDetail>(SHIM_CHANNEL_CATALOG_EVENT, {
    bubbles: true,
    detail,
  }));
}
