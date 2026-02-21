import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUTH_UPSTREAM_COOKIE_KEY = 'opengater_auth_upstream';

const UPSTREAM_BASE_URLS = [
  'https://reauth.cloud/api',
  'https://reauth.cloud',
  'https://cdn.opngtr.ru/api',
  'https://opngtr.com/api',
  'https://cdn.opngtr.ru',
  'https://opngtr.com',
  // 'https://auth.bot.lk.eutochkin.com',
  // 'https://auth.bot.lk.eutochkin.com/api',
  // 'https://api.bot.eutochkin.com/api',
  // 'https://api.bot.eutochkin.com',
  // 'https://auth.bot.eutochkin.com',
];

// Hop-by-hop заголовки нельзя проксировать.
const hopByHopHeaders = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  // Тело от fetch уже распаковано, поэтому content-encoding нужно убрать.
  'content-encoding',
]);

const buildUpstreamUrl = (baseUrl: string, req: NextRequest, pathParts: string[] = []) => {
  let safeParts = Array.isArray(pathParts) ? pathParts : [String(pathParts)];
  if (!safeParts.length) {
    const rawPath = req.nextUrl.pathname.replace(/^\/api\/auth\/?/, '');
    safeParts = rawPath ? rawPath.split('/').filter(Boolean) : [];
  }
  const path = safeParts.join('/');
  const url = new URL(`${baseUrl}/${path}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });
  return url;
};

const getPreferredUpstreams = (req: NextRequest): string[] => {
  if (!UPSTREAM_BASE_URLS.length) return [];
  const raw = req.cookies.get(AUTH_UPSTREAM_COOKIE_KEY)?.value;
  if (!raw) return UPSTREAM_BASE_URLS;
  let preferred = '';
  try {
    preferred = decodeURIComponent(raw);
  } catch {
    preferred = raw;
  }
  if (!UPSTREAM_BASE_URLS.includes(preferred)) {
    return UPSTREAM_BASE_URLS;
  }
  return [preferred, ...UPSTREAM_BASE_URLS.filter((item) => item !== preferred)];
};

const proxyRequest = async (req: NextRequest, pathParts: string[]) => {
  const requestBody = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : null;
  let lastError: Error | null = null;

  let lastAuthResponse: { response: Response; baseUrl: string } | null = null;

  const buildResponse = async (upstreamResponse: Response, baseUrl: string) => {
    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value, key) => {
      if (!hopByHopHeaders.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });
    responseHeaders.set('x-auth-upstream', baseUrl);
    const currentCookie = req.cookies.get(AUTH_UPSTREAM_COOKIE_KEY)?.value || '';
    const encoded = encodeURIComponent(baseUrl);
    if (currentCookie !== encoded) {
      responseHeaders.append(
        'Set-Cookie',
        `${AUTH_UPSTREAM_COOKIE_KEY}=${encoded}; Path=/; Max-Age=86400; SameSite=Lax`
      );
    }

    const body = await upstreamResponse.arrayBuffer();

    return new Response(body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  };

  const upstreams = getPreferredUpstreams(req);
  for (const baseUrl of upstreams) {
    try {
      const url = buildUpstreamUrl(baseUrl, req, pathParts);
      const headers = new Headers();

      req.headers.forEach((value, key) => {
        if (!hopByHopHeaders.has(key.toLowerCase())) {
          headers.set(key, value);
        }
      });

      const origin = new URL(baseUrl).origin;
      headers.set('origin', origin);
      headers.set('referer', `${origin}/`);
      headers.set(
        'user-agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      );
      headers.set('accept', 'application/json, text/plain, */*');

      const init: RequestInit = {
        method: req.method,
        headers,
        redirect: 'manual',
        cache: 'no-store',
      };

      if (requestBody !== null) {
        init.body = requestBody;
      }

      const upstreamResponse = await fetch(url.toString(), init);
      if (!upstreamResponse.ok) {
        if ([401, 403].includes(upstreamResponse.status)) {
          lastAuthResponse = { response: upstreamResponse, baseUrl };
          continue;
        }
        const shouldTryNext = [404, 500, 502, 503, 504].includes(upstreamResponse.status);
        if (shouldTryNext) {
          lastError = new Error(`Upstream ${baseUrl} responded ${upstreamResponse.status}`);
          continue;
        }
      }

      return buildResponse(upstreamResponse, baseUrl);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown proxy error');
    }
  }

  if (lastAuthResponse) {
    return buildResponse(lastAuthResponse.response, lastAuthResponse.baseUrl);
  }

  const message = lastError?.message || 'Unknown proxy error';
  return new Response(
    JSON.stringify({ error: 'Proxy request failed', message }),
    {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

export async function GET(req: NextRequest) {
  return proxyRequest(req, []);
}

export async function POST(req: NextRequest) {
  return proxyRequest(req, []);
}

export async function PUT(req: NextRequest) {
  return proxyRequest(req, []);
}

export async function PATCH(req: NextRequest) {
  return proxyRequest(req, []);
}

export async function DELETE(req: NextRequest) {
  return proxyRequest(req, []);
}
