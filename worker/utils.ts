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


export const decoder = new TextDecoder("iso-8859-1");
export const utf8decoder = new TextDecoder("utf-8");
export async function fetchAndDecode(url: string, decoderToUse: TextDecoder = decoder): Promise<string> {
    const res = await fetch(url);
    const data = await res.arrayBuffer();
    return decoderToUse.decode(data);
}


