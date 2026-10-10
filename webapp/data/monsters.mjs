import { db } from "./db.mjs";
import { getToken } from '../dataWorker.mjs';

async function query(ids) {
    const response = await fetch('/api/monsters', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify(ids)
    });
    return await response.json();
}

export async function queryMonsters(ids) {
    const cached = await Promise.all(
        ids.map(({ id }) => db.get('monsters', String(id)))
    );
    const missing = ids.filter((_, index) => cached[index] === undefined);
    const fetched = missing.length > 0 ? await query(missing) : [];
    const fetchedById = new Map();
    const lastRefresh = new Date().toISOString();

    for (const monster of fetched ?? []) {
        if (monster.id !== undefined) {
            const id = String(monster.id);
            const refreshedMonster = { ...monster, lastRefresh };
            fetchedById.set(id, refreshedMonster);
            await db.put('monsters', refreshedMonster, id);
        }
    }

    return ids
        .map(({ id }, index) => cached[index] ?? fetchedById.get(String(id)))
        .filter(monster => monster !== undefined);
}


