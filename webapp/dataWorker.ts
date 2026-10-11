import { db } from './data/db.ts';
import { update } from './data/update.ts';
import * as index from './data';
import type { DataWorkerRequest, DataWorkerResponse, MonsterRecord } from './types';

console.log('Worker script loaded');

self.onmessage = async (event: MessageEvent<DataWorkerRequest>) => {
    try {
        switch (event.data?.type) {
            case 'login':
                self.postMessage({ type: 'result:login', message_id: event.data.message_id, result: await login(event.data.id, event.data.secret) } satisfies DataWorkerResponse);
                self.postMessage({ type: 'ready' });
                break;
            case 'load':
                self.postMessage({ type: 'result:load', message_id: event.data.message_id, result: await load() } satisfies DataWorkerResponse);
                break;
            case 'update':
                self.postMessage({ type: 'result:update', message_id: event.data.message_id, result: await update() } satisfies DataWorkerResponse);
                break;
            case 'monsters':
                self.postMessage({ type: 'result:monsters', message_id: event.data.message_id, result: await monsters(event.data.ids) } satisfies DataWorkerResponse);
                break;
            default:
                return;
        }
    } catch (error) {
        console.error('Error occurred in worker:', error);
        self.postMessage({ type: `error:${event.data?.type ?? 'unknown'}`, message_id: event.data?.message_id, error: error instanceof Error ? error.message : String(error) } satisfies DataWorkerResponse);
    }
};

const token = await db.get('keyval', 'token');
if (!token) {
    console.log('No token found, need login');
    self.postMessage({ type: 'need:login' });
} else {
    console.log('Token found, no need to login', token);
    self.postMessage({ type: 'ready' });
}

export function getToken() {
    return token;
}

async function load() {
    console.log('Loading data in worker');
    await index.load();
    console.log('New data loaded',index);
    return index.getIndex();
}


async function login(id: string, secret: string): Promise<{ success: true }> {
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
    const result = await response.json() as { token: string };
    await db.put('keyval', result.token, 'token');
    return { success: true };
}

async function monsters(ids: Array<Pick<MonsterRecord, 'id'> & { name?: string }>): Promise<MonsterRecord[]> {

    return await index.queryMonsters(ids);

}