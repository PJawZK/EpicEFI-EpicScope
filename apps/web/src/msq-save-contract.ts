export interface MsqSaveState {
  readonly available: boolean;
  readonly busy: boolean;
  readonly outcome: 'idle' | 'saving' | 'saved' | 'issue' | 'conflict' | 'uncertain';
  readonly message: string;
  readonly reload: boolean;
}
