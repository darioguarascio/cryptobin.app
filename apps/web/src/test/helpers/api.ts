import type { APIContext, APIRoute } from 'astro';

type CallApiOptions = {
  method?: string;
  url?: string;
  body?: unknown;
  cookie?: string;
  params?: Record<string, string | undefined>;
};

function minimalContext(request: Request, url: string, params: Record<string, string | undefined>): APIContext {
  return {
    request,
    params,
    url: new URL(url),
    redirect: () => {
      throw new Error('redirect not supported in callApi');
    },
    cookies: {
      get: () => undefined,
      set: () => {},
      delete: () => {},
      has: () => false,
      headers: () => new Headers(),
    },
    locals: {},
    clientAddress: '127.0.0.1',
    generator: 'vitest',
    props: {},
  } as unknown as APIContext;
}

export async function callApi(handler: APIRoute, options: CallApiOptions = {}): Promise<Response> {
  const {
    method = 'GET',
    url = 'http://localhost/api/test',
    body,
    cookie,
    params = {},
  } = options;

  const headers = new Headers();
  if (body !== undefined) {
    headers.set('content-type', 'application/json');
  }
  if (cookie) {
    headers.set('cookie', cookie);
  }

  const request = new Request(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return handler(minimalContext(request, url, params));
}

export function sessionCookieFromResponse(response: Response): string {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Expected Set-Cookie on response');
  }
  return setCookie.split(';')[0]?.trim() ?? '';
}

export async function signInCookie(options: {
  handle: string;
  masterPassword: string;
}): Promise<string> {
  const { PUT } = await import('@/pages/api/auth/index');
  const response = await callApi(PUT, {
    method: 'PUT',
    url: 'http://localhost/api/auth',
    body: {
      handle: options.handle,
      masterPassword: options.masterPassword,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sign-in failed (${response.status}): ${text}`);
  }

  return sessionCookieFromResponse(response);
}
