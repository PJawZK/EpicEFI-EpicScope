import { describe, expect, it, vi } from 'vitest';
import {
  SHIM_HTTP_ROUTES,
  ShimHttpReadOnlyClient,
} from '../../../apps/web/src/adapters/shim/shim-http-client';

describe('ShimHttpReadOnlyClient', () => {
  it('builds same-origin documented route URLs', () => {
    const client = new ShimHttpReadOnlyClient('http://localhost:29002/some/path?x=1#hash', vi.fn() as typeof fetch);
    expect(client.urlFor('inis')).toBe('http://localhost:29002/api/v1/inis');
    expect(client.urlFor('objects')).toBe('http://localhost:29002/api/v1/objects');
    expect(client.urlFor('triggerlog')).toBe('http://localhost:29002/api/v1/triggerlog');
    expect(SHIM_HTTP_ROUTES).toEqual({
      inis: '/api/v1/inis',
      objects: '/api/v1/objects',
      triggerlog: '/api/v1/triggerlog',
    });
  });

  it('uses GET-only same-origin inspection semantics and parses JSON without interpreting it', async () => {
    const fetchImpl = vi.fn(async () => new Response(
      JSON.stringify({ opaque: { value: 42 } }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as unknown as typeof fetch;
    const client = new ShimHttpReadOnlyClient('https://shim.example/', fetchImpl);

    const result = await client.inspect('objects');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('https://shim.example/api/v1/objects', expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    }));
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.json).toEqual({ opaque: { value: 42 } });
    expect(result.jsonError).toBeUndefined();
  });

  it('keeps non-JSON and HTTP error responses inspectable', async () => {
    const fetchImpl = vi.fn(async () => new Response(
      'not json',
      { status: 404, statusText: 'Not Found', headers: { 'content-type': 'text/plain' } },
    )) as unknown as typeof fetch;
    const client = new ShimHttpReadOnlyClient('http://shim.local/', fetchImpl);

    const result = await client.inspect('triggerlog');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.statusText).toBe('Not Found');
    expect(result.text).toBe('not json');
    expect(result.json).toBeUndefined();
    expect(result.jsonError).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it('reports transport failures instead of throwing', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    const client = new ShimHttpReadOnlyClient('http://shim.local/', fetchImpl);

    await expect(client.inspect('inis')).resolves.toMatchObject({
      route: 'inis',
      ok: false,
      status: undefined,
      error: 'network down',
    });
  });

  it('rejects non-HTTP origins', () => {
    expect(() => new ShimHttpReadOnlyClient('file:///tmp/')).toThrow(/Unsupported shim HTTP origin protocol/);
  });
});
