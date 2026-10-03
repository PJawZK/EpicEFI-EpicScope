from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


logger_path = Path('apps/web/src/pages/logger-page.ts')
text = logger_path.read_text()

text = replace_once(text, """  readonly visiblePaneCount: number;
  readonly assignedChannelCount: number;
  readonly activeTraceCount: number;
  readonly panes: readonly {
    readonly id: string;
    readonly visible: boolean;
    readonly assignedChannelIds: readonly string[];
    readonly activeChannelIds: readonly string[];
  }[];
""", """  readonly visiblePaneCount: number;
  readonly assignedChannelCount: number;
  readonly renderableAssignedChannelCount: number;
  readonly unavailableAssignedChannelCount: number;
  readonly activeTraceCount: number;
  readonly panes: readonly {
    readonly id: string;
    readonly visible: boolean;
    readonly assignedChannelIds: readonly string[];
    readonly renderableAssignedChannelIds: readonly string[];
    readonly unavailableAssignedChannelIds: readonly string[];
    readonly activeChannelIds: readonly string[];
  }[];
""", 'runtime snapshot interface')

text = replace_once(text, """function severityRank(severity: ParserDiagnosticSeverity): number {
  if (severity === 'error') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

function createDiagnosticsIndicator(): DiagnosticsIndicatorController {
""", """function severityRank(severity: ParserDiagnosticSeverity): number {
  if (severity === 'error') return 3;
  if (severity === 'warning') return 2;
  return 1;
}

interface SourceIntegritySummary {
  readonly recoveredRetryArtifacts: number;
  readonly validRetryLikeRuns: number;
  readonly unrecoveredCrcRecords: number;
  readonly counterAnomalies: number;
  readonly groupedUnresolvedEvents: number;
}

function unresolvedParserDiagnostics(
  diagnostics: readonly ParserDiagnostic[],
): ParserDiagnostic[] {
  return diagnostics.filter((diagnostic) =>
    (diagnostic.severity === 'warning' || diagnostic.severity === 'error')
    && diagnostic.code !== 'mlg-retry-recovery-summary'
    && diagnostic.code !== 'mlg-counter-pattern-summary'
  );
}

function integerGcd(left: number, right: number): number {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  while (b !== 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}

function estimateMlgRecordStride(diagnostics: readonly ParserDiagnostic[]): number | undefined {
  const crcOffsets = diagnostics
    .filter((diagnostic) =>
      (diagnostic.code === 'mlg-crc-mismatch' || diagnostic.code === 'mlg-crc-retry-recovered')
      && diagnostic.offset !== undefined
    )
    .map((diagnostic) => diagnostic.offset!)
    .sort((left, right) => left - right);
  if (crcOffsets.length < 2) return undefined;

  let stride = 0;
  for (let index = 1; index < crcOffsets.length; index += 1) {
    const difference = crcOffsets[index]! - crcOffsets[index - 1]!;
    if (difference <= 0) continue;
    stride = stride === 0 ? difference : integerGcd(stride, difference);
    if (stride === 1) return undefined;
  }
  return stride >= 8 && stride <= 1_000_000 ? stride : undefined;
}

function groupedUnresolvedMlgEventCount(diagnostics: readonly ParserDiagnostic[]): number {
  const unresolved = diagnostics
    .filter((diagnostic) =>
      (diagnostic.code === 'mlg-crc-mismatch' || diagnostic.code === 'mlg-counter-discontinuity')
      && diagnostic.offset !== undefined
    )
    .sort((left, right) => left.offset! - right.offset!);
  if (unresolved.length === 0) return 0;

  const stride = estimateMlgRecordStride(diagnostics);
  if (!stride) return unresolved.length;
  const adjacency = stride + 8;
  let groups = 1;
  let previousOffset = unresolved[0]!.offset!;
  for (const diagnostic of unresolved.slice(1)) {
    const offset = diagnostic.offset!;
    if (offset - previousOffset > adjacency) groups += 1;
    previousOffset = offset;
  }
  return groups;
}

function summarizeSourceIntegrity(diagnostics: readonly ParserDiagnostic[]): SourceIntegritySummary {
  const count = (code: string): number => diagnostics.filter((item) => item.code === code).length;
  return {
    recoveredRetryArtifacts: count('mlg-crc-retry-recovered'),
    validRetryLikeRuns: count('mlg-counter-retry-pattern'),
    unrecoveredCrcRecords: count('mlg-crc-mismatch'),
    counterAnomalies: count('mlg-counter-discontinuity'),
    groupedUnresolvedEvents: groupedUnresolvedMlgEventCount(diagnostics),
  };
}

function createDiagnosticsIndicator(): DiagnosticsIndicatorController {
""", 'source integrity helpers')

