import { installVeAnalyzerCellEvidence } from './ve-analyzer-cell-evidence';
import { installVeAnalyzerResultHeat } from './ve-analyzer-result-heat';
import { installVeAnalyzerDelayTableInteraction } from './ve-analyzer-delay-table-interaction';
import { installVeAnalyzerV50Presentation } from './ve-analyzer-v50-presentation';
import {
  createVeAnalyzerView as createVeAnalyzerViewV9,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v9';

export function createVeAnalyzerView(): VeAnalyzerViewController {
  const controller = installVeAnalyzerResultHeat(installVeAnalyzerCellEvidence(createVeAnalyzerViewV9()));
  return installVeAnalyzerDelayTableInteraction(installVeAnalyzerV50Presentation(controller));
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
