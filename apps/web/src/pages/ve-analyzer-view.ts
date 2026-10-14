import { installVeAnalyzerCellEvidence } from './ve-analyzer-cell-evidence';
import {
  createVeAnalyzerView as createVeAnalyzerViewV9,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v9';

export function createVeAnalyzerView(): VeAnalyzerViewController {
  return installVeAnalyzerCellEvidence(createVeAnalyzerViewV9());
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
