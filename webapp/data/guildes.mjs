import { getToken } from '../dataWorker.mjs';
import { updateIndex } from './index.mjs';

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
    return await response.json();
}

export async function loadGuildes() {
    const data = await load();
    const guildes = data
        .filter(guild => guild?.ID !== undefined && guild?.Nom !== undefined)
        .map(guild => ({ ...guild, id: `guild:${guild.ID}`, name: guild.Nom }));
    await updateIndex('guilds', guildes);
    return new Map(guildes.map(guild => [guild.id, guild.name]));
}