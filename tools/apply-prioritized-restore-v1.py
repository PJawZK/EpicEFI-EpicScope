from pathlib import Path

# 1) Sidecar datasource: selectively gate prioritized channels until the sidecar is ready.
path = Path('apps/web/src/adapters/mlg-column-sidecar-v1.ts')
text = path.read_text()
old = """  private dataFile: File | undefined;\n  private manifest: MlgColumnSidecarManifest | undefined;\n  private readonly existingManifestPromise: Promise<void>;\n"""
new = """  private dataFile: File | undefined;\n  private manifest: MlgColumnSidecarManifest | undefined;\n  private readonly existingManifestPromise: Promise<void>;\n  private prioritizedChannelIds = new Set<string>();\n  private priorityReadyPromise: Promise<void> | undefined;\n  private resolvePriorityReady: (() => void) | undefined;\n"""
if old not in text:
    raise SystemExit('sidecar fields pattern missing')
text = text.replace(old, new, 1)

old = """    this.manifest = manifest;\n    this.dataFile = undefined;\n    return true;\n  }\n\n  private async ensureManifest(): Promise<MlgColumnSidecarManifest | undefined> {\n"""
new = """    this.manifest = manifest;\n    this.dataFile = undefined;\n    this.releasePrioritizedChannels();\n    return true;\n  }\n\n  public prioritizeChannelsUntilReady(channelIds: readonly string[]): void {\n    this.prioritizedChannelIds = new Set(\n      channelIds.filter((channelId) => this.fieldByChannelId.has(channelId)),\n    );\n    if (this.manifest || this.prioritizedChannelIds.size === 0) {\n      this.releasePrioritizedChannels();\n      return;\n    }\n    if (!this.priorityReadyPromise) {\n      this.priorityReadyPromise = new Promise<void>((resolve) => {\n        this.resolvePriorityReady = resolve;\n      });\n    }\n  }\n\n  public releasePrioritizedChannels(): void {\n    this.resolvePriorityReady?.();\n    this.resolvePriorityReady = undefined;\n    this.priorityReadyPromise = undefined;\n    this.prioritizedChannelIds.clear();\n  }\n\n  private async waitForPrioritizedChannels(channelIds: readonly string[]): Promise<void> {\n    const wait = this.priorityReadyPromise;\n    if (!wait || this.manifest || channelIds.length === 0) return;\n    if (!channelIds.every((channelId) => this.prioritizedChannelIds.has(channelId))) return;\n    await wait;\n  }\n\n  private async ensureManifest(): Promise<MlgColumnSidecarManifest | undefined> {\n"""
if old not in text:
    raise SystemExit('sidecar activate pattern missing')
text = text.replace(old, new, 1)

old = """  ): Promise<NumericChannelBatchResult | undefined> {\n    const manifest = await this.ensureManifest();\n"""
new = """  ): Promise<NumericChannelBatchResult | undefined> {\n    await this.waitForPrioritizedChannels(channelIds);\n    const manifest = await this.ensureManifest();\n"""
if old not in text:
    raise SystemExit('readFromSidecar pattern missing')
text = text.replace(old, new, 1)
path.write_text(text)

# 2) Staged import: start validation immediately with optional prioritized raw channel IDs.
path = Path('apps/web/src/adapters/mlg-staged-import.ts')
text = path.read_text()
text = text.replace(
"""  startValidation(): void;\n  cancel(): void;\n""",
"""  startValidation(prioritizedChannelIds?: readonly string[]): void;\n  cancel(): void;\n""",
1,
)
text = text.replace(
"""      if (message.payload.sidecar) {\n        sidecarChannelData?.activate(message.payload.sidecar.manifest);\n      }\n      validationSettled = true;\n""",
"""      if (message.payload.sidecar) {\n        sidecarChannelData?.activate(message.payload.sidecar.manifest);\n      }\n      sidecarChannelData?.releasePrioritizedChannels();\n      validationSettled = true;\n""",
1,
)
text = text.replace(
"""    if (!validationSettled) {\n      validationSettled = true;\n      rejectValidated(error);\n    }\n    terminate();\n  };\n\n  worker.onerror = (event): void => {\n""",
"""    if (!validationSettled) {\n      validationSettled = true;\n      rejectValidated(error);\n    }\n    sidecarChannelData?.releasePrioritizedChannels();\n    terminate();\n  };\n\n  worker.onerror = (event): void => {\n""",
1,
)
text = text.replace(
"""    if (!validationSettled) {\n      validationSettled = true;\n      rejectValidated(error);\n    }\n    terminate();\n  };\n\n  worker.postMessage({\n""",
"""    if (!validationSettled) {\n      validationSettled = true;\n      rejectValidated(error);\n    }\n    sidecarChannelData?.releasePrioritizedChannels();\n    terminate();\n  };\n\n  worker.postMessage({\n""",
1,
)
old = """    startValidation: () => {\n      if (validationStarted || validationSettled) return;\n      validationStarted = true;\n      worker.postMessage({ type: 'start-validation' });\n    },\n    cancel: () => {\n"""
new = """    startValidation: (prioritizedChannelIds = []) => {\n      if (validationStarted || validationSettled) return;\n      validationStarted = true;\n      sidecarChannelData?.prioritizeChannelsUntilReady(prioritizedChannelIds);\n      worker.postMessage({ type: 'start-validation' });\n    },\n    cancel: () => {\n"""
if old not in text:
    raise SystemExit('staged startValidation pattern missing')
