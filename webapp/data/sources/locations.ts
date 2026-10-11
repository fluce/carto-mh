
import { getToken } from '../dataWorker.ts';
import { updateIndex } from '../index/index.ts';
import { decompressTrous } from './trous.ts';
import type { CompressedHole, SourceItem } from '../../shared/types';

async function load() {
    const response = await fetch('/api/locations', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getToken()}`
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

