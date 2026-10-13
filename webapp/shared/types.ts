import type * as THREE from 'three';

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface MonsterDetailRange {
  min?: number;
  max?: number;
  min2?: number;
  max2?: number;
}

export type MonsterDetailValue = string | number | boolean | null | MonsterDetailRange;

export interface MonsterDetails {
  [key: string]: MonsterDetailValue | undefined;
  fam?: string;
  niv?: MonsterDetailRange;
}

export interface MonsterRecord extends MonsterDetails {
  id: string | number;
  lastRefresh?: string;
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

export interface CompressedHole {
  x: number;
  y: number;
  z1: number;
  z2: number;
  id1: string | number;
  id2: string | number;
}

export interface RawLocation extends Point3D {
  id: string | number;
  name: string;
  type: string;
  lastUpdate?: string;
  transportNetwork?: string;
  transportCost?: { cost: number; ration: number };
}

export interface TgvLocation {
  ID: string | number;
  Nom: string;
  X: number;
  Y: number;
  Z: number;
  Prix: number;
  FacteurPrix: number;
}

export interface IndexedItem extends Partial<Point3D> {
  id: string;
  kind: string[];
  name?: string;
  type?: string;
  typeLieu?: string;
  transportNetwork?: string;
  transportCost?: { cost: number; ration: number };
  race?: string;
  level?: string | number;
  guild?: { id: string; guildId?: string; name: string | null } | null;
  details?: MonsterDetails;
  [key: string]: unknown;
}

export type CoordinateIndexedItem = IndexedItem & Point3D;

export interface SearchableItem extends CoordinateIndexedItem {
  name?: string;
}

export interface SourceItem extends Partial<Point3D> {
  id: string;
  kind?: string[];
  name?: string;
  type?: string;
  typeLieu?: string;
  transportNetwork?: string;
  [key: string]: unknown;
}

export interface IndexSnapshot {
  geoIdx: Map<string, Set<CoordinateIndexedItem>>;
  idIdx: Map<string, IndexedItem>;
  kindIdx: Map<string, Set<IndexedItem>>;
  nameIdx: Map<string, Set<IndexedItem>>;
}

export interface GeoIndex {
  getById(id: string): IndexedItem | undefined;
  get(point: Point3D): CoordinateIndexedItem[];
  get(x: number, y: number, z: number): CoordinateIndexedItem[];
  getByKind(kind: string): IterableIterator<IndexedItem>;
  getAll(): IterableIterator<IndexedItem>;
  search(query: string, limit?: number): SearchableItem[];
}

export interface RenderItem extends Point3D {
  data: CoordinateIndexedItem;
}

export interface SceneMesh extends THREE.InstancedMesh {
  data: RenderItem[];
}

export interface DataGroup {
  items: CoordinateIndexedItem[];
  autocolor: boolean;
  mesh?: SceneMesh;
  color?: THREE.Color;
}

export interface DataGroupVisibility {
  [group: string]: 'visible' | 'hidden';
}

export interface AppData {
  groups: Record<string, DataGroup>;
  tgv: unknown[];
  raccourcis?: IndexedItem[];
}

export type ShortcutNetworks = 
  | 'ALL'
  | 'TGV'
  | 'TGV_REDUCED'
  | 'SHORTCUTS'
  | 'SHORTCUTS_REDUCED'
  | string;

export interface PathStep extends Point3D {
  cost: number;
  shortcut: boolean;
}

export interface SearchStats {
  poppedNodes: number;
  expandedNodes: number;
  stalePops: number;
  relaxations: number;
  maxOpenSetSize: number;
  shortcutEndpointCount: number;
}

export interface PathTimings {
  wasmInitializationDurationMs: number;
  pathfinderInitializationDurationMs: number;
  searchDurationMs: number;
  costAggregationDurationMs: number;
}

export interface PathResult {
  path: PathStep[];
  cost: number;
  stats: SearchStats;
  timings: PathTimings;
}

export interface PathNetworkOption {
  value: string;
  label: string;
}

export interface WorkerRequestMap {
  login: { id: string; secret: string };
  load: Record<string, never>;
  inventory: Record<string, never>;
  update: Record<string, never>;
  monsters: { ids: Array<Pick<IndexedItem, 'id' | 'name'>> };
}

export interface Profile {
  id: string;
  isAdmin: boolean;
}

export interface WorkerResultMap {
  login: { success: true; profile: Profile };
  load: IndexSnapshot;
  inventory: InventoryItem[];
  update: unknown;
  monsters: Array<MonsterDetails & { id: string | number }>;
}

export type DataWorkerRequest = {
  [Action in keyof WorkerRequestMap]: { type: Action; message_id: string } & WorkerRequestMap[Action]
}[keyof WorkerRequestMap];

export type DataWorkerResponse =
  | { type: 'ready'; profile: Profile }
  | { type: 'need:login' }
  | { type: 'result:login'; message_id: string; result: WorkerResultMap['login'] }
  | { type: 'result:load'; message_id: string; result: WorkerResultMap['load'] }
  | { type: 'result:inventory'; message_id: string; result: WorkerResultMap['inventory'] }
  | { type: 'result:update'; message_id: string; result: WorkerResultMap['update'] }
  | { type: 'result:monsters'; message_id: string; result: WorkerResultMap['monsters'] }
  | { type: 'error:login' | 'error:load' | 'error:inventory' | 'error:update' | 'error:monsters' | 'error:unknown'; message_id?: string; error: string };