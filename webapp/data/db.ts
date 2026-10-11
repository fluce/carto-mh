import { openDB, type DBSchema } from "idb";
import type { MonsterRecord } from '../types';

interface CartoMhDatabase extends DBSchema {
    keyval: {
        key: string;
        value: string;
    };
    monsters: {
        key: string;
        value: MonsterRecord;
    };
}

export const db = await openDB<CartoMhDatabase>('carto-mh', 2, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('keyval')) {
            db.createObjectStore('keyval');
        }
        if (!db.objectStoreNames.contains('monsters')) {
            db.createObjectStore('monsters');
        }
    }
});