from pathlib import Path

# Patch persistent cache
path = Path('apps/web/src/adapters/persistent-channel-cache.ts')
text = path.read_text()
text = text.replace("const DATABASE_VERSION = 1;\nconst COLUMN_STORE_NAME = 'columns';\n", "const DATABASE_VERSION = 2;\nconst COLUMN_STORE_NAME = 'columns';\nconst UPDATED_AT_INDEX = 'updatedAt';\nconst MAX_PERSISTED_COLUMNS = 128;\n")
text = text.replace(
"""      request.onupgradeneeded = () => {\n        const database = request.result;\n        if (!database.objectStoreNames.contains(COLUMN_STORE_NAME)) {\n          database.createObjectStore(COLUMN_STORE_NAME, { keyPath: 'key' });\n        }\n      };\n""",
"""      request.onupgradeneeded = () => {\n        const database = request.result;\n        const store = database.objectStoreNames.contains(COLUMN_STORE_NAME)\n          ? request.transaction!.objectStore(COLUMN_STORE_NAME)\n          : database.createObjectStore(COLUMN_STORE_NAME, { keyPath: 'key' });\n        if (!store.indexNames.contains(UPDATED_AT_INDEX)) {\n          store.createIndex(UPDATED_AT_INDEX, UPDATED_AT_INDEX);\n        }\n      };\n""",
1,
)
anchor = """  public async put(logKey: string, channelId: string, values: Float64Array): Promise<void> {\n    const database = await this.databasePromise;\n    const copiedValues = values.slice();\n    const transaction = database.transaction(COLUMN_STORE_NAME, 'readwrite');\n    transaction.objectStore(COLUMN_STORE_NAME).put({\n      key: cacheKey(logKey, channelId, copiedValues.length),\n      sampleCount: copiedValues.length,\n      values: copiedValues.buffer,\n      updatedAt: Date.now(),\n    } satisfies StoredColumnRecord);\n    await transactionDone(transaction);\n  }\n}\n"""
replacement = """  public async put(logKey: string, channelId: string, values: Float64Array): Promise<void> {\n    const database = await this.databasePromise;\n    const copiedValues = values.slice();\n    const transaction = database.transaction(COLUMN_STORE_NAME, 'readwrite');\n    transaction.objectStore(COLUMN_STORE_NAME).put({\n      key: cacheKey(logKey, channelId, copiedValues.length),\n      sampleCount: copiedValues.length,\n      values: copiedValues.buffer,\n      updatedAt: Date.now(),\n    } satisfies StoredColumnRecord);\n    await transactionDone(transaction);\n    await this.pruneToLimit(database);\n  }\n\n  private async pruneToLimit(database: IDBDatabase): Promise<void> {\n    const countTransaction = database.transaction(COLUMN_STORE_NAME, 'readonly');\n    const count = await requestResult(countTransaction.objectStore(COLUMN_STORE_NAME).count());\n    await transactionDone(countTransaction);\n    let excess = count - MAX_PERSISTED_COLUMNS;\n    if (excess <= 0) return;\n\n    const transaction = database.transaction(COLUMN_STORE_NAME, 'readwrite');\n    const store = transaction.objectStore(COLUMN_STORE_NAME);\n    const index = store.index(UPDATED_AT_INDEX);\n    await new Promise<void>((resolve, reject) => {\n      const cursorRequest = index.openKeyCursor();\n      cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error('IndexedDB cache pruning failed.'));\n      cursorRequest.onsuccess = () => {\n        const cursor = cursorRequest.result;\n        if (!cursor || excess <= 0) {\n          resolve();\n          return;\n        }\n        store.delete(cursor.primaryKey);\n        excess -= 1;\n        cursor.continue();\n      };\n    });\n    await transactionDone(transaction);\n  }\n}\n\nexport async function clearPersistentChannelCache(): Promise<void> {\n  if (typeof globalThis.indexedDB === 'undefined') return;\n  const database = await new Promise<IDBDatabase>((resolve, reject) => {\n    const request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);\n    request.onupgradeneeded = () => {\n      const db = request.result;\n      const store = db.objectStoreNames.contains(COLUMN_STORE_NAME)\n        ? request.transaction!.objectStore(COLUMN_STORE_NAME)\n        : db.createObjectStore(COLUMN_STORE_NAME, { keyPath: 'key' });\n      if (!store.indexNames.contains(UPDATED_AT_INDEX)) store.createIndex(UPDATED_AT_INDEX, UPDATED_AT_INDEX);\n    };\n    request.onsuccess = () => resolve(request.result);\n    request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB column cache.'));\n  });\n  try {\n    const transaction = database.transaction(COLUMN_STORE_NAME, 'readwrite');\n    transaction.objectStore(COLUMN_STORE_NAME).clear();\n    await transactionDone(transaction);\n  } finally {\n    database.close();\n  }\n}\n"""
assert anchor in text
text = text.replace(anchor, replacement, 1)
path.write_text(text)

