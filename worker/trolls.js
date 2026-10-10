
import { getCredentials } from './sessions.js';
import { fetchAndDecode, utf8decoder } from './utils.js';
import { TROLLS_URL } from './config.js';

export async function loadTrolls(env) {
    
    const data=await fetchAndDecode(TROLLS_URL, utf8decoder);

    await env.GLOBAL_DATA.put('trolls', data);

    return data;
}

export async function fetchTrolls(request, env, respHeaders) {

    const credentials = await getCredentials(request.headers, env);

    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }
    
    const data = await env.GLOBAL_DATA.get('trolls');
    return new Response(data, { headers: {
        ...respHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
    }, status: 200 });
}