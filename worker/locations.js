import { LOCATIONS_URL, TGV_URL } from './config.js';
import { fetchAndDecode, decoder, utf8decoder, jsonResponse } from './utils.js';
import { getCredentials } from './sessions.js';

export async function fetchRawLocations(request, env, respHeaders) {
    const credentials = await getCredentials(request.headers, env);

    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }

    const query = new URLSearchParams(new URL(request.url).search);
    const typeLieux = query.get('typeLieu');

    const html = await fetchAndDecode(`${LOCATIONS_URL}?search=position&orderBy=distance&posx=&posy=&posn=&typeLieu=${typeLieux}`, typeLieux ? utf8decoder : decoder);
    return new Response(html, { status: 200, headers: { ...respHeaders, 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function fetchTGVLocations(request, env, respHeaders) {
    const credentials = await getCredentials(request.headers, env);

    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }

    const json = await (await fetch(TGV_URL)).json();
    return jsonResponse(json, 200, respHeaders);
}

export async function fetchLocations(request, env, respHeaders) {
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

export async function updateLocations(request, env, respHeaders) {
    const credentials = await getCredentials(request.headers, env);

    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }

    const body = await request.json();
    await env.GLOBAL_DATA.put('locations', JSON.stringify(body));
    return new Response('Locations updated', { status: 200, headers: respHeaders });
}



