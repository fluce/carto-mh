
import { getToken } from '../dataWorker.ts';
import { updateIndex } from './index.ts';
import type { SourceItem } from '../types';

interface TrollRecord extends SourceItem {
    race: string;
    level: string;
    guild: { id: string; guildId: string; name: string | null } | null;
}

async function load() {
    const response = await fetch('/api/trolls', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`
        }
    });
    return await response.text();
}

export async function loadTrolls(guildNames: ReadonlyMap<string, string>) {
    const data = await load();
    const trolls = parse(data, guildNames);
    await updateIndex('troll', trolls);
    console.log("Loaded trolls data:", trolls);
}

function parse(data: string, guildNames: ReadonlyMap<string, string>): TrollRecord[]
{
    return data.split("\n").filter(line => line.length > 0).map(line => parseLine(line, guildNames));
}

function parseLine(line: string, guildNames: ReadonlyMap<string, string>): TrollRecord
{
    const items=line.split(";");
    const guildId = items[6] ? `guild:${items[6]}` : null;
    return {
        id: items[0],
        name: items[1],
        race: items[2],
        level: items[3],
        guild: guildId ? {
            id: guildId,
            guildId: items[6],
            name: guildNames.get(guildId) ?? null
        } : null
    };
}