text = text.replace(old, new, 1)
text = text.replace(
"""      if (!validationSettled) {\n        validationSettled = true;\n        rejectValidated(error);\n      }\n      terminate();\n    },\n""",
"""      if (!validationSettled) {\n        validationSettled = true;\n        rejectValidated(error);\n      }\n      sidecarChannelData?.releasePrioritizedChannels();\n      terminate();\n    },\n""",
1,
)
path.write_text(text)

# 3) App shell: derive active workspace raw channels, start validation before restore,
# and let only those restored channels wait for sidecar readiness.
path = Path('apps/web/src/app/app-shell.ts')
text = path.read_text()
anchor = """  let activeStagedImport: StagedMlgImportHandle | undefined;\n\n  const recordFullLoad = (\n"""
helper = """  let activeStagedImport: StagedMlgImportHandle | undefined;\n\n  const prioritizedWorkspaceSourceChannelIds = (\n    workspaceState: WebWorkspaceState,\n    logicalToSourceChannelId: ReadonlyMap<string, string> | undefined,\n  ): string[] => {\n    const activeWorkspace = workspaceState.logger.workspaces.find(\n      (workspace) => workspace.id === workspaceState.logger.activeWorkspaceId,\n    );\n    if (!activeWorkspace) return [];\n\n    const logicalIds = new Set<string>();\n    if (activeWorkspace.panes && activeWorkspace.panes.length > 0) {\n      for (const pane of activeWorkspace.panes) {\n        for (const channelId of pane.channelIds) logicalIds.add(channelId);\n      }\n    } else {\n      for (const channelId of activeWorkspace.channelIds) logicalIds.add(channelId);\n    }\n\n    const sourceIds = new Set<string>();\n    for (const channelId of logicalIds) {\n      const sourceId = logicalToSourceChannelId?.get(channelId)\n        ?? (channelId.startsWith('mlg:') ? channelId : undefined);\n      if (sourceId) sourceIds.add(sourceId);\n    }\n    return [...sourceIds];\n  };\n\n  const recordFullLoad = (\n"""
if anchor not in text:
    raise SystemExit('app helper anchor missing')
text = text.replace(anchor, helper, 1)

old = """        const rawSummary: ImportedLogSummary = {\n          ...indexed.summary,\n          diagnostics: [...indexed.summary.diagnostics, pendingDiagnostic],\n        };\n"""
new = """        const reusableWorkspaceBeforeLog = captureWorkspaceState();\n        const rawSummary: ImportedLogSummary = {\n          ...indexed.summary,\n          diagnostics: [...indexed.summary.diagnostics, pendingDiagnostic],\n        };\n"""
if old not in text:
    raise SystemExit('workspace capture anchor missing')
text = text.replace(old, new, 1)

old = """        const workspaceRestore = loadPersistedWorkspace(indexed.summary.source).then(async (restored) => {\n          if (!restored) await loggerPage.restoreActiveWorkspace();\n          resetWorkspaceHistory();\n          scheduleWorkspaceSave();\n        });\n\n        loadedLog.textContent = indexed.summary.source.displayName;\n        setSourceLoadState(openButton, 'loading', `${indexed.summary.source.displayName} · restoring channels before CRC validation`);\n        appStatus.textContent = 'Ready · restoring channels…';\n        parserStatus.textContent = `MLG v${indexed.header.version} · ${indexed.recordIndex.offsets.length.toLocaleString()} records · CRC validation queued`;\n        openButton.disabled = false;\n\n        void workspaceRestore.finally(() => {\n          if (activeStagedImport !== staged) return;\n          staged.startValidation();\n          setSourceLoadState(openButton, 'loading', `${indexed.summary.source.displayName} · CRC validating`);\n          appStatus.textContent = 'Ready · validating CRC…';\n          parserStatus.textContent = `MLG v${indexed.header.version} · ${indexed.recordIndex.offsets.length.toLocaleString()} records · CRC validating`;\n        });\n"""
new = """        const prioritizedSourceChannelIds = prioritizedWorkspaceSourceChannelIds(\n          reusableWorkspaceBeforeLog,\n          prepared.binding?.logicalToSourceChannelId,\n        );\n        staged.startValidation(prioritizedSourceChannelIds);\n\n        const workspaceRestore = loadPersistedWorkspace(indexed.summary.source).then(async (restored) => {\n          if (!restored) await loggerPage.restoreActiveWorkspace();\n          resetWorkspaceHistory();\n          scheduleWorkspaceSave();\n        });\n        void workspaceRestore.catch(() => undefined);\n\n        loadedLog.textContent = indexed.summary.source.displayName;\n        setSourceLoadState(\n          openButton,\n          'loading',\n          prioritizedSourceChannelIds.length > 0\n            ? `${indexed.summary.source.displayName} · prioritizing ${prioritizedSourceChannelIds.length.toLocaleString()} restored channel(s) during CRC validation`\n            : `${indexed.summary.source.displayName} · CRC validating`,\n        );\n        appStatus.textContent = prioritizedSourceChannelIds.length > 0\n          ? 'Ready · prioritizing restored channels during CRC…'\n          : 'Ready · validating CRC…';\n        parserStatus.textContent = `MLG v${indexed.header.version} · ${indexed.recordIndex.offsets.length.toLocaleString()} records · CRC validating`;\n        openButton.disabled = false;\n"""
if old not in text:
    raise SystemExit('workspace restore/start validation block missing')
text = text.replace(old, new, 1)
path.write_text(text)
