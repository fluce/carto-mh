import { db } from "../persistence/db.ts";
import { getToken } from '../dataWorker.ts';
import type { MonsterRecord, SourceItem } from '../../shared/types';

const monsterCacheTtlMs = 96 * 60 * 60 * 1000;

async function query(ids: Array<Pick<MonsterRecord, 'id'> & { name?: string }>): Promise<MonsterRecord[]> {
    const response = await fetch('/api/monsters', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getToken()}`
        },
        body: JSON.stringify(ids)
    });
    return (await response.json() as MonsterRecord[]).filter((monster): monster is MonsterRecord => monster.id !== undefined);
}

export async function enrichMonstersFromCache(monsters: Array<SourceItem>): Promise<void> {
    await Promise.all(
        monsters.map(async (monster) => {
            monster.details ??= await db.get('monsters', monster.id);
        })
    );    
}

export async function queryMonsters(ids: Array<Pick<MonsterRecord, 'id'> & { name?: string }>): Promise<MonsterRecord[]> {
    const cached = await Promise.all(
        ids.map(({ id }) => db.get('monsters', String(id)))
    );
    const now = Date.now();
    const missing = ids.filter((_, index) => {
        const lastRefresh = Date.parse(cached[index]?.lastRefresh ?? '');
        return !Number.isFinite(lastRefresh) || now - lastRefresh >= monsterCacheTtlMs;
    });
    const fetched = missing.length > 0 ? await query(missing) : [];
    const fetchedById = new Map<string, MonsterRecord>();
    const lastRefresh = new Date().toISOString();

    for (const monster of fetched ?? []) {
        const refreshedMonster = { ...monster, lastRefresh };
        fetchedById.set(monster.id, refreshedMonster);
        console.log(`Fetched and cached monster with id ${monster.id}`);
        await db.put('monsters', refreshedMonster, monster.id);
    }
    for (const { id } of missing) {
        if (fetchedById.has(id)) {
            continue;
        }
        await db.put('monsters', { id, lastRefresh }, id);
    }

    return ids
        .map(({ id }, index) => fetchedById.get(String(id)) ?? cached[index])
        .filter((monster): monster is MonsterRecord => monster !== undefined);
}


