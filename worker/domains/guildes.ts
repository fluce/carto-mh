import { getCredentials } from '../auth/sessions.ts';
import { GUILDES_URL } from '../shared/config.ts';
import { getCacheHeaders, getOrInitializeTimestamp, jsonResponse, notModifiedResponse } from '../shared/utils.ts';
import type { ResponseHeaders, WorkerEnv } from '../shared/types.ts';

export async function loadGuildes(env: WorkerEnv): Promise<unknown[]> {
    const response = await fetch(GUILDES_URL);
    if (!response.ok) {
        throw new Error(`Guildes request failed: ${response.status}`);
    }

    const guildes: unknown = await response.json();
    if (!Array.isArray(guildes)) {
        throw new TypeError('Guildes response must be an array');
    }

    await env.GLOBAL_DATA.put('guildes', JSON.stringify(guildes));
    await env.GLOBAL_DATA.put('guildes:updatedAt', String(Date.now()));
    return guildes;
}

export async function fetchGuildes(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {
    const credentials = await getCredentials(request.headers, env);
    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }

    let guildes = await env.GLOBAL_DATA.get('guildes', { type: 'json' });
    if (guildes === null) {
        guildes = await loadGuildes(env);
        if (guildes === null) {
            return new Response('No guildes found', { status: 404, headers: respHeaders });
        }
    }

    const updatedAt = await getOrInitializeTimestamp(env.GLOBAL_DATA, 'guildes:updatedAt');
    const notModified = notModifiedResponse(request, updatedAt, respHeaders);
    if (notModified) {
        return notModified;
    }

    return jsonResponse(guildes, 200, getCacheHeaders(respHeaders, updatedAt));
}