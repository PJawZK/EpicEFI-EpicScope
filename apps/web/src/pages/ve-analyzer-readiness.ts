export interface VeProposalSettingInputs {
  readonly priorWeight: string;
  readonly minimumEvidenceWeight: string;
  readonly maximumAbsoluteChange: string;
  readonly maximumPercentChange: string;
}

function numericIssue(label: string, raw: string): string | undefined {
  const text = raw.trim();
  if (!text) return `${label} is blank`;
  const value = Number(text);
  if (!Number.isFinite(value)) return `${label} must be a number`;
  if (value < 0) return `${label} must be 0 or greater`;
  return undefined;
}

export function veProposalSettingIssues(inputs: VeProposalSettingInputs): string[] {
  return [
    numericIssue('Prior weight', inputs.priorWeight),
    numericIssue('Minimum evidence weight', inputs.minimumEvidenceWeight),
    numericIssue('Max VE change', inputs.maximumAbsoluteChange),
    numericIssue('Max VE change %', inputs.maximumPercentChange),
  ].filter((issue): issue is string => Boolean(issue));
}
