
import { MZMONSTERS_URL } from '../shared/config.ts';
import type { ResponseHeaders, WorkerEnv, MonsterLookupItem } from '../shared/types.ts';

export async function queryMz(items: MonsterLookupItem[]): Promise<unknown> {
    
    console.log("items",items);
    const query = items.map((item,index)=> ({ index, id: item.id, nom: item.name }));

    const res = await fetch(MZMONSTERS_URL, { method: "POST", body: new URLSearchParams({l:JSON.stringify(query)}), headers: { "Content-Type": "application/x-www-form-urlencoded" } });

    if (res.ok) {
        const data: unknown = await res.json();
        console.log("data", data);
        return data;
    }
    console.error("Error getting MZ info",res.status);
}

export async function queryMonstersAttributes(request: Request, _env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {

    //const credentials = await getCredentials(request.headers, env);

    /*if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }*/

    const data = await queryMz(await request.json() as MonsterLookupItem[])
    return new Response(JSON.stringify(data), { headers: {
        ...respHeaders,
        'Content-Type': 'application/json; charset=utf-8',
    }, status: 200 });
}