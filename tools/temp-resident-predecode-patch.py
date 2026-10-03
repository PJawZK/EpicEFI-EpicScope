from pathlib import Path

adapter = Path('apps/web/src/adapters/persistent-channel-cache.ts')
text = adapter.read_text()
old = """      const delegated = this.source.readChannelsRange\n        ? await this.source.readChannelsRange(channelIds, startSampleIndex, sampleCount)\n        : {\n            ranges: new Map(await Promise.all(channelIds.map(async (channelId) => [\n              channelId,\n              await this.source.readChannelRange(channelId, startSampleIndex, sampleCount),\n            ] as const))),\n            performance: {\n              channelCount: channelIds.length,\n              cacheHitChannelIds: [] as readonly string[],\n              physicalReadCount: 0,\n              physicalBytesRead: 0,\n              physicalReadMs: 0,\n            },\n          };\n      return delegated;\n"""
new = """      const delegated = this.source.readChannelsRange\n        ? await this.source.readChannelsRange(channelIds, startSampleIndex, sampleCount)\n        : {\n            ranges: new Map(await Promise.all(channelIds.map(async (channelId) => [\n              channelId,\n              await this.source.readChannelRange(channelId, startSampleIndex, sampleCount),\n            ] as const))),\n            performance: {\n              channelCount: channelIds.length,\n              cacheHitChannelIds: [] as readonly string[],\n              physicalReadCount: 0,\n              physicalBytesRead: 0,\n              physicalReadMs: 0,\n            },\n          };\n      if (startSampleIndex === 0 && sampleCount === this.sampleCount) {\n        for (const [channelId, range] of delegated.ranges) {\n          if (range.startSampleIndex !== 0 || range.values.length !== this.sampleCount) continue;\n          this.residentColumns.set(channelId, range.values);\n          this.missingColumns.delete(channelId);\n        }\n      }\n      return delegated;\n"""
if old not in text:
    raise SystemExit('adapter target not found')
adapter.write_text(text.replace(old, new, 1))

test = Path('tests/web/persistent-channel-cache.test.ts')
text = test.read_text()
old = """    expect(source.readCount).toBe(1);\n    expect(result?.performance.physicalReadCount).toBe(7);\n    expect(result?.ranges.size).toBe(5);\n  });\n});\n"""
new = """    expect(source.readCount).toBe(1);\n    expect(result?.performance.physicalReadCount).toBe(7);\n    expect(result?.ranges.size).toBe(5);\n\n    const reused = await cached.readChannelRange('mlg:4', 0, cached.sampleCount);\n    expect(source.readCount).toBe(1);\n    expect(reused.values).toEqual(Float64Array.from([400, 401, 402, 403, 404, 405]));\n\n    const laterSource = new FakeChannelDataSource();\n    const later = new PersistentColumnCacheDataSource(laterSource, 'log-c', timeMs, validity, store);\n    await later.readChannelRange('mlg:4', 0, later.sampleCount);\n    expect(laterSource.readCount).toBe(1);\n  });\n});\n"""
if old not in text:
    raise SystemExit('test target not found')
test.write_text(text.replace(old, new, 1))
