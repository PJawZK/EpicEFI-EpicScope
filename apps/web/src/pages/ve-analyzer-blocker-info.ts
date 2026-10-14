export interface VeRunBlockerHelp {
  readonly why: string;
  readonly fix: string;
}

export function describeVeRunBlocker(message: string): VeRunBlockerHelp {
  const text = message.trim();
  const lower = text.toLowerCase();

  if (lower.includes('activate the lambda-delay recommendation')) {
    return {
      why: 'VE Analyzer must align the measured mixture response with the earlier engine operating point that caused it. A discovered delay table is only a recommendation until you explicitly make it the working delay authority.',
      fix: 'Open Lambda Delay Table and press Use recommendation, or load a saved working delay table instead.',
    };
  }
  if (lower.includes('working lambda-delay table') || lower.includes('lambda delay table')) {
    return {
      why: 'A working lambda-delay table is required so each AFR/Lambda sample can be shifted back to the correct RPM/load operating point before VE evidence is calculated.',
      fix: 'Open Lambda Delay Table, then either Grab lambda delays from log and use the recommendation, or Load a saved delay table.',
    };
  }
  if (lower.startsWith('prior weight')) {
    return {
      why: 'Prior weight controls how strongly the existing VE table is trusted relative to new log evidence. A normal Cell Change preset supplies this automatically; it is only manually entered when Custom authority is used.',
      fix: 'Use the Cell Change control beside Run Analysis and choose Responsive, Normal, Conservative or Very conservative. For manual control, open Advanced inputs and edit Prior weight. Normal = 20.',
    };
  }
  if (lower.startsWith('minimum evidence weight')) {
    return {
      why: 'Minimum evidence weight defines how much accumulated evidence a VE cell needs before EpicScope may emit a measured proposal.',
      fix: 'Use the visible Min evidence weight box in the VE Analyzer controls. It must contain a number of 0 or greater; the current default is 5.',
    };
  }
  if (lower.startsWith('max ve change %')) {
    return {
      why: 'Max VE change % is a safety bound on the relative size of a proposed VE correction. It is not an operating-range Min/Max filter, so it must have a value.',
      fix: 'Use the visible Max VE change % box in the VE Analyzer controls and enter a number of 0 or greater. The current default is 50%.',
    };
  }
  if (lower.startsWith('max ve change')) {
    return {
      why: 'Max VE change is a safety bound on the absolute size of a proposed VE correction. It is not an operating-range Min/Max filter, so it must have a value.',
      fix: 'Use the visible Max VE change box in the VE Analyzer controls and enter a number of 0 or greater. The current default is 50 VE units.',
    };
  }
  if (lower.includes('msq ve table')) {
    return {
      why: 'VE Analyzer needs the base VE table that proposals will be calculated against. Without it there is no calibration surface to analyze.',
      fix: 'Select the correct VE table in the VE table layout controls. For the current EpicEFI tune this is normally veTable.',
    };
  }
  if (lower.includes('ve rpm axis')) {
    return {
      why: 'The VE table RPM axis is required to map each logged operating point into the correct VE cells.',
      fix: 'Select the RPM axis that belongs to the chosen VE table, normally veRpmBins for veTable.',
    };
  }
  if (lower.includes('ve load axis')) {
    return {
      why: 'The VE table load axis is required to map each logged operating point into the correct VE cells.',
      fix: 'Select the load axis that belongs to the chosen VE table, normally veLoadBins for veTable.',
    };
  }
  if (lower.includes('target mixture table')) {
    return {
      why: 'VE correction is calculated from actual mixture versus the intended target mixture. Without the target table EpicScope cannot determine mixture error.',
      fix: 'Select the tune target AFR/Lambda table that belongs to this calibration, normally lambdaTable for the current EpicEFI tune.',
    };
  }
  if (lower.includes('target rpm axis')) {
    return {
      why: 'The target-mixture RPM axis is required to interpolate the intended AFR/Lambda target at each logged operating point.',
      fix: 'Select the RPM axis belonging to the target table, normally lambdaRpmBins for lambdaTable.',
    };
  }
  if (lower.includes('target load axis')) {
    return {
      why: 'The target-mixture load axis is required to interpolate the intended AFR/Lambda target at each logged operating point.',
      fix: 'Select the load axis belonging to the target table, normally lambdaLoadBins for lambdaTable.',
    };
  }
  if (lower.includes('mixture scale')) {
    return {
      why: 'Actual mixture and the target table must use the same interpretation: AFR or Lambda. Mixing those scales would produce invalid VE corrections.',
      fix: 'Set VE Analyzer to the scale used by the target table and actual-mixture channel. Do not rename or convert the source identities.',
    };
  }
  if (lower.includes('actual mixture')) {
    return {
      why: 'VE Analyzer requires a real measured AFR/Lambda channel. Error, target, trim, correction, offset and table channels are not valid substitutes.',
      fix: 'Select a valid actual-mixture source. In AFR mode on the current EpicEFI log, prefer the Gas Scale AFR channel when available.',
    };
  }
  if (lower === 'rpm' || lower.startsWith('rpm —')) {
    return {
      why: 'RPM is required to locate each log sample on both the VE table and the target-mixture table.',
      fix: 'Select a valid logged RPM channel in Advanced inputs.',
    };
  }
  if (lower.includes('ve-table load')) {
    return {
      why: 'The logged load channel is required to locate each sample on the VE table load axis.',
      fix: 'Select the runtime load channel that corresponds to the VE table load axis in Advanced inputs.',
    };
  }
  if (lower.includes('fuel correction')) {
    return {
      why: 'When fuel-correction compensation is enabled, EpicScope needs the selected correction channel so applied trim is not incorrectly attributed to the base VE table.',
      fix: 'Select the correct correction source, change the correction handling mode, or disable compensation if the correction semantics are not known.',
    };
  }

  return {
    why: 'This required VE Analyzer input or safety condition is not currently valid, so running analysis could produce incomplete or misleading results.',
    fix: 'Use Fix to jump to the associated control, then provide a valid required source or setting. Optional blank operating-range Min/Max filters do not block analysis.',
  };
}
