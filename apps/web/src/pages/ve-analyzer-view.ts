import { installVeAnalyzerCellEvidence } from './ve-analyzer-cell-evidence';
import {
  createVeAnalyzerView as createVeAnalyzerViewV10,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v10';

export function createVeAnalyzerView(): VeAnalyzerViewController {
  return installVeAnalyzerCellEvidence(createVeAnalyzerViewV10());
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v10';
