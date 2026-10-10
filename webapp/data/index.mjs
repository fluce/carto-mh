import { loadLocations } from './locations.mjs';
import { loadViewData } from './view.mjs';
import { loadTrolls } from './trolls.mjs';

export { queryMonsters } from './monsters.mjs';

export async function load() {
    await loadLocations();
    await loadTrolls();
    await loadViewData();
}

const geoIndex = new Map();
const idIndex = new Map();
const kindIndex = new Map();

function calcGeoKey(item) {
    if (item.x && item.y && item.z)
        return `${item.x}|${item.y}|${item.z}`;
    return undefined;
}

export async function updateIndex(kind, data) {
    removeKindFromIndex(kind);
    for (const item of data) {
        addToIndex({ ...item,  kind: [...new Set([kind,...item.kind??[]])], id: item.id.toString() });
    }
    console.log(`Updated index with ${kind}`, geoIndex, idIndex, kindIndex);
}

function removeKindFromIndex(kind) {
    for (const [key, value] of geoIndex.entries()) {
        const newValue = [...value].filter(item => {
            item.kind = item.kind.filter(x=>x!=kind);
            return item.kind.length>0;
        });
        if (newValue.length === 0) {
            geoIndex.delete(key);
        }
        else if (newValue.length < value.length) {
            geoIndex.set(key, new Set(newValue));
        }
    }
    kindIndex.delete(kind);
}

function addToIndex(newItem) {

    const item=mergeInIdIndex(newItem);

    const key = calcGeoKey(item);
    if (key) {
        if (!geoIndex.has(key)) {
            geoIndex.set(key, new Set());
        }
        geoIndex.get(key).add(item);
    }

    for(const k of item.kind) {        
        if (!kindIndex.has(k)) {
            kindIndex.set(k, new Set());
        }
        kindIndex.get(k).add(item);
    }
}

function mergeInIdIndex(item)
{
    let existingItem = idIndex.get(item.id);
    if (!existingItem) {
        existingItem = {...item};
        idIndex.set(existingItem.id, existingItem)
    } else {
        const kind=[...new Set([...existingItem.kind, ...item.kind])];
        for(const key of Object.keys(item))
            existingItem[key]=item[key];
        existingItem.kind = kind;
    }
    return existingItem;
}

export class Index {

    constructor(source) {
        this.geoIdx = source.geoIdx ?? geoIndex;
        this.idIdx = source.idIdx ?? idIndex;
        this.kindIdx = source.kindIdx ?? kindIndex;
    }

    getById(id) {
        return this.idIdx.get(id);
    }

    get(x, y, z) {
        if ((y === undefined || z === undefined) && x?.x !== undefined) {
            z = x.z;
            y = x.y;
            x = x.x;
        }
        if (x === undefined || y === undefined || z === undefined) {
            throw new Error('Invalid geo key');
        }
        const key = `${x}|${y}|${z}`;
        return [...(this.geoIdx.get(key) || [])];
    }

    *getByKind(kind) {
        if (!this.kindIdx.has(kind)) {
            return;
        }
        for (const item of this.kindIdx.get(kind)) {
            yield item;
        }
    }

    getAll() {
        return this.idIdx.values();
    }

}

export function getIndex() {
    return new Index({ geoIdx: geoIndex, idIdx: idIndex, kindIdx: kindIndex });
}


