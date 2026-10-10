import { openDB } from "idb";

export const db = await openDB('carto-mh', 2, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('keyval')) {
            db.createObjectStore('keyval');
        }
        if (!db.objectStoreNames.contains('monsters')) {
            db.createObjectStore('monsters');
        }
    }
});