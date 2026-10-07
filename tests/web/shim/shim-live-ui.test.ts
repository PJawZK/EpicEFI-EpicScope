import { describe, expect, it } from 'vitest';
import { sameOriginShimTelemetryUrl, shimDeliveryRate } from '../../../apps/web/src/app/shim-live-ui';

describe('shim live UI helpers', () => {
  it('builds same-origin telemetry URLs for HTTP and HTTPS hosts', () => {
    expect(sameOriginShimTelemetryUrl({ protocol: 'http:', host: '192.168.4.1:29002' } as Location)).toBe('ws://192.168.4.1:29002/telemetry');
    expect(sameOriginShimTelemetryUrl({ protocol: 'https:', host: 'shim.example:29002' } as Location)).toBe('wss://shim.example:29002/telemetry');
  });

  it('uses a conservative delivery rate without exceeding the negotiated maximum', () => {
    expect(shimDeliveryRate(50)).toBe(10);
    expect(shimDeliveryRate(6)).toBe(6);
    expect(shimDeliveryRate(0.5)).toBe(1);
  });
});
