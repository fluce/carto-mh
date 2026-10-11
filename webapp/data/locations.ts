
import { getToken } from '../dataWorker.ts';
import { updateIndex } from './index.ts';
import { decompressTrous } from './trous.ts';
import type { CompressedHole, SourceItem } from '../types';

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
    const data = await load() as { locations: SourceItem[]; compressedHoles: CompressedHole[] };
    console.log("Loaded locations data:", data);
    await updateIndex('location', data.locations);
    const trous = decompressTrous(data.compressedHoles);
    await updateIndex('trou', trous);
}

