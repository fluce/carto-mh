import { loadLocations } from './locations.mjs';
import { loadGuildes } from './guildes.mjs';
import { loadViewData } from './view.mjs';
import { loadTrolls } from './trolls.mjs';

export { queryMonsters } from './monsters.mjs';

export async function load() {
    await loadLocations();
    const guildNames = await loadGuildes();
    await loadTrolls(guildNames);
    await loadViewData();
}

const geoIndex = new Map();
const idIndex = new Map();
const kindIndex = new Map();
const nameIndex = new Map();

function normalizeName(value) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}

function getNamePrefixes(name) {
    const normalizedName = normalizeName(name.trim());
    const tokens = normalizedName.split(/\s+/).filter(Boolean);
    const prefixes = new Set();
    for (const token of [normalizedName, ...tokens]) {
        for (let length = 1; length <= token.length; length += 1) {
            prefixes.add(token.slice(0, length));
        }
    }
    return prefixes;
}

function addToNameIndex(item) {
    if (!item.name) return;
    for (const prefix of getNamePrefixes(item.name)) {
        if (!nameIndex.has(prefix)) nameIndex.set(prefix, new Set());
        nameIndex.get(prefix).add(item);
    }
}

function calcGeoKey(item) {
    if (item.x !== undefined && item.y !== undefined && item.z !== undefined)
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

    addToKindIndex(item);
    addToNameIndex(item);
}

function addToKindIndex(item) {
    for (const k of item.kind) {
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
        this.nameIdx = source.nameIdx ?? nameIndex;
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

    search(query, limit = 10) {
        const normalizedQuery = normalizeName(query.trim());
        if (!normalizedQuery) return [];

        return [...(this.nameIdx.get(normalizedQuery) ?? [])]
            .filter(item => {
                const searchable = item.kind?.some(kind =>
                    kind === 'location' || kind === 'troll' || kind === 'view:monstres'
                );
                return searchable && item.x !== undefined && item.y !== undefined && item.z !== undefined &&
                    getNamePrefixes(item.name ?? '').has(normalizedQuery);
            })
            .sort((first, second) => first.name.localeCompare(second.name, 'fr'))
            .slice(0, limit);
    }

}

export function getIndex() {
    return new Index({ geoIdx: geoIndex, idIdx: idIndex, kindIdx: kindIndex, nameIdx: nameIndex });
}


