from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

# Core binding: expose conservative workspace aliases between duplicate INI presentation identities.
path = Path('core/channels/channel-binding.ts')
text = path.read_text()
text = replace_once(text, """  readonly sourceToLogicalChannelId: ReadonlyMap<string, string>;
  readonly logicalToSourceChannelId: ReadonlyMap<string, string>;
  readonly bindings: readonly BoundChannelBinding[];
""", """  readonly sourceToLogicalChannelId: ReadonlyMap<string, string>;
  readonly logicalToSourceChannelId: ReadonlyMap<string, string>;
  readonly workspaceChannelAliases: ReadonlyMap<string, string>;
  readonly bindings: readonly BoundChannelBinding[];
""", 'binding interface alias map')

text = replace_once(text, """function chooseByUnit(
  candidates: readonly ChannelCatalogEntry[] | undefined,
  unit: string | undefined,
): ChannelCatalogEntry | undefined {
  if (!candidates || candidates.length < 2) return undefined;
  const normalizedUnit = normalized(unit);
  if (!normalizedUnit) return undefined;
  const matching = candidates.filter((candidate) => normalized(candidate.unit) === normalizedUnit);
  return matching.length === 1 ? matching[0] : undefined;
}

export function bindChannelCatalogToLog(
""", """function chooseByUnit(
  candidates: readonly ChannelCatalogEntry[] | undefined,
  unit: string | undefined,
): ChannelCatalogEntry | undefined {
  if (!candidates || candidates.length < 2) return undefined;
  const normalizedUnit = normalized(unit);
  if (!normalizedUnit) return undefined;
  const matching = candidates.filter((candidate) => normalized(candidate.unit) === normalizedUnit);
  return matching.length === 1 ? matching[0] : undefined;
}

function chooseWorkspaceAliasTarget(
  candidates: readonly ChannelCatalogEntry[] | undefined,
  source: ChannelCatalogEntry,
): ChannelCatalogEntry | undefined {
  if (!candidates) return undefined;
  const sourceUnit = normalized(source.unit);
  const compatible = candidates.filter((candidate) => {
    if (candidate.logicalKey === source.logicalKey) return false;
    if (candidate.valueType !== source.valueType) return false;
    const candidateUnit = normalized(candidate.unit);
    return !sourceUnit || !candidateUnit || sourceUnit === candidateUnit;
  });
  return compatible.length === 1 ? compatible[0] : undefined;
}

export function bindChannelCatalogToLog(
""", 'alias compatibility helper')

text = replace_once(text, """  const dataSource = new BoundNumericChannelDataSource(sourceData, logicalToSourceChannelId);

  return {
""", """  // A reusable workspace may still contain an older INI identity that remains
  // valid in the catalog but has no data in this particular log. When exactly
  // one currently bound catalog entry has the same user-facing identity and a
  // compatible value type/unit, treat the unavailable identity as a safe alias.
  const boundDisplayIndex = new Map<string, ChannelCatalogEntry[]>();
  for (const entry of catalog.entries) {
    if (boundByLogicalKey.has(entry.logicalKey)) {
      addIndex(boundDisplayIndex, normalized(entry.displayName), entry);
    }
  }

  const workspaceChannelAliases = new Map(sourceToLogicalChannelId);
  for (const entry of catalog.entries) {
    if (boundByLogicalKey.has(entry.logicalKey)) continue;
    const target = chooseWorkspaceAliasTarget(
      boundDisplayIndex.get(normalized(entry.displayName)),
      entry,
    );
    if (target) {
      workspaceChannelAliases.set(stableId(entry.logicalKey), stableId(target.logicalKey));
    }
  }

  const dataSource = new BoundNumericChannelDataSource(sourceData, logicalToSourceChannelId);

  return {
""", 'build workspace aliases')

text = replace_once(text, """    unavailableChannelIds,
    sourceToLogicalChannelId,
    logicalToSourceChannelId,
    bindings,
""", """    unavailableChannelIds,
    sourceToLogicalChannelId,
    logicalToSourceChannelId,
    workspaceChannelAliases,
    bindings,
""", 'return workspace aliases')
path.write_text(text)

