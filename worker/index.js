import { fetchView } from './view.js';
import { createToken } from './sessions.js';
import { loadTrolls, fetchTrolls } from './trolls.js';
import { fetchRawLocations, fetchLocations, fetchTGVLocations, updateLocations } from './locations.js';
import { queryMonstersAttributes } from './monsters.js';

export default {
    async fetch(request, env) {
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
        case 'GET /api/view':
            return await fetchView(request, env, respHeaders);
        case 'GET /api/trolls':
            return await fetchTrolls(request, env, respHeaders);
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
                loadLocations(env)
            ]);
            return new Response('Reloaded', { status: 200, headers: respHeaders });
        }
        default:
            return new Response('Not found', { status: 404, headers: respHeaders });
        }
    },
	async scheduled(controller, env, ctx) {
        ctx.waitUntil(Promise.all([
            loadTrolls(env),
            loadLocations(env)
        ]));
        console.log("cron processed");
    },
};

function getAllowedOrigins(env) {
    return (env.ALLOWED_ORIGINS ?? env.ALLOWED_ORIGIN ?? '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
}

function isAllowedOrigin(origin, allowedOrigins) {
    if (!origin) return true;
    return Boolean(origin && allowedOrigins.includes(origin));
}

function corsHeaders(origin, allowedOrigins) {
    const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Vary': 'Origin',
    };

    if (isAllowedOrigin(origin, allowedOrigins)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }

    return headers;
}