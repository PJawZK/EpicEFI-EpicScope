import type { AcceptedMsqDocument, MsqWritableStream } from './msq-document-loader';
import { resolveVeMsqStoragePolicy, type IniMsqWriteCatalog } from '../../../../core/parsers/ini/ini-msq-write-policy';
import type { VeMsqWriteSnapshot } from '../../../../core/tune/ve-msq-write';
import type { PreparedMsqBytes } from './msq-write-preparation';
import type { MsqSaveState } from '../msq-save-contract';
export interface MsqSaveOptions {
  readonly capture: () => VeMsqWriteSnapshot | undefined;
  readonly current: (snapshot: VeMsqWriteSnapshot) => boolean;
  readonly canPrepare: () => boolean;
  readonly pickerUnavailable?: () => string | undefined;
  readonly prepare: (document: AcceptedMsqDocument, snapshot: VeMsqWriteSnapshot, catalog: IniMsqWriteCatalog, signal: AbortSignal, baseBytes: Uint8Array) => Promise<PreparedMsqBytes>;
  readonly notify: (state: MsqSaveState) => void;
}
const equal = (a: Uint8Array,b: Uint8Array): boolean => a.length === b.length && a.every((v,i)=>v===b[i]);
export function createMsqSaveSession(options: MsqSaveOptions) {
  let document: AcceptedMsqDocument | undefined, catalog: IniMsqWriteCatalog | undefined, expected = new Uint8Array();
  let busy = false, loading = false, disposed = false, conflict = false, uncertain = false;
  let outcome: MsqSaveState['outcome'] = 'idle', message = '', checking: Promise<void> | undefined;
  let saved: VeMsqWriteSnapshot | undefined, active: VeMsqWriteSnapshot | undefined, controller: AbortController | undefined;
  const unavailable = (): string => {
    if (disposed) return 'MSQ session closed.';
    if (busy) return '';
    if (conflict || uncertain) return message || 'Reload MSQ before another save.';
    if (loading) return 'Wait for the MSQ load to finish.';
    if (!document) return 'Load an MSQ before saving.';
    if (!document.handle?.requestPermission || !document.handle.createWritable) return options.pickerUnavailable?.() || 'Enable saving to this MSQ to verify file access without resetting analysis or working edits.';
    if (!options.canPrepare()) return 'MSQ saving requires browser Worker support.';
    if (!catalog) return 'Reload the matching INI this session to enable MSQ saving.';
    if (catalog.issue || !catalog.signatures.length || catalog.signatures.some(s=>s!==document!.model.identity.signature)) return 'Load an INI matching the MSQ firmware before saving.';
    return '';
  };
  const publish = (): void => {
    if (disposed) return;
    const reason = unavailable();
    options.notify({available:!busy&&!reason,busy,enableAccess:!!document&&(!document.handle?.requestPermission||!document.handle.createWritable)&&!!options.pickerUnavailable&&!options.pickerUnavailable()&&!conflict&&!uncertain,accessPending:loading,outcome:conflict?'conflict':uncertain?'uncertain':outcome,message:outcome==='issue'&&message&&!busy&&!loading&&!conflict&&!uncertain?message:reason||message,reload:conflict||uncertain});
  };
  const read = async (d: AcceptedMsqDocument): Promise<Uint8Array> => new Uint8Array(await (await d.handle!.getFile()).arrayBuffer());
  const mismatch = (actual: Uint8Array): void => {
    if (equal(actual,expected)) return;
    conflict = true; message = 'MSQ changed outside EpicScope. Reload it before saving; current VE edits are retained.';
    throw new Error(message);
  };
  const api = {
    get busy(): boolean { return busy; },
    get document(): AcceptedMsqDocument | undefined { return document; },
    setLoading(next: boolean) { loading=next; publish(); },
    reportAccessIssue(detail: string) { if(disposed)return;outcome='issue';message=detail;publish(); },
    setDocument(next: AcceptedMsqDocument) {
      if (busy) throw new Error('Cannot replace MSQ during a save.');
      document=next;expected=next.bytes.slice();saved=undefined;conflict=false;uncertain=false;outcome='idle';message='';publish();
    },
    setCatalog(next: IniMsqWriteCatalog | undefined) {
      if (busy) throw new Error('Cannot replace INI write metadata during a save.');
      catalog=next;if(!conflict&&!uncertain){outcome='idle';message='';}publish();
    },
    reviewChanged() {
      if (busy && active && !options.current(active)) controller?.abort();
      if (saved && !options.current(saved)) { saved=undefined;outcome='idle';message='Working VE changed since the last save.';publish(); }
    },
    checkExternal(): Promise<void> {
      if (disposed || busy || !document?.handle || conflict || uncertain) return Promise.resolve();
      if (checking) return checking;
      const d=document;
      const job=(async()=>{
        try { const bytes=await read(d);if (!disposed&&!busy&&document===d) { mismatch(bytes); } }
        catch(error) { if (!disposed&&!busy&&document===d) { outcome='issue';if(!conflict)message=`Could not check MSQ: ${error instanceof Error?error.message:String(error)} Reload it before saving if access has changed.`;publish(); } }
      })();
      checking=job;void job.finally(()=>{if(checking===job)checking=undefined;});return job;
    },
    async save(): Promise<void> {
      if (disposed || busy) return;
      const reason=unavailable(); if(reason){message=reason;outcome='issue';publish();return;}
      const d=document!, c=catalog!, snapshot=options.capture();
      if (!snapshot || snapshot.tuneModel!==d.model) { outcome='issue';message='Select a valid Working VE table and finish analysis before saving.';publish();return; }
      try {
        const policy=resolveVeMsqStoragePolicy(c,snapshot.tuneModel,snapshot.entry);
        if(snapshot.values.some(v=>v===undefined||!Number.isFinite(v)||v<0||v<policy.minimum||v>policy.maximum)) throw new Error('Fill blank VE cells and keep every value within the matching INI limits before saving.');
      } catch(error) { outcome='issue';message=error instanceof Error?error.message:String(error);publish();return; }
      busy=true;active=snapshot;controller=new AbortController();outcome='saving';message='Requesting MSQ write access…';publish();
      const signal=controller.signal;
      const guard=():void=>{if(disposed||signal.aborted||document!==d||catalog!==c||loading||!options.current(snapshot))throw new Error('MSQ save cancelled: the working session changed. Review the current VE table and retry.');};
      let stream: MsqWritableStream | undefined, closing=false, closed=false;
      try {
        // No awaits before this request: retain the Save click's user activation.
        const permission=d.handle!.requestPermission!({mode:'readwrite'});
        if(await permission!=='granted')throw new Error('MSQ write permission was not granted. Working edits are retained; press Save MSQ to retry.');
        guard();mismatch(await read(d));guard();
        message='Preparing and validating VE values…';publish();
        const plan=await options.prepare(d,snapshot,c,signal,expected);guard();
        if(!(plan.bytes instanceof Uint8Array)||!plan.bytes.length||!Number.isSafeInteger(plan.changedCells)||!Number.isSafeInteger(plan.roundedCells))throw new Error('Invalid MSQ preparation response.');
        mismatch(await read(d));guard();
        if(equal(plan.bytes,expected)){saved=snapshot;outcome='saved';message='MSQ already matches the current Working VE.';return;}
        message='Writing VE table to MSQ…';publish();
        stream=await d.handle!.createWritable!({keepExistingData:false,mode:'exclusive'});guard();
        await stream.write(plan.bytes);guard();
        mismatch(await read(d));guard();
        closing=true;await stream.close();closed=true;stream=undefined;
        const actual=await read(d);
        if(!equal(actual,plan.bytes))throw new Error('MSQ readback did not match the prepared values.');
        if(!disposed)expected=plan.bytes.slice();
        saved=!disposed&&options.current(snapshot)?snapshot:undefined;
        outcome=saved?'saved':'issue';
        message=`Saved VE table to ${d.name}.${plan.roundedCells?` ${plan.roundedCells} cells rounded to INI storage precision.`:''}${saved?'':' Newer working/session changes are not marked saved.'}`;
      } catch(error) {
        if(closing||closed){uncertain=true;message='MSQ write completion could not be verified. Reload the file before another save; current working edits are retained.';}
        else if(!conflict){outcome='issue';message=error instanceof Error?error.message:String(error);}
        if(stream&&!closing)try{await stream.abort();}catch{uncertain=true;message='MSQ staging could not be aborted. Reload before another save.';}
      } finally {busy=false;active=undefined;controller=undefined;publish();}
    },
    dispose(){disposed=true;controller?.abort();saved=undefined;document=undefined;catalog=undefined;expected=new Uint8Array();},
  };
  return api;
}
