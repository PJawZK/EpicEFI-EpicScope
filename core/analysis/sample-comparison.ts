import {
  qualifyNumericSampleGroups,
  type NumericGroupedQualificationRequest,
  type NumericQualificationChannelRange,
  type NumericQualificationGroup,
  type NumericQualificationLogic,
  type NumericQualificationResult,
  type NumericQualificationTimeRange,
} from './sample-qualification';

export interface NumericComparisonSideRequest {
  readonly label: string;
  readonly groupLogic?: NumericQualificationLogic;
  readonly groups?: readonly NumericQualificationGroup[];
  readonly timeRange?: NumericQualificationTimeRange;
}

export interface NumericSampleComparisonRequest {
  readonly referenceChannelId: string;
  readonly channels: ReadonlyMap<string, NumericQualificationChannelRange>;
  readonly left: NumericComparisonSideRequest;
  readonly right: NumericComparisonSideRequest;
}

export interface NumericComparisonSideResult extends NumericQualificationResult {
  readonly label: string;
  /** Input samples that could be evaluated after removing invalid/unavailable evidence. */
  readonly evaluableSampleCount: number;
  /** Qualified samples divided by evaluable samples. Undefined when no sample was evaluable. */
  readonly qualificationRatio?: number;
}

export interface NumericSampleComparisonResult {
  readonly left: NumericComparisonSideResult;
  readonly right: NumericComparisonSideResult;
  readonly inputSampleCountDelta: number;
  readonly eligibleSampleCountDelta: number;
  readonly qualificationRatioDelta?: number;
}

function qualifySide(
  referenceChannelId: string,
  channels: ReadonlyMap<string, NumericQualificationChannelRange>,
  side: NumericComparisonSideRequest,
): NumericComparisonSideResult {
  const request: NumericGroupedQualificationRequest = {
    referenceChannelId,
    channels,
    groupLogic: side.groupLogic ?? 'and',
    groups: side.groups ?? [],
    ...(side.timeRange ? { timeRange: side.timeRange } : {}),
  };
  const result = qualifyNumericSampleGroups(request);
  const evaluableSampleCount = Math.max(
    0,
    result.inputSampleCount - result.invalidSampleCount - result.unavailableSampleCount,
  );
  return {
    ...result,
    label: side.label,
    evaluableSampleCount,
    ...(evaluableSampleCount > 0
      ? { qualificationRatio: result.eligibleSampleCount / evaluableSampleCount }
      : {}),
  };
}

/**
 * Qualifies two evidence sets through the same shared qualification engine and
 * returns both provenance records side-by-side. The two sides may use different
 * time scopes and/or operating-condition filters, but they always reference the
 * same decoded channel map and source sample-index grid.
 */
export function compareQualifiedNumericSamples(
  request: NumericSampleComparisonRequest,
): NumericSampleComparisonResult {
  const left = qualifySide(request.referenceChannelId, request.channels, request.left);
  const right = qualifySide(request.referenceChannelId, request.channels, request.right);
  return {
    left,
    right,
    inputSampleCountDelta: right.inputSampleCount - left.inputSampleCount,
    eligibleSampleCountDelta: right.eligibleSampleCount - left.eligibleSampleCount,
    ...(left.qualificationRatio !== undefined && right.qualificationRatio !== undefined
      ? { qualificationRatioDelta: right.qualificationRatio - left.qualificationRatio }
      : {}),
  };
}