# Patch app shell settings
path = Path('apps/web/src/app/app-shell.ts')
text = path.read_text()
text = text.replace(
"import { importMlgFile } from '../adapters/mlg-file-import';\n",
"import { importMlgFile } from '../adapters/mlg-file-import';\nimport { clearPersistentChannelCache } from '../adapters/persistent-channel-cache';\n",
1,
)
anchor = """          <div class=\"settings-persistence\">\n            <div>\n              <strong>Saved workspace</strong>\n              <small class=\"settings-persistence-status\">Workspace structure is saved locally in this browser.</small>\n            </div>\n            <button type=\"button\" class=\"setting-forget-workspace\" disabled>Forget saved log view</button>\n          </div>\n"""
replacement = anchor + """          <div class=\"settings-persistence\">\n            <div>\n              <strong>Decoded channel cache</strong>\n              <small class=\"settings-channel-cache-status\">Up to 128 recently decoded channels are retained locally.</small>\n            </div>\n            <button type=\"button\" class=\"setting-clear-channel-cache\">Clear channel cache</button>\n          </div>\n"""
assert anchor in text
text = text.replace(anchor, replacement, 1)
text = text.replace(
"  const persistenceStatus = header.querySelector<HTMLElement>('.settings-persistence-status');\n",
"  const persistenceStatus = header.querySelector<HTMLElement>('.settings-persistence-status');\n  const clearChannelCacheButton = header.querySelector<HTMLButtonElement>('.setting-clear-channel-cache');\n  const channelCacheStatus = header.querySelector<HTMLElement>('.settings-channel-cache-status');\n",
1,
)
text = text.replace(
"if (!brandButton || !brandMenu || !openButton || !loadIniButton || !loadedLog || !appStatus || !parserStatus || !settingsButton || !settingsPopover || !playbackSpeed || !samplePoints || !overviewTraces || !performanceVisible || !undoButton || !redoButton || !unloadIniButton || !iniStatus || !forgetWorkspaceButton || !persistenceStatus) {",
"if (!brandButton || !brandMenu || !openButton || !loadIniButton || !loadedLog || !appStatus || !parserStatus || !settingsButton || !settingsPopover || !playbackSpeed || !samplePoints || !overviewTraces || !performanceVisible || !undoButton || !redoButton || !unloadIniButton || !iniStatus || !forgetWorkspaceButton || !persistenceStatus || !clearChannelCacheButton || !channelCacheStatus) {",
1,
)
anchor = "  type SourceLoadState = 'idle' | 'loading' | 'success' | 'restored' | 'issue';\n"
replacement = """  clearChannelCacheButton.addEventListener('click', () => {\n    clearChannelCacheButton.disabled = true;\n    channelCacheStatus.textContent = 'Clearing decoded channel cache…';\n    void clearPersistentChannelCache().then(() => {\n      channelCacheStatus.textContent = 'Decoded channel cache cleared.';\n      appStatus.textContent = 'Channel cache cleared';\n    }).catch((error: unknown) => {\n      channelCacheStatus.textContent = `Unable to clear cache: ${error instanceof Error ? error.message : String(error)}`;\n    }).finally(() => {\n      clearChannelCacheButton.disabled = false;\n    });\n  });\n\n  type SourceLoadState = 'idle' | 'loading' | 'success' | 'restored' | 'issue';\n"""
assert anchor in text
text = text.replace(anchor, replacement, 1)
path.write_text(text)
