import type { ObservabilityRecorder } from '../observability/recorder';
import { installVeAnalyzerCellEvidence } from './ve-analyzer-cell-evidence';
import { installVeAnalyzerDelayTableInteraction } from './ve-analyzer-delay-table-interaction';
import { installVeAnalyzerV50EvidenceInspector } from './ve-analyzer-v50-evidence-inspector';
import { installVeAnalyzerV50FinalLayout } from './ve-analyzer-v50-final-layout';
import { installVeAnalyzerV50Presentation } from './ve-analyzer-v50-presentation';
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
  const controller = installVeAnalyzerCellEvidence(createVeAnalyzerViewV9(observability), observability);
  const presented = installVeAnalyzerV50Presentation(controller);
  installVeAnalyzerV50SetupDisclosurePolicy(presented.element);
  const proposalEditing = installVeAnalyzerProposalTableInteraction(presented);
  const tableHeader = installVeAnalyzerV50TableHeader(proposalEditing);
  const delayEditing = installVeAnalyzerDelayTableInteraction(tableHeader);
  installVeAnalyzerV50ToolSurfaces(delayEditing.element);
  installVeAnalyzerV50EvidenceInspector(delayEditing.element);
  installVeAnalyzerV50FinalLayout(delayEditing.element);
  installVeTableBrushOverlay(delayEditing.element);
  installVeTableToolbarSelectionAvailability(delayEditing.element);
  return delayEditing;
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
