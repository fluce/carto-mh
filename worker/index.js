const UPSTREAM_URL = 'https://sp.mountyhall.com/SP_Vue2.php';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowedOrigins = getAllowedOrigins(env);
    const headers = corsHeaders(origin, allowedOrigins);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    const requestUrl = new URL(request.url);
    if (requestUrl.pathname !== '/vue' || request.method !== 'GET') {
      return new Response('Not found', { status: 404, headers });
    }

    if (!isAllowedOrigin(origin, allowedOrigins)) {
      return new Response('Forbidden', { status: 403, headers });
    }

    if (!env.MH_USER_ID || !env.MH_USER_SECRET) {
      return new Response('Relay credentials are not configured', {
        status: 500,
        headers,
      });
    }

    const upstreamUrl = new URL(UPSTREAM_URL);
    upstreamUrl.search = new URLSearchParams({
      Numero: env.MH_USER_ID,
      Motdepasse: env.MH_USER_SECRET,
      Tresors: '1',
      Lieux: '1',
      Champignons: '1',
    });

    try {
      const upstreamResponse = await fetch(upstreamUrl, { method: 'POST' });
      return new Response(upstreamResponse.body, {
        status: upstreamResponse.status,
        headers: {
          ...Object.fromEntries(upstreamResponse.headers),
          ...headers,
        },
      });
    } catch {
      return new Response('Upstream request failed', { status: 502, headers });
    }
  },
};

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS ?? env.ALLOWED_ORIGIN ?? '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, allowedOrigins) {
  return Boolean(origin && allowedOrigins.includes(origin));
}

function corsHeaders(origin, allowedOrigins) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };

  if (isAllowedOrigin(origin, allowedOrigins)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }

  return headers;
}