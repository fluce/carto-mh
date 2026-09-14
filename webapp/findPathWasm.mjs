import initPathFinder, { PathFinder3D } from '../findpath_wasm/pkg/findpath_wasm.js';

const GRID_BOUNDS = [-100, 100, -100, 100, -100, 0];
const SHORTCUT_COST = 2;
const TGV_SHORTCUT_COST = 6;

function getRaccourcis(data, shortcutNetwork) {
    if (shortcutNetwork.includes('all')) {
        return data.raccourcis ?? [];
    }
    const reducedRaccourcis = shortcutNetwork.includes('raccourcis-reduced')
    const mesRaccourcis = data.inventory?.filter(item => item.type==='Carte' && item.magic);

    if (shortcutNetwork.length > 0) {
        return (data.raccourcis ?? []).filter(
            raccourci => shortcutNetwork.includes(`raccourci:${raccourci.typeLieu}`) || (reducedRaccourcis && mesRaccourcis.some(item => item.magic === raccourci.typeLieu)),
        );
    }
    return [];
}

export async function findPath(data, start, target, shortcutNetwork = ['all']) {
    await initPathFinder();
    const pathfinder = new PathFinder3D(...GRID_BOUNDS);

    for (const lieu of data.lieux ?? []) {
        if (lieu.typeLieu === "Trou de Météorite") {
            pathfinder.set_obstacle(lieu.x, lieu.y, lieu.z, true);
        }
    }
    const raccourcis = getRaccourcis(data, shortcutNetwork);
    const all = shortcutNetwork.includes('all');
    const shortcutsByType = raccourcis.reduce((groups, raccourci) => {
        const group = groups.get(raccourci.typeLieu) ?? [];
        group.push(raccourci);
        groups.set(raccourci.typeLieu, group);
        return groups;
    }, new Map());
    console.log('Raccourcis:', raccourcis);
    console.log('Shortcuts by type:', shortcutsByType);
    for (const raccourcis of shortcutsByType.values()) {
        for (let first = 0; first < raccourcis.length; first++) {
            for (let second = first + 1; second < raccourcis.length; second++) {
                const from = raccourcis[first];
                const to = raccourcis[second];
                pathfinder.add_shortcut(from, to, SHORTCUT_COST);
                const reverseFrom = to;
                const reverseTo = from;
                pathfinder.add_shortcut(reverseFrom, reverseTo, SHORTCUT_COST);
            }
        }
    }

    const tgv_tgv = shortcutNetwork.includes('tgv');
    const tgv_reduced = shortcutNetwork.includes('tgv-reduced');

    const tgv = 
        data.tgv.filter(tgv=>{
            if (all) return true;
            if (tgv_tgv) return true;
            if (tgv_reduced && tgv.refLieu?.typeLieu !== "Tanière") return true;
            return false;
        });
        
    for (let first = 0; first < tgv.length; first++) {
        for (let second = first + 1; second < tgv.length; second++) {
            const from = tgv[first];
            const to = tgv[second];
            pathfinder.add_shortcut(from, to, TGV_SHORTCUT_COST);
            const reverseFrom = to;
            const reverseTo = from;
            pathfinder.add_shortcut(reverseFrom, reverseTo, TGV_SHORTCUT_COST);
        }
    }

    const path = pathfinder.find_path(start, target);
    const cost = path.reduce((total, step) => total + step.cost, 0);
    return { path, cost };
}
