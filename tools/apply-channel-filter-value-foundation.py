from pathlib import Path

inspector = Path('apps/web/src/panels/inspector-panel.ts')
s = inspector.read_text()
anchor = "import type { InspectorWorkspaceState } from '../state/workspace-state';\n"
if anchor not in s:
    raise SystemExit('inspector import anchor missing')
s = s.replace(
    anchor,
    anchor + "import { channelMatchesInspectorFilters } from './inspector-channel-view';\n",
    1,
)
old = """    filteredChannels = channels.filter((channel) => {\n      const matchesText = query.length === 0\n        || channel.sourceName.toLocaleLowerCase().includes(query)\n        || channel.displayName.toLocaleLowerCase().includes(query)\n        || (channel.unit?.toLocaleLowerCase().includes(query) ?? false);\n      const matchesGroup = selectedGroup === ''\n        || (selectedGroup === '__ungrouped__' ? !channel.category?.trim() : channel.category === selectedGroup);\n      const matchesVisibility = visibility === 'all'\n        || (visibility === 'active' && activeChannelIds.has(channel.id))\n        || (visibility === 'favorites' && favoriteChannelIds.has(channel.id))\n        || (visibility === 'recent' && recentChannelIds.includes(channel.id));\n      return matchesText && matchesGroup && matchesVisibility;\n    }).sort(compareChannels);\n"""
new = """    filteredChannels = channels.filter((channel) => channelMatchesInspectorFilters(channel, {\n      query,\n      selectedGroup,\n      visibility: visibility as 'all' | 'active' | 'favorites' | 'recent',\n      activeChannelIds,\n      favoriteChannelIds,\n      recentChannelIds,\n    })).sort(compareChannels);\n"""
if old not in s:
    raise SystemExit('inspector filter block missing')
s = s.replace(old, new, 1)
inspector.write_text(s)

logger = Path('apps/web/src/pages/logger-page.ts')
s = logger.read_text()
anchor = "import { createInspectorPanel } from '../panels/inspector-panel';\n"
if anchor not in s:
    raise SystemExit('logger inspector import anchor missing')
s = s.replace(
    anchor,
    anchor + "import { formatInspectorChannelValue } from '../panels/inspector-channel-view';\n",
    1,
)
old = """        if (item.value === undefined || !Number.isFinite(item.value)) {\n          return [{ channelId: item.channelId, value: '—' }];\n        }\n        const precision = Math.min(6, Math.max(0, channel.precision ?? 2));\n        const unit = channel.unit ? ` ${channel.unit}` : '';\n        return [{ channelId: item.channelId, value: `${item.value.toFixed(precision)}${unit}` }];\n"""
new = """        return [{\n          channelId: item.channelId,\n          value: formatInspectorChannelValue(channel, item.value),\n        }];\n"""
if old not in s:
    raise SystemExit('logger value-format block missing')
s = s.replace(old, new, 1)
logger.write_text(s)
