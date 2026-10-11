import * as THREE from 'three';

interface MaterialEntry {
    type: string;
    i: number;
    getMaterial: () => THREE.MeshLambertMaterial;
}

export function MaterialHandler() {

    const all: Record<string, MaterialEntry> = {};

    return { setupMaterial, getMaterial };

    function setupMaterial(type: string): MaterialEntry {
        const i = Object.values(all).length;
        all[type] =
        {
            type,
            i,
            getMaterial: () => new THREE.MeshLambertMaterial({
                color: new THREE.Color().setHSL(i / Object.values(all).length, 0.5, 0.5),
                transparent: true,
                opacity: 0.8,
                depthWrite: true
            })
        };
        return all[type];
    }

    function getMaterial(type: string): THREE.MeshLambertMaterial {
        const entry = all[type];
        if (!entry) {
            throw new Error(`Material is not configured for ${type}`);
        }
        return entry.getMaterial();
    }
}
