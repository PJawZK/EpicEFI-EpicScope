import type { ChannelDefinition } from '../../../../core/log-model/log-types';

export const SHIM_CHANNEL_CATALOG_EVENT = 'epicscope:shim-channel-catalog';

export interface ShimChannelCatalogEventDetail {
  readonly mode: 'available' | 'clear';
  readonly channels: readonly ChannelDefinition[];
  readonly sourceName: string;
}

/** Publishes the temporary ts_shim schema catalog without changing the active Logger data source. */
export function dispatchShimChannelCatalog(
  root: HTMLElement,
  detail: ShimChannelCatalogEventDetail,
): void {
  root.dispatchEvent(new CustomEvent<ShimChannelCatalogEventDetail>(SHIM_CHANNEL_CATALOG_EVENT, {
    bubbles: true,
    detail,
  }));
}
