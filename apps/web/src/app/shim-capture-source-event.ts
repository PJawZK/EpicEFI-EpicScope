import type { ShimCaptureSource } from '../adapters/shim/shim-capture-source';

export const SHIM_CAPTURE_SOURCE_EVENT = 'epicscope:shim-use-capture';

export interface ShimCaptureSourceEventDetail {
  readonly source: ShimCaptureSource;
  readonly mode: 'open' | 'refresh';
  readonly followLatest: boolean;
}

export function dispatchShimCaptureSource(
  root: HTMLElement,
  source: ShimCaptureSource,
  mode: 'open' | 'refresh' = 'open',
  followLatest = true,
): void {
  root.dispatchEvent(new CustomEvent<ShimCaptureSourceEventDetail>(SHIM_CAPTURE_SOURCE_EVENT, {
    bubbles: true,
    detail: { source, mode, followLatest },
  }));
}
