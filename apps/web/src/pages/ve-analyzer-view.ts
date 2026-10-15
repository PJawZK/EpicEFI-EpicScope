import { installVeAnalyzerCellEvidence } from './ve-analyzer-cell-evidence';
import { installVeAnalyzerResultContinuity } from './ve-analyzer-result-continuity';
import {
  createVeAnalyzerView as createVeAnalyzerViewV9,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v9';

export function createVeAnalyzerView(): VeAnalyzerViewController {
  return installVeAnalyzerResultContinuity(
    installVeAnalyzerCellEvidence(createVeAnalyzerViewV9()),
  );
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
