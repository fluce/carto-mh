import type { ResponseHeaders } from './types.ts';

export function jsonResponse(body: unknown, status: number, headers: ResponseHeaders): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...headers,
            'Content-Type': 'application/json; charset=utf-8',
        },
    });
}

export function getCacheHeaders(headers: ResponseHeaders, lastModified: number): ResponseHeaders {
    const vary = new Set((headers.Vary ?? '').split(',').map(value => value.trim()).filter(Boolean));
    vary.add('Authorization');
    return {
        ...headers,
        'Vary': [...vary].join(', '),
        'Cache-Control': 'private, no-cache, must-revalidate',
        'Last-Modified': new Date(lastModified).toUTCString(),
    };
}

export function notModifiedResponse(request: Request, lastModified: number, headers: ResponseHeaders): Response | null {
    const ifModifiedSince = request.headers.get('If-Modified-Since');
    if (!ifModifiedSince) {
        return null;
    }

    const requestDate = Date.parse(ifModifiedSince);
    if (!Number.isFinite(requestDate) || Math.floor(lastModified / 1000) * 1000 > requestDate) {
        return null;
    }

    console.log(`[CACHE] Returning 304 Not Modified for ${new URL(request.url).pathname}`);
    return new Response(null, {
        status: 304,
        headers: getCacheHeaders(headers, lastModified),
    });
}

export async function getOrInitializeTimestamp(kv: KVNamespace, key: string): Promise<number> {
    const stored = await kv.get(key);
    if (stored !== null) {
        const timestamp = Number(stored);
        if (!Number.isFinite(timestamp)) {
            throw new TypeError(`Invalid timestamp stored at ${key}`);
        }
        return timestamp;
    }

    const timestamp = Date.now();
    await kv.put(key, String(timestamp));
    return timestamp;
}

export const decoder = new TextDecoder("iso-8859-1");
export const utf8decoder = new TextDecoder("utf-8");
export async function fetchAndDecode(url: string, decoderToUse: TextDecoder = decoder): Promise<string> {
    const res = await fetch(url);
    const data = await res.arrayBuffer();
    return decoderToUse.decode(data);
}
