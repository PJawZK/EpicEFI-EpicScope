import type { ParserDiagnostic } from '../../core/log-model/log-types';
const d = (code: string, severity: ParserDiagnostic['severity'], offset?: number, message = code): ParserDiagnostic => ({ code, severity, message, recoverable: severity !== 'error', ...(offset === undefined ? {} : {offset}) });
export const parserEvidenceFixtures: readonly (readonly ParserDiagnostic[])[] = [
 [],
 [d('mlg-crc-validation-pending','info'),d('mlg-crc-retry-recovered','info',100),d('mlg-crc-retry-recovered','info',200),d('mlg-counter-retry-pattern','info',300),d('mlg-retry-recovery-summary','warning')],
 [d('mlg-crc-mismatch','warning',100),d('mlg-counter-discontinuity','warning',200),d('mlg-crc-mismatch','warning',1000),d('mlg-counter-pattern-summary','warning')],
 [d('fatal','error',0,'long diagnostic '+ '界'.repeat(1000)),d('info','info',undefined,'details'),...Array.from({length:45},(_,i)=>d('warning','warning',i*100,'occurrence '+i))],
];
