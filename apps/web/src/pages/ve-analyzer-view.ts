import type { ObservabilityRecorder } from '../observability/recorder';
import { installVeAnalyzerCellEvidence } from './ve-analyzer-cell-evidence';
import { installVeAnalyzerDelayTableInteraction } from './ve-analyzer-delay-table-interaction';
import { installVeAnalyzerV50Presentation } from './ve-analyzer-v50-presentation';
import { installVeAnalyzerV50SecondaryTools } from './ve-analyzer-v50-secondary-tools';
import { installVeAnalyzerProposalTableInteraction } from './ve-analyzer-proposal-table-interaction';
import { installVeTableBrushOverlay } from './ve-table-brush-overlay';
import {
  createVeAnalyzerView as createVeAnalyzerViewV9,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v9';

export function createVeAnalyzerView(observability?: ObservabilityRecorder): VeAnalyzerViewController {
  const controller = installVeAnalyzerCellEvidence(createVeAnalyzerViewV9(observability), observability);
  const presented = installVeAnalyzerV50Presentation(controller);
  const proposalEditing = installVeAnalyzerProposalTableInteraction(presented);
  const delayEditing = installVeAnalyzerDelayTableInteraction(proposalEditing);
  const withSecondaryTools = installVeAnalyzerV50SecondaryTools(delayEditing);
  installVeTableBrushOverlay(withSecondaryTools.element);
  return withSecondaryTools;
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
