import type { IdleRpmPidResult } from '../../../../core/analysis/idle-rpm-pid';
import { idleRecordedValue, idleRecordedCoverage } from './idle-recorded-presentation';

/** Scalar-only projection of retained controller evidence; never revisits source arrays. */
export function presentIdleRpmPid(result: IdleRpmPidResult, complete: boolean) {
  const roles=([['Logged P',result.p],['Logged I',result.i],['Logged D',result.d],['Logged PID output · stage unverified',result.output],['Applied correction',result.applied]] as const).map(([label,metric])=>({label,mean:idleRecordedValue(metric),rms:idleRecordedValue(metric,'rootMeanSquare'),unit:metric.status==='missing'?'unit unavailable':metric.status==='incompatible-unit'?'unit unsupported':metric.unit==='raw'?'raw (engineering unit unspecified)':metric.unit,coverage:idleRecordedCoverage(metric)}));
  const terms=[result.p,result.i,result.d], any=terms.some(metric=>metric.status==='available');
  const metrics=[...terms,result.output,result.applied];
  const limited=!complete||metrics.some(metric=>metric.status!=='available'||'statistics' in metric&&(metric.statistics.invalidSampleCount>0||metric.statistics.unavailableSampleCount>0))||metrics.some(metric=>metric.unit==='raw');
  return {
    gates:[{label:'Firmware limit / clamp coverage',value:'Unavailable — no verified runtime-associated controller limits.'},{label:'Raw-to-applied attenuation',value:'Unavailable — controller output stage and common engineering scaling are not verified.'}],
    roles,pRms:roles[0]!.rms,iMean:roles[1]!.mean,dRms:roles[2]!.rms,appliedMean:roles[4]!.mean,
    status:!any?'RPM PID term evidence unavailable':limited?'Limited recorded RPM PID evidence':'Recorded RPM PID evidence',
    observed:roles.map(role=>`${role.label}: mean ${role.mean}, RMS ${role.rms} ${role.unit}`).join('; ')+'. P and D RMS retain opposing excursions that a signed mean can hide.',
    limits:'These are independent logged measurements, not a recomputed PID controller. Raw values with unspecified engineering units are not percentage points. A common raw graph scale does not verify physical scaling. Logged PID output is not assumed to equal P + I + D or to precede clamping/fade; applied correction is a separate logged channel. Per-role valid denominators can differ. Firmware limits, offset, anti-windup, attenuation, controller cadence and causal tuning improvement are not established. No fixed +30 saturation rule, fade percentage or gain recommendation is calculated. Invalid counts can include recovered retries. Raw focused traces can include measurements excluded by analysis conditions. No tune or ECU values are changed.',
    next:!any?'Map compatible logged outer RPM P/I/D channels in Channels / region. Unitless exact canonical fields remain raw; unsupported engineering units are unavailable. Inner DC position PID is a different controller.':metrics.some(metric=>metric.status==='nonfinite-metrics')?'Verify source scaling, magnitudes and units before interpreting nonfinite controller measurements.':limited?'Review each role’s units, validity and exact source alignment. Obtain matching firmware/unit and limit definitions before interpreting clamping or raw-to-applied differences; missing output is not zero correction.':'Repeat the declared test with matched RPM target, coolant and electrical/mechanical loads. Inspect RPM response and logged P/I/D, output and applied correction independently before proposing a controlled tuning experiment.',
    supports:'Comparable repeated intervals preserve recorded channel identity, units, valid coverage and documented operating conditions.',
    contradicts:'The apparent change depends on unlike units, missing terms, different source times, unequal denominators or unverified controller-stage assumptions.',
  };
}
