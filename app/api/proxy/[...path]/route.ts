import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UPSTREAM_BASE_URL = 'https://opngtr.com/api';

// Hop-by-hop заголовки нельзя форвардить через прокси.
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
]);

const buildUpstreamUrl = (req: NextRequest, pathParts: string[] = []) => {
  let safeParts = Array.isArray(pathParts) ? pathParts : [String(pathParts)];
  if (!safeParts.length) {
    const rawPath = req.nextUrl.pathname.replace(/^\/api\/proxy\/?/, '');
    safeParts = rawPath ? rawPath.split('/').filter(Boolean) : [];
  }
  const path = safeParts.join('/');
  const url = new URL(`${UPSTREAM_BASE_URL}/${path}`);
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });
  return url;
};

const proxyRequest = async (req: NextRequest, pathParts: string[]) => {
  try {
    const url = buildUpstreamUrl(req, pathParts);
    const headers = new Headers();

    req.headers.forEach((value, key) => {
      if (!hopByHopHeaders.has(key.toLowerCase())) {
        headers.set(key, value);
      }
    });

    // Для некоторых эндпоинтов upstream ожидает browser-like Origin/Referer.
    headers.set('origin', 'https://opngtr.com');
    headers.set('referer', 'https://opngtr.com/');
    headers.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    headers.set('accept', 'application/json, text/plain, */*');

    const init: RequestInit = {
      method: req.method,
      headers,
      redirect: 'manual',
      cache: 'no-store',
    };

    // Передаём body для всех запросов кроме GET/HEAD.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      init.body = await req.text();
    }

    const upstreamResponse = await fetch(url.toString(), init);
    const responseHeaders = new Headers();

    upstreamResponse.headers.forEach((value, key) => {
      if (!hopByHopHeaders.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    const body = await upstreamResponse.arrayBuffer();

    return new Response(body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown proxy error';
    return new Response(
      JSON.stringify({ error: 'Proxy request failed', message }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
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
