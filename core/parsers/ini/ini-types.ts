export type IniOutputChannelKind = 'scalar' | 'bits' | 'expression';

export interface IniOutputChannelDefinition {
  readonly key: string;
  readonly kind: IniOutputChannelKind;
  readonly lineNumber: number;
  readonly rawDefinition: string;
  readonly dataType?: string;
  readonly byteOffset?: number;
  readonly unit?: string;
  readonly scale?: number;
  readonly translate?: number;
  readonly bitRange?: string;
  readonly expression?: string;
}

export interface IniDatalogEntry {
  readonly channelKey: string;
  readonly label: string;
  readonly valueType: string;
  readonly format: string;
  readonly precision?: number;
  readonly lineNumber: number;
}

export interface IniParserDiagnostic {
  readonly code: string;
  readonly severity: 'info' | 'warning' | 'error';
  readonly message: string;
  readonly lineNumber?: number;
}

export interface IniChannelParseResult {
  readonly outputChannels: readonly IniOutputChannelDefinition[];
  readonly datalogEntries: readonly IniDatalogEntry[];
  readonly diagnostics: readonly IniParserDiagnostic[];
}

export interface IniChannelParseOptions {
  readonly maxTextLength?: number;
  readonly maxLines?: number;
  readonly maxEntriesPerSection?: number;
  readonly maxLineLength?: number;
}
