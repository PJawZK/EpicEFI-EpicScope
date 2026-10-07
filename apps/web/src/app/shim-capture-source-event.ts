import type { ShimCaptureSource } from '../adapters/shim/shim-capture-source';

export const SHIM_CAPTURE_SOURCE_EVENT = 'epicscope:shim-use-capture';

export interface ShimCaptureSourceEventDetail {
  readonly source: ShimCaptureSource;
}

export function dispatchShimCaptureSource(root: HTMLElement, source: ShimCaptureSource): void {
  root.dispatchEvent(new CustomEvent<ShimCaptureSourceEventDetail>(SHIM_CAPTURE_SOURCE_EVENT, {
    bubbles: true,
    detail: { source },
  }));
}
