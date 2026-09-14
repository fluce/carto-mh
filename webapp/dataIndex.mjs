export function createIndex(snapshot) {
    const index = snapshot?.index ?? {};
    const geoIndex = snapshot?.geoIndex ?? {};

    const calcId = (item) => item.type === 'lieux' ? item.id : `${item.type}-${item.id}`;

    const indexer = (item) => {
        const geoId = `x${item.x}y${item.y}z${item.z}`;
        const entry = geoIndex[geoId] ?? [];
        const id = calcId(item);
        const existing = index[id];
        let indexedItem = item;

        if (existing) {
            indexedItem = { ...existing, ...item };
            const itemIndex = entry.findIndex(x => x.id === indexedItem.id && x.type === indexedItem.type);
            if (itemIndex >= 0) {
                entry.splice(itemIndex, 1);
            }
        }

        index[id] = indexedItem;
        entry.push({ ...indexedItem });
        geoIndex[geoId] = entry;
    };

    const get = (...args) => {
        if (args.length === 1) {
            if (typeof args[0] === 'object') {
                const [item] = args;
                return geoIndex[`x${item.x}y${item.y}z${item.z}`] ?? [];
            }
            return index[args[0]];
        }

        const [x, y, z] = args;
        return geoIndex[`x${x}y${y}z${z}`] ?? [];
    };

    const serialize = () => ({ index, geoIndex });

    return { indexer, get, calcId, serialize };
}