interface LegacyItem {
    id: string | number;
    type?: string;
    x?: number;
    y?: number;
    z?: number;
    [key: string]: unknown;
}

interface LegacySnapshot {
    index?: Record<string, LegacyItem>;
    geoIndex?: Record<string, LegacyItem[]>;
}

export function createIndex(snapshot: LegacySnapshot = {}) {
    const index = snapshot?.index ?? {};
    const geoIndex = snapshot?.geoIndex ?? {};

    const calcId = (item: LegacyItem): string | number => item.type === 'lieux' ? item.id : `${item.type}-${item.id}`;

    const indexer = (item: LegacyItem) => {
        const geoId = `x${item.x}y${item.y}z${item.z}`;
        const entry = geoIndex[geoId] ?? [];
        const id = calcId(item);
        const existing = index[String(id)];
        let indexedItem = item;

        if (existing) {
            indexedItem = { ...existing, ...item };
            const itemIndex = entry.findIndex(x => x.id === indexedItem.id && x.type === indexedItem.type);
            if (itemIndex >= 0) {
                entry.splice(itemIndex, 1);
            }
        }

        index[String(id)] = indexedItem;
        entry.push({ ...indexedItem });
        geoIndex[geoId] = entry;
    };

    function get(...args: Array<LegacyItem | string | number>): LegacyItem | LegacyItem[] | undefined {
        const firstArgument = args[0];
        if (args.length === 1) {
            if (typeof firstArgument === 'object' && firstArgument !== null) {
                return geoIndex[`x${firstArgument.x}y${firstArgument.y}z${firstArgument.z}`] ?? [];
            }
            return index[String(firstArgument)];
        }

        const [x, y, z] = args;
        return geoIndex[`x${x}y${y}z${z}`] ?? [];
    };

    const serialize = () => ({ index, geoIndex });

    return { indexer, get, calcId, serialize };
}