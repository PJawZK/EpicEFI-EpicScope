import { prepareVeMsqWriteOnDiskBase } from '../adapters/msq-ve-document-writer';
import type { MsqWriteWorkerRequest, PreparedMsqBytes } from '../adapters/msq-write-preparation';
const host = self as unknown as {
  onmessage: ((event: MessageEvent<MsqWriteWorkerRequest>) => void) | null;
  postMessage(message: PreparedMsqBytes | {error:string}, transfer?: Transferable[]): void;
};
host.onmessage = event => {
  try {
    const {document,snapshot,catalog,baseBytes} = event.data;
    const plan = prepareVeMsqWriteOnDiskBase(document,snapshot,catalog,baseBytes);
    host.postMessage({bytes:plan.bytes,changedCells:plan.changedCells,roundedCells:plan.roundedCells},[plan.bytes.buffer as ArrayBuffer]);
  } catch (error) { host.postMessage({error:error instanceof Error ? error.message : String(error)}); }
};