text = replace_once(text, """    const lines = [
      'EpicScope parser diagnostics',
      '',
      `Total: ${diagnostics.length.toLocaleString()}`,
      '',
      '[Groups]',
    ];
""", """    const sourceIntegrity = summarizeSourceIntegrity(diagnostics);
    const unresolved = unresolvedParserDiagnostics(diagnostics);
    const lines = [
      'EpicScope parser diagnostics',
      '',
      `Total: ${diagnostics.length.toLocaleString()}`,
      `Unresolved: ${unresolved.length.toLocaleString()}`,
      '',
      '[Source integrity]',
      `Recovered retry artifacts: ${sourceIntegrity.recoveredRetryArtifacts.toLocaleString()}`,
      `Valid retry-like runs: ${sourceIntegrity.validRetryLikeRuns.toLocaleString()}`,
      `Unrecovered CRC records: ${sourceIntegrity.unrecoveredCrcRecords.toLocaleString()}`,
      `Counter anomalies: ${sourceIntegrity.counterAnomalies.toLocaleString()}`,
      `Grouped unresolved MLG events: ${sourceIntegrity.groupedUnresolvedEvents.toLocaleString()}`,
      '',
      '[Groups]',
    ];
""", 'report source integrity summary')

text = replace_once(text, """    lines.push('', '[Diagnostics]');
    diagnostics.forEach((diagnostic, index) => {
""", """    lines.push('', '[Unresolved diagnostics]');
    unresolved.forEach((diagnostic, index) => {
      const offset = diagnostic.offset === undefined
        ? 'byte —'
        : `byte ${diagnostic.offset.toLocaleString()}`;
      lines.push(
        `${index + 1}. ${diagnostic.severity.toUpperCase()} | ${diagnostic.code} | ${offset} | ${diagnostic.message}`,
      );
    });

    lines.push('', '[All diagnostics]');
    diagnostics.forEach((diagnostic, index) => {
""", 'report unresolved section')

text = replace_once(text, """    count.hidden = false;
    count.textContent = diagnostics.length.toLocaleString();
    button.title = `${diagnostics.length.toLocaleString()} parser diagnostic${diagnostics.length === 1 ? '' : 's'}`;

    const heading = document.createElement('div');
""", """    const unresolved = unresolvedParserDiagnostics(diagnostics);
    const sourceIntegrity = summarizeSourceIntegrity(diagnostics);
    count.hidden = false;
    count.textContent = (unresolved.length > 0 ? unresolved.length : diagnostics.length).toLocaleString();
    button.title = `${unresolved.length.toLocaleString()} unresolved · ${diagnostics.length.toLocaleString()} total parser diagnostics`;

    const heading = document.createElement('div');
""", 'diagnostic badge counts')

text = replace_once(text, """    const headingCount = document.createElement('span');
    headingCount.textContent = `${diagnostics.length.toLocaleString()} total`;
""", """    const headingCount = document.createElement('span');
    headingCount.textContent = `${unresolved.length.toLocaleString()} unresolved · ${diagnostics.length.toLocaleString()} total`;
""", 'diagnostic heading counts')

text = replace_once(text, """    const groups = document.createElement('div');
    groups.className = 'parser-popover-groups';
""", """    const sourceSummary = document.createElement('div');
    sourceSummary.className = 'parser-popover-groups';
    const sourceRows: readonly [string, number, ParserDiagnosticSeverity][] = [
      ['Recovered retry artifacts', sourceIntegrity.recoveredRetryArtifacts, 'info'],
      ['Valid retry-like runs', sourceIntegrity.validRetryLikeRuns, 'info'],
      ['Unrecovered CRC records', sourceIntegrity.unrecoveredCrcRecords, 'warning'],
      ['Counter anomalies', sourceIntegrity.counterAnomalies, 'warning'],
      ['Grouped unresolved MLG events', sourceIntegrity.groupedUnresolvedEvents, sourceIntegrity.groupedUnresolvedEvents > 0 ? 'warning' : 'info'],
    ];
    for (const [label, value, severity] of sourceRows) {
      const row = document.createElement('div');
      row.className = `parser-popover-group parser-popover-group--${severity}`;
      row.innerHTML = `
        <span class="parser-popover-severity" aria-hidden="true"></span>
        <strong>${label}</strong>
        <span>${value.toLocaleString()}</span>
      `;
      sourceSummary.append(row);
    }

    const groups = document.createElement('div');
    groups.className = 'parser-popover-groups';
""", 'popover source summary')

text = replace_once(text, """    const occurrenceHeading = document.createElement('strong');
    occurrenceHeading.textContent = 'First occurrences';
    occurrences.append(occurrenceHeading);

    const list = document.createElement('ol');
    for (const diagnostic of diagnostics.slice(0, 40)) {
""", """    const occurrenceHeading = document.createElement('strong');
    occurrenceHeading.textContent = 'Unresolved occurrences';
    occurrences.append(occurrenceHeading);

    const list = document.createElement('ol');
    for (const diagnostic of unresolved.slice(0, 40)) {
""", 'unresolved occurrence list')

