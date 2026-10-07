export const SHIM_HTTP_ROUTES = {
  inis: '/api/v1/inis',
  objects: '/api/v1/objects',
  triggerlog: '/api/v1/triggerlog',
} as const;

export type ShimHttpRoute = keyof typeof SHIM_HTTP_ROUTES;

export interface ShimHttpInspection {
  readonly route: ShimHttpRoute;
  readonly path: string;
  readonly url: string;
  readonly ok: boolean;
  readonly status: number | undefined;
  readonly statusText: string;
  readonly contentType: string;
  readonly elapsedMs: number;
  readonly text: string;
  readonly json: unknown | undefined;
  readonly jsonError: string | undefined;
  readonly error: string | undefined;
}

export type ShimHttpFetch = typeof fetch;

function normalizeBaseOrigin(origin: string | URL): URL {
  const url = origin instanceof URL ? new URL(origin.href) : new URL(origin);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported shim HTTP origin protocol: ${url.protocol}`);
  }
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}

export class ShimHttpReadOnlyClient {
  readonly #baseOrigin: URL;
  readonly #fetch: ShimHttpFetch;

  constructor(baseOrigin: string | URL, fetchImpl: ShimHttpFetch = fetch) {
    this.#baseOrigin = normalizeBaseOrigin(baseOrigin);
    this.#fetch = fetchImpl;
  }

  urlFor(route: ShimHttpRoute): string {
    return new URL(SHIM_HTTP_ROUTES[route], this.#baseOrigin).href;
  }

  async inspect(route: ShimHttpRoute, signal?: AbortSignal): Promise<ShimHttpInspection> {
    const path = SHIM_HTTP_ROUTES[route];
    const url = this.urlFor(route);
    const started = globalThis.performance?.now() ?? Date.now();

    try {
      const response = await this.#fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'same-origin',
        ...(signal ? { signal } : {}),
      });
      const text = await response.text();
      const contentType = response.headers.get('content-type') ?? '';
      let json: unknown | undefined;
      let jsonError: string | undefined;
      if (text.trim()) {
        try {
          json = JSON.parse(text) as unknown;
        } catch (error) {
          jsonError = error instanceof Error ? error.message : 'Response was not valid JSON.';
        }
      }

      return {
        route,
        path,
        url,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        contentType,
        elapsedMs: (globalThis.performance?.now() ?? Date.now()) - started,
        text,
        json,
        jsonError,
        error: undefined,
      };
    } catch (error) {
      return {
        route,
        path,
        url,
        ok: false,
        status: undefined,
        statusText: '',
        contentType: '',
        elapsedMs: (globalThis.performance?.now() ?? Date.now()) - started,
        text: '',
        json: undefined,
        jsonError: undefined,
        error: error instanceof Error ? error.message : 'Unknown shim HTTP request failure.',
      };
    }
  }

  inspectAll(signal?: AbortSignal): Promise<readonly ShimHttpInspection[]> {
    return Promise.all((Object.keys(SHIM_HTTP_ROUTES) as ShimHttpRoute[])
      .map((route) => this.inspect(route, signal)));
  }
}
