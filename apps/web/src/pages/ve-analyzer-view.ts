import { installVeAnalyzerCellEvidence } from './ve-analyzer-cell-evidence';
import { installVeAnalyzerRenderState } from './ve-analyzer-render-state';
import { installVeAnalyzerSessionContinuity } from './ve-analyzer-session-continuity';
import {
  createVeAnalyzerView as createVeAnalyzerViewV9,
  type VeAnalyzerViewController,
} from './ve-analyzer-view-v9';

export function createVeAnalyzerView(): VeAnalyzerViewController {
  return installVeAnalyzerSessionContinuity(
    installVeAnalyzerRenderState(
      installVeAnalyzerCellEvidence(createVeAnalyzerViewV9()),
    ),
  );
}

export type { VeAnalyzerViewController } from './ve-analyzer-view-v9';