# Workspace normalization: explicit safe aliases may supersede still-known stale IDs.
path = Path('apps/web/src/state/workspace-channel-identity.ts')
text = path.read_text()
text = replace_once(text, """    let candidate = channelId;
    if (!options.knownChannelIds.has(candidate)) {
      const alias = options.aliases?.get(candidate);
      if (alias) candidate = alias;
    }
""", """    let candidate = channelId;
    const alias = options.aliases?.get(candidate);
    if (
      alias
      && (options.knownChannelIds.has(alias) || !options.knownChannelIds.has(candidate))
    ) {
      candidate = alias;
    }
""", 'known-ID alias normalization')
path.write_text(text)

# App shell: pass the complete workspace alias map, not just raw MLG->INI aliases.
path = Path('apps/web/src/app/app-shell.ts')
text = path.read_text()
old = 'channelIdAliases: prepared.binding.sourceToLogicalChannelId,'
count = text.count(old)
if count != 3:
    raise SystemExit(f'app shell aliases: expected 3 matches, found {count}')
text = text.replace(old, 'channelIdAliases: prepared.binding.workspaceChannelAliases,')
path.write_text(text)

# Channel-binding regression coverage.
path = Path('tests/channels/channel-binding.test.ts')
text = path.read_text()
needle = """  it('leaves ambiguous duplicate labels as log-only when unit cannot resolve them', () => {
"""
insert = """  it('creates conservative workspace aliases from unavailable INI identities to unique bound equivalents', () => {
    const source = new FakeDataSource();
    const entries = [
      {
        logicalKey: 'rpm',
        sourceName: 'rpm',
        displayName: 'RPM',
        valueType: 'integer' as const,
        unit: 'RPM',
        availability: 'known-no-data' as const,
        provenance: { kind: 'ini' as const },
      },
      {
        logicalKey: 'RPMValue',
        sourceName: 'RPMValue',
        displayName: 'RPM',
        valueType: 'integer' as const,
        unit: 'RPM',
        availability: 'known-no-data' as const,
        provenance: { kind: 'ini' as const },
      },
      {
        logicalKey: 'rpmOtherUnit',
        sourceName: 'rpmOtherUnit',
        displayName: 'RPM',
        valueType: 'integer' as const,
        unit: 'percent',
        availability: 'known-no-data' as const,
        provenance: { kind: 'ini' as const },
      },
    ];
    const aliasCatalog: ChannelCatalog = {
      entries,
      byLogicalKey: new Map(entries.map((entry) => [entry.logicalKey, entry] as const)),
    };

    const result = bindChannelCatalogToLog(
      aliasCatalog,
      [{
        id: 'mlg:0',
        sourceName: 'RPMValue',
        displayName: 'RPMValue',
        valueType: 'integer',
        unit: 'RPM',
      }],
      source,
    );

    expect(result.workspaceChannelAliases.get('mlg:0')).toBe('ini:RPMValue');
    expect(result.workspaceChannelAliases.get('ini:rpm')).toBe('ini:RPMValue');
    expect(result.workspaceChannelAliases.has('ini:rpmOtherUnit')).toBe(false);
  });

""" + needle
text = replace_once(text, needle, insert, 'channel binding alias test')
path.write_text(text)

# Workspace identity regression coverage.
path = Path('tests/web/workspace-channel-identity.test.ts')
text = path.read_text()
needle = """  it('keeps raw mlg IDs when no INI catalog is active', () => {
"""
insert = """  it('maps a stale but still-known INI identity through an explicit safe alias', () => {
    const result = renderableWorkspaceChannelIds(
      ['ini:rpm', 'ini:MAPValue'],
      {
        knownChannelIds: new Set(['ini:rpm', 'ini:RPMValue', 'ini:MAPValue']),
        aliases: new Map([['ini:rpm', 'ini:RPMValue']]),
        iniCatalogActive: true,
        limit: 8,
      },
    );

    expect(result).toEqual(['ini:RPMValue', 'ini:MAPValue']);
  });

""" + needle
text = replace_once(text, needle, insert, 'workspace known alias test')
path.write_text(text)
