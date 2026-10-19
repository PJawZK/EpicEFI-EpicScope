import type { ObservabilityRecorder } from '../observability/recorder';
import { installVeAnalyzerCellEvidence } from './ve-analyzer-cell-evidence';
import { installVeAnalyzerDelayTableInteraction } from './ve-analyzer-delay-table-interaction';
import { installVeAnalyzerV50EvidenceInspector } from './ve-analyzer-v50-evidence-inspector';
import { installVeAnalyzerV50FinalLayout } from './ve-analyzer-v50-final-layout';
import { installVeAnalyzerV50Presentation } from './ve-analyzer-v50-presentation';
import { installVeAnalyzerV50RunStrip } from './ve-analyzer-v50-run-strip';
import { installVeAnalyzerV50SetupDisclosurePolicy } from './ve-analyzer-v50-setup-disclosure';
import { installVeAnalyzerV50TableHeader } from './ve-analyzer-v50-table-header';
import { installVeAnalyzerV50ToolSurfaces } from './ve-analyzer-v50-tool-surfaces';
import { installVeAnalyzerProposalTableInteraction } from './ve-analyzer-proposal-table-interaction';
import { installVeTableBrushOverlay } from './ve-table-brush-overlay';
import { installVeTableToolbarSelectionAvailability } from './ve-table-toolbar-availability';
import {
  createVeAnalyzerView as createVeAnalyzerViewV9,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v9';

export function createVeAnalyzerView(observability?: ObservabilityRecorder): VeAnalyzerViewController {
  const controller = installVeAnalyzerCellEvidence(createVeAnalyzerViewV9(observability, { compactReadiness: true }), observability);
  const presented = installVeAnalyzerV50Presentation(controller);
  const disposeDisclosures = installVeAnalyzerV50SetupDisclosurePolicy(presented.element);
  const proposalEditing = installVeAnalyzerProposalTableInteraction(presented);
  const tableHeader = installVeAnalyzerV50TableHeader(proposalEditing);
  const delayEditing = installVeAnalyzerDelayTableInteraction(tableHeader);
  const tools = installVeAnalyzerV50ToolSurfaces(delayEditing.element);
  const runStrip = installVeAnalyzerV50RunStrip(delayEditing);
  const inspector = installVeAnalyzerV50EvidenceInspector(runStrip.element);
  const disposeLayout = installVeAnalyzerV50FinalLayout(runStrip);
  const disposeOverlay = installVeTableBrushOverlay(runStrip.element);
  const disposeAvailability = installVeTableToolbarSelectionAvailability(runStrip.element);
  const setActive = runStrip.setActive.bind(runStrip);
  const dispose = runStrip.dispose.bind(runStrip);
  let disposed = false;
  runStrip.setActive = (active) => {
    if (disposed) return;
    tools.setActive(active); inspector.setActive(active); setActive(active);
  };
  runStrip.dispose = () => {
    if (disposed) return;
    disposed = true;
    tools.dispose(); inspector.dispose(); disposeDisclosures();
    disposeLayout(); disposeOverlay(); disposeAvailability(); dispose();
  };
  return runStrip;
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
