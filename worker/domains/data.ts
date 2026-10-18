import { getCredentials } from '../auth/sessions.ts';
import { jsonResponse } from '../shared/utils.ts';
import type { ResponseHeaders, WorkerEnv } from '../shared/types.ts';

interface StoredUserData {
    data: unknown;
    etag: string;
}

const INITIAL_ETAG = '"0"';

export async function fetchUserData(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {
    const credentials = await getCredentials(request.headers, env);
    if (!credentials) {
        return jsonResponse({ error: 'Unauthorized' }, 401, respHeaders);
    }

    try {
        const stored = await env.USER_DATA.get<StoredUserData>(`data:${credentials.id}`, { type: 'json' });
        const data = stored?.data ?? null;
        const etag = stored?.etag ?? INITIAL_ETAG;
        return jsonResponse(data, 200, { ...respHeaders, ETag: etag });
    } catch (error) {
        console.error('Unable to read user data:', error);
        return jsonResponse({ error: 'Unable to read user data' }, 500, respHeaders);
    }
}

export async function updateUserData(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {
    const credentials = await getCredentials(request.headers, env);
    if (!credentials) {
        return jsonResponse({ error: 'Unauthorized' }, 401, respHeaders);
    }

    const expectedEtag = request.headers.get('If-Match');
    if (!expectedEtag) {
        return jsonResponse({ error: 'If-Match header is required' }, 428, respHeaders);
    }

    let data: unknown;
    try {
        data = await request.json();
    } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, 400, respHeaders);
    }

    const key = `data:${credentials.id}`;
    try {
        const stored = await env.USER_DATA.get<StoredUserData>(key, { type: 'json' });
        const currentEtag = stored?.etag ?? INITIAL_ETAG;
        if (expectedEtag !== currentEtag) {
            return jsonResponse(
                { error: 'ETag does not match the current user data', etag: currentEtag },
                412,
                { ...respHeaders, ETag: currentEtag },
            );
        }

        const etag = `"${crypto.randomUUID()}"`;
        await env.USER_DATA.put(key, JSON.stringify({ data, etag } satisfies StoredUserData));
        return jsonResponse({ etag }, 200, { ...respHeaders, ETag: etag });
    } catch (error) {
        console.error('Unable to write user data:', error);
        return jsonResponse({ error: 'Unable to write user data' }, 500, respHeaders);
    }
}
