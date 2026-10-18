import { fetchView } from './domains/view.ts';
import { createToken, getProfile } from './auth/sessions.ts';
import { loadTrolls, fetchTrolls } from './domains/trolls.ts';
import { loadGuildes, fetchGuildes } from './domains/guildes.ts';
import { fetchRawLocations, fetchLocations, fetchTGVLocations, updateLocations } from './domains/locations.ts';
import { queryMonstersAttributes } from './domains/monsters.ts';
import { fetchInventory } from './domains/inventory.ts';
import { fetchUserData, updateUserData } from './domains/data.ts';
import type { ResponseHeaders, WorkerEnv } from './shared/types.ts';

export default {
    async fetch(request: Request, env: WorkerEnv): Promise<Response> {
        const origin = request.headers.get('Origin');
        const allowedOrigins = getAllowedOrigins(env);
        const respHeaders = corsHeaders(origin, allowedOrigins);

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: respHeaders });
        }

        if (!isAllowedOrigin(origin, allowedOrigins)) {
            return new Response('Forbidden', { status: 403, headers: respHeaders });
        }

        const requestUrl = new URL(request.url);
        const route = `${request.method} ${requestUrl.pathname}`;

        switch (route) {
        case 'POST /api/token':
            return await createToken(request, env, respHeaders);
        case 'GET /api/profile':
            return await getProfile(request, env, respHeaders);
        case 'GET /api/view':
            return await fetchView(request, env, respHeaders);
        case 'GET /api/trolls':
            return await fetchTrolls(request, env, respHeaders);
        case 'GET /api/guildes':
            return await fetchGuildes(request, env, respHeaders);
        case 'GET /api/inventory':
            return await fetchInventory(request, env, respHeaders);
        case 'GET /api/data':
            return await fetchUserData(request, env, respHeaders);
        case 'PUT /api/data':
            return await updateUserData(request, env, respHeaders);
        case 'GET /api/locations':
            return await fetchLocations(request, env, respHeaders);
        case 'PUT /api/locations':
            return await updateLocations(request, env, respHeaders);
        case 'GET /api/locations/raw':
            return await fetchRawLocations(request, env, respHeaders);
        case 'GET /api/locations/tgv':
            return await fetchTGVLocations(request, env, respHeaders);
        case 'POST /api/monsters':
            return await queryMonstersAttributes(request, env, respHeaders);
        case 'GET /api/reload': {
            await Promise.all([
                loadTrolls(env),
                loadGuildes(env)
            ]);
            return new Response('Reloaded', { status: 200, headers: respHeaders });
        }
        default:
            return new Response('Not found', { status: 404, headers: respHeaders });
        }
    },
    async scheduled(_controller: ScheduledController, env: WorkerEnv, ctx: ExecutionContext): Promise<void> {
        ctx.waitUntil(Promise.all([
            loadTrolls(env),
            loadGuildes(env)
        ]));
        console.log("cron processed");
    },
};

function getAllowedOrigins(env: WorkerEnv): string[] {
    const legacyOrigin = (env as WorkerEnv & { ALLOWED_ORIGIN?: string }).ALLOWED_ORIGIN;
    return (env.ALLOWED_ORIGINS ?? legacyOrigin ?? '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
}

function isAllowedOrigin(origin: string | null, allowedOrigins: string[]): boolean {
    if (!origin) return true;
    return Boolean(origin && allowedOrigins.includes(origin));
}

function corsHeaders(origin: string | null, allowedOrigins: string[]): ResponseHeaders {
    const headers: ResponseHeaders = {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, If-Modified-Since, If-Match',
        'Access-Control-Expose-Headers': 'ETag, Last-Modified',
        'Vary': 'Origin',
    };

    if (origin && isAllowedOrigin(origin, allowedOrigins)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}