import { prepareMsqCandidate } from './msq-candidate';
import { decodeMsqSource, type DecodedMsqSource } from './msq-document-source';
import type { TuneModel } from '../../../../core/tune/tune-model';

/** Loading retains this native handle but never requests write access or writes. */
export interface MsqFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<File>;
  requestPermission?(options: {mode:'readwrite'}): Promise<'granted'|'denied'|'prompt'>;
  createWritable?(options: {keepExistingData:false; mode:'exclusive'}): Promise<MsqWritableStream>;
}
export interface MsqWritableStream {
  write(bytes: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}
export type MsqFilePicker = (options: {
  readonly multiple: false;
  readonly types: readonly { readonly description: string; readonly accept: Readonly<Record<string, readonly string[]>> }[];
}) => Promise<readonly MsqFileHandle[]>;

export function msqFilePicker(host: { readonly isSecureContext: boolean; readonly showOpenFilePicker?: MsqFilePicker } = window): MsqFilePicker | undefined {
  return host.isSecureContext && typeof host.showOpenFilePicker === 'function' ? host.showOpenFilePicker.bind(host) : undefined;
}

export interface AcceptedMsqDocument extends DecodedMsqSource {
  readonly model: TuneModel;
  readonly name: string;
  readonly size: number;
  readonly lastModified: number;
  readonly generation: number;
  readonly handle: MsqFileHandle | undefined;
}

export interface MsqDocumentLoadCallbacks {
  readonly canAccept?: () => boolean;
  readonly loading: (name: string) => void;
  readonly accepted: (document: AcceptedMsqDocument) => void;
  readonly rejected: (name: string, error: unknown) => void;
}

/** Session-local document owner. Rejected/cancelled/stale candidates retain all authority. */
export function createMsqDocumentLoader(callbacks: MsqDocumentLoadCallbacks) {
  let document: AcceptedMsqDocument | undefined;
  let loadGeneration = 0;
  let choiceGeneration = 0;
  let pending = false, disposed = false;
  const read = async (getFile: () => File | Promise<File>, name: string, handle?: MsqFileHandle): Promise<void> => {
    if(disposed)return;
    if (callbacks.canAccept?.() === false) { callbacks.rejected(name,new Error('Finish the MSQ save before replacing its source.')); return; }
    const generation = ++loadGeneration; pending = true;
    callbacks.loading(name);
    let candidate: AcceptedMsqDocument;
    try {
      const selected = getFile();
      // File-input reads start immediately, matching the existing replacement
      // contract. Native handles await getFile before opening a byte read.
      const file = 'then' in selected ? await selected : selected;
      if (generation !== loadGeneration) return;
      const buffer = await file.arrayBuffer();
      if (generation !== loadGeneration) return;
      const source = decodeMsqSource(buffer);
      const model = prepareMsqCandidate(source.text);
      candidate = { ...source, model, name: file.name, size: file.size, lastModified: file.lastModified, generation, handle };
    } catch (error) {
      if (generation === loadGeneration) { pending = false; callbacks.rejected(name, error); }
      return;
    }
    if (generation !== loadGeneration) return;
    pending = false;
    if (callbacks.canAccept?.() === false) { callbacks.rejected(name,new Error('Finish the MSQ save before accepting a replacement.')); return; }
    document = candidate;
    // A display failure after acceptance cannot turn this into a rejected file.
    callbacks.accepted(candidate);
  };
  return {
    dispose() {disposed=true;loadGeneration++;choiceGeneration++;pending=false;document=undefined;},
    get pending(): boolean { return pending; },
    get current(): AcceptedMsqDocument | undefined { return document; },
    loadFile(file: File): Promise<void> {
      choiceGeneration++;
      return read(() => file, file.name);
    },
    async choose(picker: MsqFilePicker): Promise<void> {
      if(disposed)return;
      const choice = ++choiceGeneration;
      let handles: readonly MsqFileHandle[];
      try {
        // Invoke directly under the Load button's user activation, before any await.
        handles = await picker({ multiple: false, types: [{ description: 'TunerStudio MSQ', accept: { 'application/xml': ['.msq', '.xml'] } }] });
      } catch (error) {
        if (choice !== choiceGeneration || (error instanceof DOMException && error.name === 'AbortError')) return;
        callbacks.rejected('MSQ selection', error); return;
      }
      if (choice !== choiceGeneration || !handles[0]) return;
      const handle = handles[0];
      if (handle.kind !== 'file') { callbacks.rejected(handle.name, new Error('Choose an MSQ file.')); return; }
      await read(() => handle.getFile(), handle.name, handle);
    },
  };
}
