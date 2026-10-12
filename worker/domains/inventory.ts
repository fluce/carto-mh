import { getCredentials } from '../auth/sessions.ts';
import { INVENTORY_URL } from '../shared/config.ts';
import { jsonResponse } from '../shared/utils.ts';
import type { CachedInventory, Credentials, InventoryItem, ResponseHeaders, WorkerEnv } from '../shared/types.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
const NO_DESCRIPTION = 'Aucune description disponible';
const pendingRefreshes = new Map<string, Promise<InventoryItem[]>>();

function normalizeDescription(description: string | null): string | null {
    return description === NO_DESCRIPTION ? null : description;
}

function normalizeInventoryItems(items: InventoryItem[]): InventoryItem[] {
    return items.map(item => ({
        ...item,
        description: normalizeDescription(item.description),
    }));
}

export async function fetchInventory(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {
    const credentials = await getCredentials(request.headers, env);
    if (!credentials) {
        return new Response('Unauthorized', { status: 401, headers: respHeaders });
    }

    const cacheKey = `inventory:${credentials.idHash}`;
    const cached = await env.USER_DATA.get<CachedInventory>(cacheKey, { type: 'json' });
    if (cached && isFresh(cached)) {
        return jsonResponse(normalizeInventoryItems(cached.items), 200, respHeaders);
    }

    let refresh = pendingRefreshes.get(credentials.idHash);
    if (!refresh) {
        refresh = refreshInventory(credentials, env, cacheKey);
        pendingRefreshes.set(credentials.idHash, refresh);
    }

    try {
        return jsonResponse(await refresh, 200, respHeaders);
    } catch (error) {
        console.error('Unable to refresh inventory:', error);
        if (cached && Array.isArray(cached.items)) {
            return jsonResponse(normalizeInventoryItems(cached.items), 200, { ...respHeaders, 'X-Inventory-Stale': 'true' });
        }
        return new Response('Unable to load inventory', { status: 502, headers: respHeaders });
    } finally {
        if (pendingRefreshes.get(credentials.idHash) === refresh) {
            pendingRefreshes.delete(credentials.idHash);
        }
    }
}

function isFresh(cached: CachedInventory | null): boolean {
    return Boolean(
        cached &&
        Array.isArray(cached.items) &&
        Number.isFinite(cached.loadedAt) &&
        Date.now() - cached.loadedAt < DAY_MS
    );
}

async function refreshInventory(credentials: Credentials, env: WorkerEnv, cacheKey: string): Promise<InventoryItem[]> {
    const url = new URL(INVENTORY_URL);
    url.search = new URLSearchParams({ Numero: credentials.id, Motdepasse: credentials.secret, Split: '1', withSolidite: '1' }).toString();
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`MountyHall inventory request failed: ${response.status}`);
    }

    const data = new TextDecoder('iso-8859-1').decode(await response.arrayBuffer());
    const items = parseInventory(data);
    const cached: CachedInventory = { items, loadedAt: Date.now() };
    await env.USER_DATA.put(cacheKey, JSON.stringify(cached));
    return items;
}

function parseInventory(data: string): InventoryItem[] {
    return data
        .split(/\r?\n/)
        .filter(line => line.length > 0)
        .map(line => {
            const [id, equipped, type, identified, name, magic, description, weight, durability] = line.split(';');
            return {
                id: Number.parseInt(id, 10),
                equipped: Number.parseInt(equipped, 10),
                type,
                identified: identified === '1',
                name,
                magic,
                description: normalizeDescription(description),
                weight: Number.parseFloat(weight) || weight,
                durability
            };
        });
}