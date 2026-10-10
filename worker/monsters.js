
import { getCredentials } from './sessions.js';
import { MZMONSTERS_URL } from './config.js';

export async function queryMz(items) {
    
    console.log("items",items);
    const query = items.map((item,index)=> ({ index, id: item.id, nom: item.name }));

    const res = await fetch(MZMONSTERS_URL, { method: "POST", body: new URLSearchParams({l:JSON.stringify(query)}), headers: { "Content-Type": "application/x-www-form-urlencoded" } });

    if (res.ok) {
        const data=await res.json();
        console.log("results",data);
        return data;
    }
    console.error("Error getting MZ info",res.status);
}

export async function queryMonstersAttributes(request, env, respHeaders) {

    //const credentials = await getCredentials(request.headers, env);

    /*if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }*/

    const data = await queryMz(await request.json())
    return new Response(JSON.stringify(data), { headers: {
        ...respHeaders,
        'Content-Type': 'application/json; charset=utf-8',
    }, status: 200 });
}