text = replace_once(text, """    occurrences.append(list);

    copyButton.addEventListener('click', () => {
""", """    if (unresolved.length === 0) {
      const clean = document.createElement('div');
      clean.className = 'parser-popover-empty';
      clean.textContent = 'No unresolved parser diagnostics.';
      occurrences.append(clean);
    } else {
      occurrences.append(list);
    }

    copyButton.addEventListener('click', () => {
""", 'empty unresolved state')

text = replace_once(text, """    popover.replaceChildren(heading, groups, occurrences);
""", """    popover.replaceChildren(heading, sourceSummary, groups, occurrences);
""", 'popover layout')

text = replace_once(text, """    const panes = paneRuntimes.map((runtime) => {
      const pane = workspace?.panes.find((candidate) => candidate.id === runtime.id);
      return {
        id: runtime.id,
        visible: visiblePaneIds.has(runtime.id),
        assignedChannelIds: [...(pane?.channelIds ?? [])],
        activeChannelIds: [...runtime.activeChannelIds],
      };
    });
""", """    const panes = paneRuntimes.map((runtime) => {
      const pane = workspace?.panes.find((candidate) => candidate.id === runtime.id);
      const assignedChannelIds = [...(pane?.channelIds ?? [])];
      const renderableAssignedChannelIds = renderablePersistentChannelIds(assignedChannelIds)
        .filter((channelId) =>
          channelDefinitions.has(channelId) && !unavailableChannelIds.has(channelId)
        );
      const renderableSet = new Set(renderableAssignedChannelIds);
      return {
        id: runtime.id,
        visible: visiblePaneIds.has(runtime.id),
        assignedChannelIds,
        renderableAssignedChannelIds,
        unavailableAssignedChannelIds: assignedChannelIds.filter((channelId) => !renderableSet.has(channelId)),
        activeChannelIds: [...runtime.activeChannelIds],
      };
    });
""", 'runtime pane availability')

text = replace_once(text, """      assignedChannelCount: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.assignedChannelIds.length, 0),
      activeTraceCount: panes
""", """      assignedChannelCount: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.assignedChannelIds.length, 0),
      renderableAssignedChannelCount: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.renderableAssignedChannelIds.length, 0),
      unavailableAssignedChannelCount: panes
        .filter((pane) => pane.visible)
        .reduce((sum, pane) => sum + pane.unavailableAssignedChannelIds.length, 0),
      activeTraceCount: panes
""", 'runtime availability counts')

logger_path.write_text(text)

shell_path = Path('apps/web/src/app/app-shell.ts')
shell = shell_path.read_text()
shell = replace_once(shell, """    if (snapshot.assignedChannelCount > 0 && snapshot.activeTraceCount === 0) {
      issues.push(`${snapshot.assignedChannelCount} channels are assigned to visible panes but zero traces are active.`);
    }
    if (snapshot.activeTraceCount > snapshot.assignedChannelCount) {
      warnings.push('Active trace count exceeds assigned visible-channel count.');
    }
""", """    if (
      snapshot.renderableAssignedChannelCount > 0
      && snapshot.activeTraceCount < snapshot.renderableAssignedChannelCount
    ) {
      issues.push(
        `${snapshot.renderableAssignedChannelCount - snapshot.activeTraceCount} of `
        + `${snapshot.renderableAssignedChannelCount} renderable channels assigned to visible panes are not active.`,
      );
    }
    if (snapshot.unavailableAssignedChannelCount > 0) {
      warnings.push(
        `${snapshot.unavailableAssignedChannelCount} assigned visible-pane channel(s) are unavailable in the current log.`,
      );
    }
    if (snapshot.activeTraceCount > snapshot.renderableAssignedChannelCount) {
      warnings.push('Active trace count exceeds renderable assigned visible-channel count.');
    }
""", 'bug report health rules')

shell = replace_once(shell, """      `assignedVisibleChannels=${snapshot.assignedChannelCount}`,
      `activeVisibleTraces=${snapshot.activeTraceCount}`,
      ...snapshot.panes.map((pane) =>
        `pane=${pane.id}; visible=${pane.visible}; assigned=[${pane.assignedChannelIds.join(',')}]; active=[${pane.activeChannelIds.join(',')}]`
      ),
""", """      `assignedVisibleChannels=${snapshot.assignedChannelCount}`,
      `renderableAssignedVisibleChannels=${snapshot.renderableAssignedChannelCount}`,
      `unavailableAssignedVisibleChannels=${snapshot.unavailableAssignedChannelCount}`,
      `activeVisibleTraces=${snapshot.activeTraceCount}`,
      ...snapshot.panes.map((pane) =>
        `pane=${pane.id}; visible=${pane.visible}; assigned=[${pane.assignedChannelIds.join(',')}]; `
        + `renderable=[${pane.renderableAssignedChannelIds.join(',')}]; `
        + `unavailable=[${pane.unavailableAssignedChannelIds.join(',')}]; active=[${pane.activeChannelIds.join(',')}]`
      ),
""", 'bug report runtime details')
shell_path.write_text(shell)
