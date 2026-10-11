import type { CompressedHole, Point3D, SourceItem } from '../types';

interface HolePoint extends Point3D {
    id: string | number;
}

export function compressTrous(trous: HolePoint[]): CompressedHole[] {
    const sorted = trous.reduce<Map<string, HolePoint[]>>((acc, item) => {
        const key = `${item.x},${item.y}`;
        const list = acc.get(key) ?? [];
        list.push(item);
        acc.set(key, list);
        return acc;
    }, new Map());
    const result: CompressedHole[] = [];
    for (const [key, value] of sorted.entries()) {
        value.sort((a, b) => a.z - b.z); // Sort by z-coordinate
        const last = value[value.length - 1];
        if (!last) continue;
        if (last.z !== 0) {
            for (let z = last.z + 1; z <= 0; z++) {
                value.push({ x: last.x, y: last.y, z, id: String(Number(last.id) + (last.z - z)) });
            }
        }
        console.info(`Processing key ${key} with ${value.length} items`, value);
        // find holes between consecutive z-coordinates
        let currentMinIndex = 0;
        for (let i = 1; i < value.length; i++) {
            const hole = value[i].z - value[i - 1].z - 1;
            if (hole > 0) {
                result.push({ x: value[0].x, y: value[0].y, z1: value[currentMinIndex].z, z2: value[i - 1].z, id1: value[currentMinIndex].id, id2: value[i - 1].id });
                const idDiff = Number(value[currentMinIndex].id) - Number(value[i - 1].id);
                const zDiff = value[i - 1].z - value[currentMinIndex].z;
                if (idDiff !== zDiff) {
                    console.warn(`Found ID gap of size ${idDiff}/${zDiff} at ${key} between id=${value[currentMinIndex].id} (z=${value[currentMinIndex].z}) and id=${value[i - 1].id} (z=${value[i - 1].z})` );
                }
                currentMinIndex = i; 
                console.info(`Found hole of size ${hole} at ${key} between z=${value[i - 1].z} and z=${value[i].z}`);
            }
        }
        // push the last segment if it exists
        if (currentMinIndex < value.length - 1) {
            result.push({ x: value[0].x, y: value[0].y, z1: value[currentMinIndex].z, z2: value[value.length - 1].z, id1: value[currentMinIndex].id, id2: value[value.length - 1].id });
            const idDiff = Number(value[currentMinIndex].id) - Number(value[value.length - 1].id);
            const zDiff = value[value.length - 1].z - value[currentMinIndex].z;
            if (idDiff !== zDiff) {
                console.warn(`Found ID gap of size ${idDiff}/${zDiff} at ${key} between id=${value[currentMinIndex].id} (z=${value[currentMinIndex].z}) and id=${value[value.length - 1].id} (z=${value[value.length - 1].z})` );
            }
        }
    }
    return result;
}

export function decompressTrous(compressed: CompressedHole[]): SourceItem[] {
    const result: SourceItem[] = [];
    for (const item of compressed) {
        console.info(`Decompressing hole at ${item.x},${item.y} from z=${item.z1} to z=${item.z2}`);
        for (let z = item.z1; z <= item.z2; z++) {
            result.push({ type: "Trou de Météorite", name: "Trou de Météorite", x: item.x, y: item.y, z, id: `MX${item.x}Y${item.y}Z${z}` });
        }
    }
    return result;
}