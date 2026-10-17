import type { ObservabilityRecorder } from '../observability/recorder';
import { installVeAnalyzerCellEvidence } from './ve-analyzer-cell-evidence';
import { installVeAnalyzerDelayTableInteraction } from './ve-analyzer-delay-table-interaction';
import { installVeAnalyzerV50EvidenceInspector } from './ve-analyzer-v50-evidence-inspector';
import { installVeAnalyzerV50FinalLayout } from './ve-analyzer-v50-final-layout';
import { installVeAnalyzerV50Presentation } from './ve-analyzer-v50-presentation';
import { installVeAnalyzerV50SecondaryTools } from './ve-analyzer-v50-secondary-tools';
import { installVeAnalyzerV50SetupDisclosurePolicy } from './ve-analyzer-v50-setup-disclosure';
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
  const delayEditing = installVeAnalyzerDelayTableInteraction(proposalEditing);
  const withSecondaryTools = installVeAnalyzerV50SecondaryTools(delayEditing);
  installVeAnalyzerV50EvidenceInspector(withSecondaryTools.element);
  installVeAnalyzerV50FinalLayout(withSecondaryTools.element);
  installVeTableBrushOverlay(withSecondaryTools.element);
  installVeTableToolbarSelectionAvailability(withSecondaryTools.element);
  return withSecondaryTools;
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
