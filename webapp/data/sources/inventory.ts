import type { InventoryItem } from '../../shared/types';
import { getToken } from '../dataWorker.ts';

export async function loadInventory(): Promise<InventoryItem[]> {
    const response = await fetch('/api/inventory', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${await getToken()}`
        }
    });

    if (!response.ok) {
        throw new Error(`Unable to load inventory: ${response.statusText}`);
    }

    return await response.json() as InventoryItem[];
}