
import { getCredentials } from '../auth/sessions.ts';
import { fetchAndDecode, utf8decoder } from '../shared/utils.ts';
import { TROLLS_URL } from '../shared/config.ts';
import type { ResponseHeaders, WorkerEnv } from '../shared/types.ts';

export async function loadTrolls(env: WorkerEnv): Promise<string> {
    
    const data=await fetchAndDecode(TROLLS_URL, utf8decoder);

    await env.GLOBAL_DATA.put('trolls', data);

    return data;
}

export async function fetchTrolls(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {

    const credentials = await getCredentials(request.headers, env);

    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }
    
    let data = await env.GLOBAL_DATA.get('trolls');
    if (!data) {
        data = await loadTrolls(env);
        if (!data) {
            return new Response('Failed to load trolls data', { status: 500, headers: respHeaders });
        }
    }
    return new Response(data, { headers: {
        ...respHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
    }, status: 200 });
}