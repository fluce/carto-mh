import initPathFinder, { PathFinder3D } from '../../../findpath_wasm/pkg/findpath_wasm.js';
import type { GeoIndex, IndexedItem, PathResult, PathStep, Point3D, SearchStats, ShortcutNetworks } from '../../shared/types';

const GRID_BOUNDS = [-100, 100, -100, 100, -100, 0] as const;
const SHORTCUT_COST = 2;
const TGV_SHORTCUT_COST = 6;

type EligibleShortcut = IndexedItem & Point3D & { transportNetwork: string };

function isEligibleRaccourci(
    location: IndexedItem,
    shortcutNetwork: ShortcutNetworks[],
    ownedMaps: string[],
    friendGuilds: Array<string | number>,
): location is EligibleShortcut {
    if (!location.kind?.includes('location')) return false;
    if (!location.transportNetwork) return false;
    if (!location.x || !location.y || !location.z) return false;
    if (shortcutNetwork.includes('ALL')) return true;
    if (location.transportNetwork.startsWith('shortcut:') && shortcutNetwork.includes('SHORTCUTS')) return true;
    if (location.transportNetwork.startsWith('shortcut:') && ownedMaps.includes(location.transportNetwork) && shortcutNetwork.includes('SHORTCUTS_REDUCED')) return true;
    if (location.transportNetwork==="tgv" && shortcutNetwork.includes('TGV')) return true;
    if (location.transportNetwork === 'tgv' && shortcutNetwork.includes('TGV_REDUCED')) {
        return location.type !== 'Tanière' || isFriendlyTaniere(location.name, friendGuilds);
    }

    if (shortcutNetwork.includes(location.transportNetwork)) return true;
    return false;
}

function isFriendlyTaniere(name: string | undefined, friendGuilds: Array<string | number>): boolean {
    const guildId = name?.match(/\(([^()]*)\)\s*$/)?.[1]?.trim();
    return guildId !== undefined && friendGuilds.some(friendGuildId => String(friendGuildId) === guildId);
}

function getRaccourcis(
    index: GeoIndex,
    shortcutNetwork: ShortcutNetworks[],
    ownedMaps: string[],
    friendGuilds: Array<string | number>,
): EligibleShortcut[] {
    return [...index.getAll()].filter(location =>
        isEligibleRaccourci(location, shortcutNetwork, ownedMaps, friendGuilds)
    );
}

let pathfinder: PathFinder3D | undefined;
let cachedIndex: GeoIndex | undefined;
let cachedShortcutNetwork: string[] | undefined;
let cachedFriendGuilds: string[] | undefined;
let pathFinderInitialization: Promise<void> | undefined;
let wasmInitializationDurationMs = 0;

function initializePathfinder(
    index: GeoIndex,
    shortcutNetwork: ShortcutNetworks[],
    ownedMaps: string[],
    friendGuilds: Array<string | number>,
): PathFinder3D {
    const nextPathfinder = new PathFinder3D(...GRID_BOUNDS);

    for (const lieu of index.getByKind("trou")) {
        if (lieu.x !== undefined && lieu.y !== undefined && lieu.z !== undefined) {
            nextPathfinder.set_obstacle(lieu.x, lieu.y, lieu.z, true);
        }
    }

    const raccourcis = getRaccourcis(index, shortcutNetwork, ownedMaps, friendGuilds);
    const shortcutsByType = raccourcis.reduce<Map<string, EligibleShortcut[]>>((groups, raccourci) => {
        const group = groups.get(raccourci.transportNetwork) ?? [];
        group.push(raccourci);
        groups.set(raccourci.transportNetwork, group);
        return groups;
    }, new Map());

    for (const raccourcis of shortcutsByType.values()) {
        const firstShortcut = raccourcis[0];
        if (!firstShortcut) continue;
        const cost = firstShortcut.transportNetwork === 'tgv' ? TGV_SHORTCUT_COST : SHORTCUT_COST;
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

export async function findPath(
    index: GeoIndex,
    start: Point3D,
    target: Point3D,
    shortcutNetwork: ShortcutNetworks[] = ['ALL'],
    ownedMaps: string[] = [],
    friendGuilds: Array<string | number> = [],
): Promise<PathResult> {
    if (!pathFinderInitialization) {
        const initializationStartedAt = performance.now();
        pathFinderInitialization = initPathFinder().then(() => {
            wasmInitializationDurationMs = performance.now() - initializationStartedAt;
        });
    }
    await pathFinderInitialization;

    const network = [...new Set(shortcutNetwork)].sort();
    const networkUnchanged = cachedShortcutNetwork?.length === network.length
        && cachedShortcutNetwork.every((value, position) => value === network[position]);
    const sortedFriendGuilds = [...new Set(friendGuilds.map(String))].sort();
    const friendGuildsUnchanged = cachedFriendGuilds?.length === sortedFriendGuilds.length
        && cachedFriendGuilds.every((value, position) => value === sortedFriendGuilds[position]);

    let pathfinderInitializationDurationMs = 0;
    if (!pathfinder || cachedIndex !== index || !networkUnchanged || !friendGuildsUnchanged) {
        const initializationStartedAt = performance.now();
        pathfinder = initializePathfinder(index, shortcutNetwork, ownedMaps, friendGuilds);
        pathfinderInitializationDurationMs = performance.now() - initializationStartedAt;
        cachedIndex = index;
        cachedShortcutNetwork = network;
        cachedFriendGuilds = sortedFriendGuilds;
    }

    const searchStartedAt = performance.now();
    const { path, stats } = pathfinder.find_path(start, target) as { path: PathStep[]; stats: SearchStats };
    const searchDurationMs = performance.now() - searchStartedAt;
    const costStartedAt = performance.now();
    const cost = path.reduce((total, step) => total + step.cost, 0);
    const costAggregationDurationMs = performance.now() - costStartedAt;
    return {
        path,
        cost,
        stats,
        timings: {
            wasmInitializationDurationMs,
            pathfinderInitializationDurationMs,
            searchDurationMs,
            costAggregationDurationMs,
        },
    };
}
