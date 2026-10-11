import initPathFinder, { PathFinder3D } from '../findpath_wasm/pkg/findpath_wasm.js';

const GRID_BOUNDS = [-100, 100, -100, 100, -100, 0];
const SHORTCUT_COST = 2;
const TGV_SHORTCUT_COST = 6;

function isEligibleRaccourci(location, shortcutNetwork) {
    if (!location.transportNetwork) return false;
    if (!location.x || !location.y || !location.z) return false;
    if (shortcutNetwork.includes('all')) return true;
    if (location.transportNetwork==="tgv" && shortcutNetwork.includes('tgv')) return true;

    const shortcutType = location.transportNetwork.match(/shortcut:(.+)/);
    if (shortcutType?.[1] && shortcutNetwork.includes(`raccourci:${shortcutType[1]}`)) return true;
    return false;
}

function getRaccourcis(index, shortcutNetwork) {
    return index.getAll().filter(location => isEligibleRaccourci(location, shortcutNetwork));
}

let pathfinder;
let cachedIndex;
let cachedShortcutNetwork;
let pathFinderInitialization;

function initializePathfinder(index, shortcutNetwork) {
    const nextPathfinder = new PathFinder3D(...GRID_BOUNDS);
    console.log('Initializing pathfinder with data:', index);

    for (const lieu of index.getByKind("trou")) {
        nextPathfinder.set_obstacle(lieu.x, lieu.y, lieu.z, true);
    }

    const raccourcis = getRaccourcis(index, shortcutNetwork);
    const shortcutsByType = raccourcis.reduce((groups, raccourci) => {
        const group = groups.get(raccourci.transportNetwork) ?? [];
        group.push(raccourci);
        groups.set(raccourci.transportNetwork, group);
        return groups;
    }, new Map());
    console.log('Raccourcis:', raccourcis);
    console.log('Shortcuts by type:', shortcutsByType);

    for (const raccourcis of shortcutsByType.values()) {
        const cost = raccourcis[0].transportNetwork === 'tgv' ? TGV_SHORTCUT_COST : SHORTCUT_COST;
        for (let first = 0; first < raccourcis.length; first++) {
            for (let second = first + 1; second < raccourcis.length; second++) {
                const from = raccourcis[first];
                const to = raccourcis[second];
                nextPathfinder.add_shortcut({x:from.x, y:from.y, z:from.z}, {x:to.x, y:to.y, z:to.z}, cost);
                const reverseFrom = to;
                const reverseTo = from;
                nextPathfinder.add_shortcut({x:reverseFrom.x, y:reverseFrom.y, z:reverseFrom.z}, {x:reverseTo.x, y:reverseTo.y, z:reverseTo.z}, cost);
            }
        }
    }

    return nextPathfinder;
}

export async function findPath(index, start, target, shortcutNetwork = ['all']) {
    pathFinderInitialization ??= initPathFinder();
    await pathFinderInitialization;

    const network = [...new Set(shortcutNetwork)].sort();
    const networkUnchanged = cachedShortcutNetwork?.length === network.length
        && cachedShortcutNetwork.every((value, position) => value === network[position]);

    if (!pathfinder || cachedIndex !== index || !networkUnchanged) {
        pathfinder = initializePathfinder(index, shortcutNetwork);
        cachedIndex = index;
        cachedShortcutNetwork = network;
    }

    const path = pathfinder.find_path(start, target);
    const cost = path.reduce((total, step) => total + step.cost, 0);
    return { path, cost };
}
