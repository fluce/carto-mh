
import { getToken } from '../dataWorker.mjs';
import { updateIndex } from './index.mjs';

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

export async function loadTrolls(guildNames) {
    const data = await load();
    const trolls = parse(data, guildNames);
    await updateIndex('troll', trolls);
    console.log("Loaded trolls data:", trolls);
}

function parse(data, guildNames)
{
    return data.split("\n").filter(line => line.length > 0).map(line => parseLine(line, guildNames));
}

function parseLine(line, guildNames)
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
