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
                color: new THREE.Color().setHSL(1.0 * i / Object.values(all).length, 0.5, 0.5),
                transparent: true,
                opacity: 0.5
            }
            )
        };
        return all[type];
    }

    function getMaterial(type) {
        return all[type].getMaterial();
    }
}
