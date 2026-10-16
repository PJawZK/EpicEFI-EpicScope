import type { ObservabilityRecorder } from '../observability/recorder';
import { installVeAnalyzerCellEvidence } from './ve-analyzer-cell-evidence';
import {
  createVeAnalyzerView as createVeAnalyzerViewV9,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v9';

export function createVeAnalyzerView(observability?: ObservabilityRecorder): VeAnalyzerViewController {
  return installVeAnalyzerCellEvidence(createVeAnalyzerViewV9(observability), observability);
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
