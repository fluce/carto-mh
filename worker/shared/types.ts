export type WorkerEnv = Env;
export type ResponseHeaders = Record<string, string>;

export interface CredentialInput {
  id?: unknown;
  secret?: unknown;
}

export interface Credentials {
  id: string;
  secret: string;
  idHash: string;
}

export interface EncryptedSecret {
  version: 1;
  algorithm: 'AES-256-GCM';
  iv: string;
  ciphertext: string;
}

export interface StoredUserRecord {
  mh_user_id: string;
  mh_user_secret: EncryptedSecret;
  sessions: string[];
  [key: string]: unknown;
}

export interface StoredSessionRecord {
  idHash: string;
  id: string;
  lastAccess: number;
  [key: string]: unknown;
}

export interface CachedView {
  data: string;
  updateDate: number;
}

export interface InventoryItem {
  id: number;
  equipped: number;
  type: string;
  identified: boolean;
  name: string;
  magic: string;
  description: string | null;
  weight: number | string;
  durability: string;
}

export interface CachedInventory {
  items: InventoryItem[];
  loadedAt: number;
}

export interface MonsterLookupItem {
  id: string | number;
  name: string;
}