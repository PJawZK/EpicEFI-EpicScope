from pathlib import Path

inspector = Path('apps/web/src/panels/inspector-panel.ts')
text = inspector.read_text(encoding='utf-8')
old = """  setChannelStatistics(statistics: InspectorChannelStatistics | undefined): void;
  onWorkspaceMutation(listener: () => void): void;"""
new = """  setChannelStatistics(statistics: InspectorChannelStatistics | undefined): void;
  getSelectedDetailsChannelId(): string | undefined;
  onWorkspaceMutation(listener: () => void): void;"""
if old not in text:
    raise SystemExit('Inspector controller anchor not found')
text = text.replace(old, new, 1)
old = """    clearChannelValues,
    setChannelStatistics,
    onWorkspaceMutation: (listener) => { workspaceMutationListener = listener; },"""
new = """    clearChannelValues,
    setChannelStatistics,
    getSelectedDetailsChannelId: () => selectedDetailsChannelId,
    onWorkspaceMutation: (listener) => { workspaceMutationListener = listener; },"""
if old not in text:
    raise SystemExit('Inspector return anchor not found')
text = text.replace(old, new, 1)
inspector.write_text(text, encoding='utf-8')

logger = Path('apps/web/src/pages/logger-page.ts')
text = logger.read_text(encoding='utf-8')
old = """  inspector.onChannelDetailsRequested((channelId) => {
    const channel = channelDefinitions.get(channelId);
    const statistics = activePaneRuntime()?.graph.getChannelStatistics(channelId);
    if (!channel || !statistics) {
      inspector.setChannelStatistics(undefined);
      return;
    }
    inspector.setChannelStatistics({
      channelId,
      title: channel.displayName || channel.sourceName,
      unit: channel.unit,
      category: channel.category,
      current: statistics.current,
      full: statistics.full,
      visible: statistics.visible,
      selected: statistics.selected,
    });
  });"""
new = """  const refreshSelectedChannelStatistics = (): void => {
    const channelId = inspector.getSelectedDetailsChannelId();
    if (!channelId) return;
    const channel = channelDefinitions.get(channelId);
    const statistics = activePaneRuntime()?.graph.getChannelStatistics(channelId);
    if (!channel || !statistics) {
      inspector.setChannelStatistics(undefined);
      return;
    }
    inspector.setChannelStatistics({
      channelId,
      title: channel.displayName || channel.sourceName,
      unit: channel.unit,
      category: channel.category,
      current: statistics.current,
      full: statistics.full,
      visible: statistics.visible,
      selected: statistics.selected,
    });
  };

  inspector.onChannelDetailsRequested(() => {
    refreshSelectedChannelStatistics();
  });"""
if old not in text:
    raise SystemExit('Channel details callback anchor not found')
text = text.replace(old, new, 1)
old = """  timeline.onAnnotationChange(({ aTimeMs, bTimeMs }) => {
    paneRuntimes.forEach((runtime) => runtime.graph.setAnalysisRange(aTimeMs, bTimeMs));
  });"""
new = """  timeline.onAnnotationChange(({ aTimeMs, bTimeMs }) => {
    paneRuntimes.forEach((runtime) => runtime.graph.setAnalysisRange(aTimeMs, bTimeMs));
    refreshSelectedChannelStatistics();
  });"""
if old not in text:
    raise SystemExit('Annotation callback anchor not found')
text = text.replace(old, new, 1)
logger.write_text(text, encoding='utf-8')
