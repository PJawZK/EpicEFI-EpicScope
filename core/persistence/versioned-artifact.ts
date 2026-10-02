export class PersistenceFormatError extends Error {
  readonly code: 'invalid-json' | 'invalid-envelope' | 'unsupported-version' | 'invalid-payload';

  constructor(
    code: PersistenceFormatError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'PersistenceFormatError';
    this.code = code;
  }
}

export interface VersionedArtifactEnvelope<T> {
  readonly schema: string;
  readonly version: number;
  readonly savedAt: string;
  readonly payload: T;
}

export function serializeVersionedArtifact<T>(
  schema: string,
  version: number,
  payload: T,
): string {
  return JSON.stringify({
    schema,
    version,
    savedAt: new Date().toISOString(),
    payload,
  } satisfies VersionedArtifactEnvelope<T>);
}

export function parseVersionedArtifact<T>(
  serialized: string,
  options: {
    readonly schema: string;
    readonly version: number;
    readonly validatePayload: (payload: unknown) => payload is T;
    readonly maxSerializedLength?: number;
  },
): VersionedArtifactEnvelope<T> {
  const maxSerializedLength = options.maxSerializedLength ?? 2_000_000;
  if (serialized.length > maxSerializedLength) {
    throw new PersistenceFormatError(
      'invalid-envelope',
      `Persisted artifact exceeds the ${maxSerializedLength.toLocaleString()} character limit.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new PersistenceFormatError('invalid-json', 'Persisted artifact is not valid JSON.');
  }

  if (
    !parsed
    || typeof parsed !== 'object'
    || Array.isArray(parsed)
  ) {
    throw new PersistenceFormatError('invalid-envelope', 'Persisted artifact envelope is invalid.');
  }

  const envelope = parsed as Partial<VersionedArtifactEnvelope<unknown>>;
  if (
    envelope.schema !== options.schema
    || typeof envelope.version !== 'number'
    || typeof envelope.savedAt !== 'string'
    || !('payload' in envelope)
  ) {
    throw new PersistenceFormatError('invalid-envelope', 'Persisted artifact envelope is incomplete.');
  }

  if (envelope.version !== options.version) {
    throw new PersistenceFormatError(
      'unsupported-version',
      `Persisted artifact version ${envelope.version} is unsupported; expected version ${options.version}.`,
    );
  }

  if (!options.validatePayload(envelope.payload)) {
    throw new PersistenceFormatError('invalid-payload', 'Persisted artifact payload is invalid.');
  }

  return envelope as VersionedArtifactEnvelope<T>;
}
