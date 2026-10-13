import { LOCATIONS_URL, TGV_URL } from '../shared/config.ts';
import { fetchAndDecode, decoder, utf8decoder, jsonResponse } from '../shared/utils.ts';
import { getCredentials } from '../auth/sessions.ts';
import type { ResponseHeaders, WorkerEnv } from '../shared/types.ts';

export async function fetchRawLocations(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {
    const credentials = await getCredentials(request.headers, env);

    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }

    const query = new URLSearchParams(new URL(request.url).search);
    const typeLieux = query.get('typeLieu');

    const html = await fetchAndDecode(`${LOCATIONS_URL}?search=position&orderBy=distance&posx=&posy=&posn=&typeLieu=${typeLieux}`, typeLieux ? utf8decoder : decoder);
    return new Response(html, { status: 200, headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function fetchTGVLocations(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {
    const credentials = await getCredentials(request.headers, env);

    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }

    const json: unknown = await (await fetch(TGV_URL)).json();
    return jsonResponse(json, 200, respHeaders);
}

export async function fetchLocations(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {
    const credentials = await getCredentials(request.headers, env);

    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }

    const data = await env.GLOBAL_DATA.get('locations', { type: 'json' });
    if (data === null) {
        return new Response('No locations found', { status: 404, headers: respHeaders });
    }
    
    return jsonResponse( data, 200, respHeaders);
}

export async function updateLocations(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {
    const credentials = await getCredentials(request.headers, env);

    if (!credentials || !credentials.isAdmin) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }

    const body: unknown = await request.json();
    await env.GLOBAL_DATA.put('locations', JSON.stringify(body));
    return new Response('Locations updated', { status: 200, headers: respHeaders });
}



