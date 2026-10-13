import { jsonResponse } from '../shared/utils.ts';
import { PROFILE_URL } from '../shared/config.ts';
import type { CredentialInput, Credentials, EncryptedSecret, ResponseHeaders, StoredSessionRecord, StoredUserRecord, WorkerEnv } from '../shared/types.ts';

export async function createToken(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {
    let credentials;

    try {
        credentials = await readCredentials(request);
    } catch {
        return jsonResponse({ error: 'Invalid request body' }, 400, respHeaders);
    }

    const { id, secret } = credentials;
    if (typeof id !== 'string' || !id || typeof secret !== 'string' || !secret) {
        return jsonResponse({ error: 'id and secret are required' }, 400, respHeaders);
    }
    console.log('Creating token for id:', id);
    if (shouldValidateCredentials(env)) {
        try {
            const profileUrl = new URL(PROFILE_URL);
            profileUrl.search = new URLSearchParams({ Numero: id, Motdepasse: secret }).toString();
            const profileResponse = await fetch(profileUrl, { method: 'GET' });

            if (!profileResponse.ok) {
                return jsonResponse({ error: 'Invalid MountyHall credentials' }, 401, respHeaders);
            }
        } catch (exception) {
            console.log('Credential validation failed:', exception);
            return jsonResponse({ error: 'Credential validation failed' }, 502, respHeaders);
        }
    }

    if (!env.USER_DATA || !env.CREDENTIALS_ENCRYPTION_KEY) {
        console.log('Token storage is not properly configured');
        return jsonResponse({ error: 'Token storage is not configured' }, 500, respHeaders);
    }

    const token = await createTokenValue(id);
    try {
        const encryptedSecret = await encryptSecret(secret, env.CREDENTIALS_ENCRYPTION_KEY);
        const existingUserData = await env.USER_DATA.get<StoredUserRecord>(`user:${token.idHash}`, { type: 'json' });
        const livingSessions = [];
        for (const session of existingUserData?.sessions ?? []) {
            const trySession = await env.USER_DATA.get<StoredSessionRecord>(`session:${session}`, { type: 'json' });
            if (trySession) {
                livingSessions.push(session);
            }
        }
        await env.USER_DATA.put(`session:${token.sessionId}`, JSON.stringify({ idHash: token.idHash, id, lastAccess: Date.now() }), { expirationTtl: 24*3600*30 });
        await env.USER_DATA.put(`user:${token.idHash}`, JSON.stringify({
            ...existingUserData,
            mh_user_id: id,
            mh_user_secret: encryptedSecret,
            sessions: [...livingSessions, token.sessionId],
        }));
    } catch {
        return jsonResponse({ error: 'Token storage failed' }, 500, respHeaders);
    }

    return jsonResponse({ token: token.token, profile: { id, isAdmin: checkIfAdmin(env, id) } }, 201, respHeaders);
}

export async function getProfile(request: Request, env: WorkerEnv, respHeaders: ResponseHeaders): Promise<Response> {
    const credentials = await getCredentials(request.headers, env);
    if (!credentials) {
        return jsonResponse({ error: 'Unauthorized' }, 401, respHeaders);
    }

    return jsonResponse({ id: credentials.id, isAdmin: credentials.isAdmin }, 200, respHeaders);
}


export async function getCredentials(headers: Headers, env: WorkerEnv): Promise<Credentials | null> {
    
    const token = headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return null;
    }

    try {
        if (!env.USER_DATA || !env.CREDENTIALS_ENCRYPTION_KEY) {
            throw new Error('Token storage is not configured');
        }

        const decodedToken = base64ToBytes(token);
        if (decodedToken.length !== 48) {
            return null;
        }
        const idHash = bytesToBase64(decodedToken.slice(0, 32));
        const sessionId = bytesToBase64(decodedToken.slice(32));

        const data = await env.USER_DATA.get<StoredUserRecord>(`user:${idHash}`, { type: 'json' });
        if (!data) {
            console.log(`User data not found for idHash: ${idHash}`);
            return null;
        }
        const sessionData = await env.USER_DATA.get<StoredSessionRecord>(`session:${sessionId}`, { type: 'json' });
        if (!sessionData) {
            console.log(`Session data not found for sessionId: ${sessionId}`);
            await env.USER_DATA.put(`user:${idHash}`, JSON.stringify({
                ...data,
                sessions: (data?.sessions ?? []).filter(session => session !== sessionId),
            }));
            return null;
        }

        const { mh_user_id: id, mh_user_secret: encryptedSecret, sessions } = data;    
        if (!sessions.includes(sessionId)) {
            console.log(`Session ID ${sessionId} not found in user's sessions`);
            return null;
        }

        await env.USER_DATA.put(`session:${sessionId}`, JSON.stringify({ ...sessionData, lastAccess: Date.now() }), { expirationTtl: 24*3600*30 });

        const secret = await decryptSecret(encryptedSecret, env.CREDENTIALS_ENCRYPTION_KEY);

        const isAdmin = checkIfAdmin(env, id);

        return { id, secret, idHash, isAdmin };
    } catch (error) {
        console.error('Error occurred while getting credentials:', error);
        return null;
    }
}

function checkIfAdmin(env: WorkerEnv, id: string): boolean {
    const adminIds = (env.ADMIN_IDS ?? '').split(','); // Replace with your actual admin IDs
    return adminIds.includes(id);
}

async function readCredentials(request: Request): Promise<CredentialInput> {
    const contentType = request.headers.get('Content-Type') ?? '';
    if (contentType.includes('application/json')) {
        const body: unknown = await request.json();
        return body && typeof body === 'object' ? body as CredentialInput : {};
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
        return Object.fromEntries(new URLSearchParams(await request.text()));
    }

    throw new Error('Unsupported content type');
}

function shouldValidateCredentials(env: WorkerEnv): boolean {
    return env.CREDENTIALS_VALIDATION_MOCK !== 'true';
}

async function createTokenValue(id: string) {
    const idHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id));
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return { token: bytesToBase64(new Uint8Array([ ...new Uint8Array(idHash), ...bytes])), sessionId: bytesToBase64(bytes), idHash: bytesToBase64(new Uint8Array(idHash)) };
}

async function encryptSecret(secret: string, encryptionKey: string): Promise<EncryptedSecret> {
    const keyBytes = base64ToBytes(encryptionKey);
    if (keyBytes.length !== 32) {
        throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes');
    }

    const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['encrypt'],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(secret),
    );

    return {
        version: 1,
        algorithm: 'AES-256-GCM',
        iv: bytesToBase64(iv),
        ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    };
}

async function decryptSecret(encryptedData: EncryptedSecret, encryptionKey: string): Promise<string> {
    const keyBytes = base64ToBytes(encryptionKey);
    if (keyBytes.length !== 32) {
        throw new Error('CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes');
    }

    const key = await crypto.subtle.importKey(
        'raw',
        keyBytes,
        { name: 'AES-GCM' },
        false,
        ['decrypt'],
    );
    const iv = base64ToBytes(encryptedData.iv);
    const ciphertext = base64ToBytes(encryptedData.ciphertext);
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        ciphertext,
    );

    return new TextDecoder().decode(decrypted);
}

function base64ToBytes(value: string): Uint8Array {
    try {
        const binary = atob(value);
        return Uint8Array.from(binary, character => character.charCodeAt(0));
    } catch (error) {
        return new Uint8Array(0);
    }
}

function bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}
