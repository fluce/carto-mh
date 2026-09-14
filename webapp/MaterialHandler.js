import * as THREE from 'three';

export function MaterialHandler() {

    const all = {};

    return { setupMaterial, getMaterial };

    function setupMaterial(type) {
        const i = Object.values(all).length;
        all[type] =
        {
            type,
            i,
            getMaterial: () => new THREE.MeshPhysicalMaterial({
                color: new THREE.Color().setHSL(i / Object.values(all).length, 0.5, 0.5),
                transparent: true,
                opacity: 0.8,
                transmission: 0.5,
                roughness: 0.1,
                thickness: 0.5,
                ior: 1.45,
                depthWrite: true
            })
        };
        return all[type];
    }

    function getMaterial(type) {
        return all[type].getMaterial();
    }
}
