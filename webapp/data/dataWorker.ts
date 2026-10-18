import { db } from './persistence/db.ts';
import { update } from './sources/update.ts';
import { loadInventory } from './sources/inventory.ts';
import * as index from './index/index.ts';
import { loadViewData } from './sources/view.ts';
import type { DataWorkerRequest, DataWorkerResponse, MonsterRecord, UserData, UserDataExtensionValue } from '../shared/types';

console.log('Worker script loaded');

let token: string | undefined;
const tokenLoad = db.get('keyval', 'token').then(storedToken => {
    token ??= storedToken;
    return token;
});

self.onmessage = async (event: MessageEvent<DataWorkerRequest>) => {
    try {
        switch (event.data?.type) {
            case 'login':
                const loginResult = await login(event.data.id, event.data.secret);
                self.postMessage({ type: 'result:login', message_id: event.data.message_id, result: loginResult } satisfies DataWorkerResponse);
                self.postMessage({ type: 'ready', profile: loginResult.profile });
                break;
            case 'load':
                const loadResult = await load();
                if (loadResult) {
                    self.postMessage({ type: 'result:load', message_id: event.data.message_id, result: loadResult } satisfies DataWorkerResponse);
                } else {
                    self.postMessage({ type: 'need:login' });
                }
                break;
            case 'refreshView':
                if (!await loadViewData(true)) {
                    self.postMessage({ type: 'need:login' });
                    throw new Error('Unable to refresh view data: authentication required');
                }
                self.postMessage({ type: 'result:refreshView', message_id: event.data.message_id, result: index.getIndex() } satisfies DataWorkerResponse);
                break;
            case 'inventory':
                self.postMessage({ type: 'result:inventory', message_id: event.data.message_id, result: await loadInventory() } satisfies DataWorkerResponse);
                break;
            case 'update':
                self.postMessage({ type: 'result:update', message_id: event.data.message_id, result: await update() } satisfies DataWorkerResponse);
                break;
            case 'monsters':
                self.postMessage({ type: 'result:monsters', message_id: event.data.message_id, result: await monsters(event.data.ids) } satisfies DataWorkerResponse);
                break;
            case 'readUserData':
                self.postMessage({ type: 'result:readUserData', message_id: event.data.message_id, result: await readUserData() } satisfies DataWorkerResponse);
                break;
            case 'writeUserData':
                self.postMessage({ type: 'result:writeUserData', message_id: event.data.message_id, result: await writeUserData(event.data.data, event.data.etag) } satisfies DataWorkerResponse);
                break;
            default:
                return;
        }
    } catch (error) {
        console.error('Error occurred in worker:', error);
        self.postMessage({ type: `error:${event.data?.type ?? 'unknown'}`, message_id: event.data?.message_id, error: error instanceof Error ? error.message : String(error) } satisfies DataWorkerResponse);
    }
};

await tokenLoad;
if (!token) {
    console.log('No token found, need login');
    self.postMessage({ type: 'need:login' });
} else {
    console.log('Token found, no need to login', token);
    const profile = await getProfile();
    if (!profile || !profile.id) {
        console.log('Invalid token, need login');
        self.postMessage({ type: 'need:login' });
    } else {
        console.log('Profile fetched:', profile);
        self.postMessage({ type: 'ready', profile });
    }
}

async function getCachedToken() {
    if (!token) {
        token = await tokenLoad;
    }
    return token;
} 

export async function getToken() {
    return getCachedToken();
}

async function load(): Promise<ReturnType<typeof index.getIndex> | false> {
    console.log('Loading data in worker');
    const ret=await index.load();
    if (!ret) {
        console.error('Failed to load new data');
        return false;
    }
    console.log('New data loaded',ret);
    return index.getIndex();
}

async function getProfile(): Promise<{ id: string, isAdmin: boolean }> {
    const response = await fetch('/api/profile', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${await getCachedToken()}`
        }
    });
    if (!response.ok) {
        console.log(`Failed to fetch profile: ${response.statusText}`);
    }
    return await response.json() as { id: string, isAdmin: boolean };
}

async function login(id: string, secret: string): Promise<{ success: true, profile: { id: string, isAdmin: boolean } }> {
    console.log('Logging in with id:', id);
    const response = await fetch('/api/token', { 
        method: 'POST', 
        body: JSON.stringify({ id, secret }),
        headers: {
            'Content-Type': 'application/json; charset=utf-8'
        }
    });
    if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
    }
    const result = await response.json() as { token: string, profile: { id: string, isAdmin: boolean } };
    await db.put('keyval', result.token, 'token');
    token = result.token;
    return { success: true, profile: result.profile };
}

async function monsters(ids: Array<Pick<MonsterRecord, 'id'> & { name?: string }>): Promise<MonsterRecord[]> {

    return await index.queryMonsters(ids);

}

async function readUserData(): Promise<{ data: UserData; etag: string }> {
    const response = await fetch('/api/data', {
        method: 'GET',
        headers: { Authorization: `Bearer ${await getCachedToken()}` }
    });
    if (!response.ok) {
        throw new Error(`Unable to read user data: ${response.status} ${response.statusText}`);
    }

    const etag = response.headers.get('ETag');
    if (!etag) {
        throw new Error('Unable to read user data: response is missing ETag');
    }
    return { data: normalizeUserData(await response.json()), etag };
}

async function writeUserData(data: UserData, etag: string): Promise<{ etag: string }> {
    const response = await fetch('/api/data', {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${await getCachedToken()}`,
            'Content-Type': 'application/json',
            'If-Match': etag,
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}: Unable to write user data`);
    }

    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('etag' in result) || typeof result.etag !== 'string') {
        throw new Error('Unable to write user data: response is missing ETag');
    }
    return { etag: result.etag };
}

function normalizeUserData(value: unknown): UserData {
    if (value === null) {
        return { friendGuilds: [], foeGuilds: [], friendTrolls: [], foeTrolls: [] };
    }
    if (!isRecord(value)) {
        throw new TypeError('User data must be a JSON object');
    }

    const friendGuilds = readIds(value.friendGuilds, 'friendGuilds');
    const foeGuilds = readIds(value.foeGuilds, 'foeGuilds');
    const friendTrolls = readIds(value.friendTrolls, 'friendTrolls');
    const foeTrolls = readIds(value.foeTrolls, 'foeTrolls');
    const extra: Record<string, UserDataExtensionValue> = {};
    for (const [key, item] of Object.entries(value)) {
        if (!isUserDataExtensionValue(item)) {
            throw new TypeError(`Invalid user data property: ${key}`);
        }
        extra[key] = item;
    }

    return { ...extra, friendGuilds, foeGuilds, friendTrolls, foeTrolls };
}

function readIds(value: unknown, property: string): Array<string | number> {
    if (value === undefined) {
        return [];
    }
    if (!Array.isArray(value) || !value.every(id => typeof id === 'string' || typeof id === 'number')) {
        throw new TypeError(`User data property ${property} must be an array of string or number IDs`);
    }
    return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUserDataExtensionValue(value: unknown): value is UserDataExtensionValue {
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return true;
    }
    if (Array.isArray(value)) {
        return value.every(isUserDataExtensionValue);
    }
    if (isRecord(value)) {
        return Object.values(value).every(isUserDataExtensionValue);
    }
    return false;
}