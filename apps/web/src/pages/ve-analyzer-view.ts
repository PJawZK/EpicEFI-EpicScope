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
import { installVeAnalyzerTargetTableInteraction } from './ve-analyzer-target-table-interaction';
import { installVeTableBrushOverlay } from './ve-table-brush-overlay';
import { installVeTableToolbarSelectionAvailability } from './ve-table-toolbar-availability';
import {
  createVeAnalyzerView as createVeAnalyzerViewV9,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v9';

export function createVeAnalyzerView(observability?: ObservabilityRecorder): VeAnalyzerViewController {
  const controller = installVeAnalyzerCellEvidence(createVeAnalyzerViewV9(observability), observability);
  const presented = installVeAnalyzerV50Presentation(controller);
  installVeAnalyzerV50SetupDisclosurePolicy(presented.element);
  const proposalEditing = installVeAnalyzerProposalTableInteraction(presented);
  const tableHeader = installVeAnalyzerV50TableHeader(proposalEditing);
  const targetEditing = installVeAnalyzerTargetTableInteraction(tableHeader);
  const delayEditing = installVeAnalyzerDelayTableInteraction(targetEditing);
  installVeAnalyzerV50ToolSurfaces(delayEditing.element);
  const runStrip = installVeAnalyzerV50RunStrip(delayEditing);
  installVeAnalyzerV50EvidenceInspector(runStrip.element);
  installVeAnalyzerV50FinalLayout(runStrip.element);
  installVeTableBrushOverlay(runStrip.element);
  installVeTableToolbarSelectionAvailability(runStrip.element);
  return runStrip;
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
