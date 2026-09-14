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
            getMaterial: () => new THREE.MeshPhongMaterial({
                color: new THREE.Color().setHSL(i / Object.values(all).length, 0.5, 0.5),
                transparent: false,
                opacity: 1,
                depthWrite: true,
            }
            )
        };
        return all[type];
    }

    function getMaterial(type) {
        return all[type].getMaterial();
    }
}
