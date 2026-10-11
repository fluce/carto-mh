import type { CoordinateIndexedItem, GeoIndex, IndexSnapshot, IndexedItem, Point3D, SearchableItem, SourceItem } from '../../shared/types';

const geoIndex = new Map<string, Set<CoordinateIndexedItem>>();
const idIndex = new Map<string, IndexedItem>();
const kindIndex = new Map<string, Set<IndexedItem>>();
const nameIndex = new Map<string, Set<IndexedItem>>();

function normalizeName(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr');
}

function getNamePrefixes(name: string) {
    const normalizedName = normalizeName(name.trim());
    const tokens = normalizedName.split(/\s+/).filter(Boolean);
    const prefixes = new Set<string>();
    for (const token of [normalizedName, ...tokens]) {
        for (let length = 1; length <= token.length; length += 1) {
            prefixes.add(token.slice(0, length));
        }
    }
    return prefixes;
}

function addToNameIndex(item: IndexedItem) {
    if (!item.name) return;
    for (const prefix of getNamePrefixes(item.name)) {
        const items = nameIndex.get(prefix) ?? new Set<IndexedItem>();
        items.add(item);
        nameIndex.set(prefix, items);
    }
}

function calcGeoKey(item: Partial<Point3D>) {
    if (item.x !== undefined && item.y !== undefined && item.z !== undefined)
        return `${item.x}|${item.y}|${item.z}`;
    return undefined;
}

export async function updateIndex(kind: string, data: SourceItem[]) {
    removeKindFromIndex(kind);
    for (const item of data) {
        addToIndex({ ...item, kind: [...new Set([kind, ...(item.kind ?? [])])], id: item.id.toString() });
    }
    console.log(`Updated index with ${kind}`, geoIndex, idIndex, kindIndex);
}

function removeKindFromIndex(kind: string) {
    for (const [key, value] of geoIndex.entries()) {
        const newValue = [...value].filter(item => {
            item.kind = item.kind.filter(x=>x!=kind);
            return item.kind.length>0;
        });
        if (newValue.length === 0) {
            geoIndex.delete(key);
        }
        else if (newValue.length < value.size) {
            geoIndex.set(key, new Set(newValue));
        }
    }
    kindIndex.delete(kind);
}

function addToIndex(newItem: IndexedItem) {
    const item=mergeInIdIndex(newItem);

    if (item.x !== undefined && item.y !== undefined && item.z !== undefined) {
        const coordinateItem = item as CoordinateIndexedItem;
        const key = calcGeoKey(coordinateItem);
        if (!key) return;
        if (!geoIndex.has(key)) {
            geoIndex.set(key, new Set<CoordinateIndexedItem>());
        }
        const items = geoIndex.get(key) ?? new Set<CoordinateIndexedItem>();
        items.add(coordinateItem);
        geoIndex.set(key, items);
    }

    addToKindIndex(item);
    addToNameIndex(item);
}

function addToKindIndex(item: IndexedItem) {
    for (const k of item.kind) {
        if (!kindIndex.has(k)) {
            kindIndex.set(k, new Set<IndexedItem>());
        }
        const items = kindIndex.get(k) ?? new Set<IndexedItem>();
        items.add(item);
        kindIndex.set(k, items);
    }
}

function mergeInIdIndex(item: IndexedItem): IndexedItem {
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
    geoIdx: Map<string, Set<CoordinateIndexedItem>>;
    idIdx: Map<string, IndexedItem>;
    kindIdx: Map<string, Set<IndexedItem>>;
    nameIdx: Map<string, Set<IndexedItem>>;

    constructor(source: Partial<IndexSnapshot> = {}) {
        this.geoIdx = source.geoIdx ?? geoIndex;
        this.idIdx = source.idIdx ?? idIndex;
        this.kindIdx = source.kindIdx ?? kindIndex;
        this.nameIdx = source.nameIdx ?? nameIndex;
    }

    getById(id: string) {
        return this.idIdx.get(id);
    }

    get(point: Point3D): CoordinateIndexedItem[];
    get(x: number, y: number, z: number): CoordinateIndexedItem[];
    get(xOrPoint: number | Point3D, y?: number, z?: number): CoordinateIndexedItem[] {
        const x = typeof xOrPoint === 'number' ? xOrPoint : xOrPoint.x;
        y = typeof xOrPoint === 'number' ? y : xOrPoint.y;
        z = typeof xOrPoint === 'number' ? z : xOrPoint.z;
        if (x === undefined || y === undefined || z === undefined) {
            throw new Error('Invalid geo key');
        }
        const key = `${x}|${y}|${z}`;
        return [...(this.geoIdx.get(key) || [])];
    }

    *getByKind(kind: string): IterableIterator<IndexedItem> {
        if (!this.kindIdx.has(kind)) {
            return;
        }
        for (const item of this.kindIdx.get(kind) ?? []) {
            yield item;
        }
    }

    getAll(): IterableIterator<IndexedItem> {
        return this.idIdx.values();
    }

    search(query: string, limit = 10): SearchableItem[] {
        const normalizedQuery = normalizeName(query.trim());
        if (!normalizedQuery) return [];

        return [...(this.nameIdx.get(normalizedQuery) ?? [])]
            .filter((item): item is SearchableItem => {
                const searchable = item.kind?.some(kind =>
                    kind === 'location' || kind === 'troll' || kind === 'view:monstres'
                );
                return searchable && item.x !== undefined && item.y !== undefined && item.z !== undefined &&
                    getNamePrefixes(item.name ?? '').has(normalizedQuery);
            })
            .sort((first, second) => (first.name ?? '').localeCompare(second.name ?? '', 'fr'))
            .slice(0, limit);
    }
}

export function getIndex(): Index {
    return new Index({ geoIdx: geoIndex, idIdx: idIndex, kindIdx: kindIndex, nameIdx: nameIndex });
}
