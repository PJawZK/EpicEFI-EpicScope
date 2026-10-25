import type { AcceptedMsqDocument } from './msq-document-loader';
import type { IniMsqWriteCatalog } from '../../../../core/parsers/ini/ini-msq-write-policy';
import type { VeMsqWriteSnapshot } from '../../../../core/tune/ve-msq-write';
export interface PreparedMsqBytes { readonly bytes: Uint8Array; readonly changedCells: number; readonly roundedCells: number }
export interface MsqWriteWorkerRequest { readonly document: AcceptedMsqDocument; readonly snapshot: VeMsqWriteSnapshot; readonly catalog: IniMsqWriteCatalog; readonly baseBytes: Uint8Array }

/** One explicitly requested preparation job. Copies input; never detaches accepted source bytes. */
export function prepareMsqInWorker(document: AcceptedMsqDocument, snapshot: VeMsqWriteSnapshot, catalog: IniMsqWriteCatalog, signal: AbortSignal, baseBytes: Uint8Array = document.bytes): Promise<PreparedMsqBytes> {
  return new Promise((resolve,reject) => {
    if (signal.aborted) { reject(new DOMException('MSQ save cancelled.','AbortError')); return; }
    let worker: Worker;
    try { worker = new Worker(new URL('../workers/msq-write.worker.ts',import.meta.url),{type:'module'}); }
    catch (error) { reject(error); return; }
    const finish = (): void => { signal.removeEventListener('abort',abort); worker.terminate(); };
    const abort = (): void => { finish(); reject(new DOMException('MSQ save cancelled because its working session changed.','AbortError')); };
    signal.addEventListener('abort',abort,{once:true});
    worker.onerror = event => { event.preventDefault(); finish(); reject(new Error(event.message || 'MSQ preparation worker failed.')); };
    worker.onmessageerror = () => { finish(); reject(new Error('MSQ preparation response could not be decoded.')); };
    worker.onmessage = (event: MessageEvent<PreparedMsqBytes | {error:string}>) => {
      finish();
      if (!event.data || typeof event.data !== 'object') {reject(new Error('Invalid MSQ worker response.'));return;}
      if ('error' in event.data) reject(new Error(event.data.error)); else resolve(event.data);
    };
    // Preserve shared model/entry references in a single structured-clone graph.
    try { worker.postMessage({ document:{...document,handle:undefined}, snapshot, catalog, baseBytes } satisfies MsqWriteWorkerRequest); }
    catch (error) { finish(); reject(error); }
  });
}
