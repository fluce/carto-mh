import { getToken } from '../dataWorker.ts';
import { updateIndex } from '.';

interface GuildRecord extends Record<string, unknown> {
    ID: string | number;
    Nom: string;
}

async function load() {
    const response = await fetch('/api/guildes', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`
        }
    });
    if (!response.ok) {
        throw new Error(`Unable to load guildes: ${response.status}`);
    }
    return await response.json() as unknown;
}

export async function loadGuildes() {
    const data = await load();
    if (!Array.isArray(data)) {
        throw new TypeError('Guildes response must be an array');
    }
    const guildes = data
        .filter(isGuildRecord)
        .map(guild => ({ ...guild, id: `guild:${guild.ID}`, name: guild.Nom }));
    await updateIndex('guilds', guildes);
    return new Map<string, string>(guildes.map(guild => [guild.id, guild.name]));
}

function isGuildRecord(value: unknown): value is GuildRecord {
    return typeof value === 'object' && value !== null &&
        'ID' in value && (typeof value.ID === 'string' || typeof value.ID === 'number') &&
        'Nom' in value && typeof value.Nom === 'string';
}