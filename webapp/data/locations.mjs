
import { getToken } from '../dataWorker.mjs';
import { updateIndex } from './index.mjs';
import { decompressTrous } from './trous.mjs';

async function load() {
    const response = await fetch('/api/locations', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getToken()}`
        }
    });
    return await response.json();
}

export async function loadLocations() {
    const data = await load();
    console.log("Loaded locations data:", data);
    await updateIndex('location', data.locations);
    const trous = decompressTrous(data.compressedHoles);
    await updateIndex('trou', trous);
}

