import { getCredentials } from '../auth/sessions.ts';
import { UPSTREAM_URL } from '../shared/config.ts';
import type { CachedView, ResponseHeaders, WorkerEnv } from '../shared/types.ts';

export async function fetchView(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {

    const credentials = await getCredentials(request.headers, env);

    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }

    const { id, secret } = credentials;

    const { force } = Object.fromEntries(new URL(request.url).searchParams);

    console.log('[VIEW] Fetching view for user:', id);

    const cachedData = await env.USER_DATA.get<CachedView>(`view:${id}`, { type: 'json' });
    if (cachedData?.data && !force) {
        console.log('[VIEW] Cache hit for user:', id);
        if (cachedData.updateDate && cachedData.updateDate>(Date.now()-12*60*60*1000)) {
            return new Response(cachedData.data, { status: 200, 
                headers: {
                    ...respHeaders,
                    'Content-Type': 'text/plain; charset=utf-8',
                }
            });
        }
    }

    console.log('[VIEW] Cache miss for user:', id);
    const upstreamUrl = new URL(UPSTREAM_URL);
    upstreamUrl.search = new URLSearchParams({
        Numero: id,
        Motdepasse: secret,
        Tresors: '1',
        Lieux: '1',
        Champignons: '1',
    }).toString();

    try {
        console.log('[VIEW] Fetching data from upstream for user:', id);
        const upstreamResponse = await fetch(upstreamUrl, { method: 'GET' });
        const data = await upstreamResponse.arrayBuffer();
        const decodedData = new TextDecoder('iso-8859-1').decode(data);

        if (decodedData.startsWith('Erreur')) {
            if (decodedData.startsWith('Erreur 3 ')) {
                return new Response('Unauthorized', { status: 401, headers: respHeaders });
            }
            return new Response('Upstream returned an error', { status: 502, headers: respHeaders });
        }

        await env.USER_DATA.put(`view:${id}`, JSON.stringify({ data: decodedData, updateDate: Date.now() }), { expirationTtl: 12*60*60 });
        return new Response(decodedData, {
            status: upstreamResponse.status,
            headers: {
                ...Object.fromEntries(upstreamResponse.headers),
                ...respHeaders,
                'Content-Type': 'text/plain; charset=utf-8',
            },
        });
    } catch {
        return new Response('Upstream request failed', { status: 502, headers: respHeaders });
    }
}

