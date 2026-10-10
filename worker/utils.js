export function jsonResponse(body, status, headers) {
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
export async function fetchAndDecode(url, decoderToUse=decoder) {
    const res = await fetch(url);
    const data = await res.arrayBuffer();
    return decoderToUse.decode(data);
}


