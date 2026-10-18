import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Index } from './index/indexCore.ts';
import type { AppData, CoordinateIndexedItem, DataGroup, DataWorkerResponse, IndexedItem, InventoryItem, JsonValue, Point3D, Profile, UserDataVersion, WorkerRequestMap, WorkerResultMap } from '../shared/types';

type PendingCall = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
};

export interface DataContextValue {
  data: AppData | null;
  inventory: InventoryItem[] | null;
  index: Index | null;
  dataReady: boolean;
  legend: Record<string, DataGroup> | null;
  hasMissingMonsterDetails: boolean;
  selection: CoordinateIndexedItem | null;
  setSelection: Dispatch<SetStateAction<CoordinateIndexedItem | null>>;
  highlighted: CoordinateIndexedItem | null;
  setHighlighted: Dispatch<SetStateAction<CoordinateIndexedItem | null>>;
  centerOnCell: ((position: Point3D) => void) | null;
  registerCenterOnCell: (center: (position: Point3D) => void) => () => void;
  loadMonsterDetails: (
    monsters: CoordinateIndexedItem[],
    onProgress?: (completed: number, total: number) => void,
  ) => Promise<void>;
  registerSceneRenderer: (renderer: () => void) => () => void;
  requestSceneRender: () => void;
  needsLogin: boolean;
  loginError: string | null;
  loginPending: boolean;
  submitLogin: (id: string, secret: string) => Promise<{ success: true }>;
  readUserData: <T extends JsonValue = JsonValue>() => Promise<UserDataVersion<T>>;
  writeUserData: (data: JsonValue, etag: string) => Promise<{ etag: string }>;
  admin: boolean;
}

export const DataContext = createContext<DataContextValue | null>(null);

let loginRequired = false;
const loginListeners = new Set<() => void>();

function subscribeToLoginRequired(listener: () => void) {
  loginListeners.add(listener);
  if (loginRequired) {
    listener();
  }
  return () => {
    loginListeners.delete(listener);
  };
}

function setupWorker() {
  console.log("Starting Worker")
  const worker = new Worker(new URL('./dataWorker.ts', import.meta.url), { type: 'module' });
  const ready = new Promise<Profile>((resolve) => {
    worker.onmessage = (event: MessageEvent<DataWorkerResponse>) => {
        console.log("Received message from worker:", event.data);
        switch (event.data.type) {
          case 'ready':
            console.log("Worker is ready");
            resolve(event.data.profile);
            break;
          case 'result:login':
          case 'result:load':
          case 'result:update':
          case 'result:monsters':
          case 'result:inventory': {
            const call = calls.get(event.data.message_id);
            if (call) {
              console.log(`Resolving call for worker result with id: ${event.data.message_id}`);
              call.resolve(event.data.result);
            } else {
              console.warn(`No call found for worker result with id: ${event.data.message_id}`);
            }
            calls.delete(event.data.message_id);
            break;
          }
          case 'result:readUserData':
          case 'result:writeUserData': {
            const call = calls.get(event.data.message_id);
            if (call) {
              call.resolve(event.data.result);
            } else {
              console.warn(`No call found for worker result with id: ${event.data.message_id}`);
            }
            calls.delete(event.data.message_id);
            break;
          }
          case 'error:login':
          case 'error:load':
          case 'error:update':
          case 'error:monsters':
          case 'error:inventory':
          case 'error:readUserData':
          case 'error:writeUserData':
          case 'error:unknown':
            console.error("Worker reported an error", event.data.error);
            if (event.data.message_id) {
              calls.get(event.data.message_id)?.reject(new Error(event.data.error));
              calls.delete(event.data.message_id);
            }
            break;
          case 'need:login':
            console.log("Worker indicates login is needed");
            loginRequired = true;
            loginListeners.forEach(listener => listener());
            break;
          default:
            break;
        }
      };
    worker.onerror = (event) => {
      console.error("Worker encountered an error:", event, worker);
      worker.terminate();
    };
  });
  return {workerForLogin: worker, ready: ready.then(profile => ({ worker, profile }))};
}

const { workerForLogin, ready: workerPromise } = setupWorker();
const calls = new Map<string, PendingCall>();
let pendingDataLoad: Promise<WorkerResultMap['load']> | null = null;
let pendingInventoryLoad: Promise<WorkerResultMap['inventory']> | null = null;

export async function callWorker<Action extends keyof WorkerRequestMap>(
  type: Action,
  payload: WorkerRequestMap[Action],
): Promise<WorkerResultMap[Action]>
{
  const worker = type === 'login' ? workerForLogin : (await workerPromise).worker;
  const id = crypto.randomUUID();
  return new Promise<WorkerResultMap[Action]>((resolve, reject) => {
    calls.set(id, {
      resolve: result => resolve(result as WorkerResultMap[Action]),
      reject,
    });
    worker.postMessage({ type, message_id: id, ...payload });
  });
}

export async function getProfile(): Promise<Profile> {
  const { profile } = await workerPromise;
  return profile;
}

export async function readUserData<T extends JsonValue = JsonValue>(): Promise<UserDataVersion<T>> {
  return await callWorker('readUserData', {}) as UserDataVersion<T>;
}

export async function writeUserData(data: JsonValue, etag: string): Promise<{ etag: string }> {
  return callWorker('writeUserData', { data, etag });
}

async function loadData() {
  if (!pendingDataLoad) {
    pendingDataLoad = callWorker('load', {}).finally(() => {
      pendingDataLoad = null;
    });
  }
  return pendingDataLoad;
}

async function queryMonsters(ids: Array<Pick<IndexedItem, 'id' | 'name'>>) {
  return callWorker('monsters', { ids })
}

async function loadInventory() {
  if (!pendingInventoryLoad) {
    pendingInventoryLoad = callWorker('inventory', {}).finally(() => {
      pendingInventoryLoad = null;
    });
  }
  return pendingInventoryLoad;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [index, setIndex] = useState<Index | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [selection, setSelection] = useState<CoordinateIndexedItem | null>(null);
  const [highlighted, setHighlighted] = useState<CoordinateIndexedItem | null>(null);
  const [centerOnCell, setCenterOnCell] = useState<((position: Point3D) => void) | null>(null);
  const sceneRenderers = useRef(new Set<() => void>());
  const requestedMonsterIds = useRef(new Set<string>());
  const pendingMonsterLoads = useRef(new Map<string, Promise<void>>());
  const [needsLogin, setNeedsLogin] = useState(loginRequired);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPending, setLoginPending] = useState(false);

  useEffect(() => subscribeToLoginRequired(() => setNeedsLogin(true)), []);

  async function submitLogin(id: string, secret: string) {
    console.log("Submitting login with ID:", id);
    setLoginPending(true);
    setLoginError(null);
    try {
      const result = await callWorker('login', { id, secret });
      setAdmin(result.profile.isAdmin);
      loginRequired = false;
      console.log("Login accepted");
      setNeedsLogin(false);
      return result;
    } catch (error) {
      console.error("Login failed:", error);
      setLoginError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setLoginPending(false);
    }
  }

  useEffect(() => {
    loadData()
      .then(loadedData => {
        console.log('Loaded data:', loadedData);
        const indexInstance = new Index(loadedData);
        setIndex(indexInstance);        
        setData(buildDataFromIndex(indexInstance));
        setDataReady(true);
      })
      .catch(error => {
        console.error('Unable to load data:', error);
      });

    loadInventory()
      .then(loadedInventory => setInventory(loadedInventory))
      .catch(error => console.error('Unable to load inventory:', error));

    getProfile().then(profile => setAdmin(profile.isAdmin));
    return () => {};
  }, []);

  const loadMonsterDetails = useCallback(async (
    monsters: CoordinateIndexedItem[],
    onProgress?: (completed: number, total: number) => void,
  ) => {
    const monstersWithIds = [...new Map(
      monsters
        .filter(isQueryableMonster)
        .map(monster => [String(monster.id), monster])
    ).values()];
    const total = monstersWithIds.length;
    const batchSize = 50;
    const pendingMonsters = monstersWithIds.filter(item =>
      pendingMonsterLoads.current.has(String(item.id))
    );
    const pendingLoads = [...new Set(pendingMonsters
      .map(monster => pendingMonsterLoads.current.get(String(monster.id)))
      .filter((load): load is Promise<void> => load !== undefined))];
    const monstersToLoad = monstersWithIds.filter(item =>
      !item.details &&
      !requestedMonsterIds.current.has(String(item.id)) &&
      !pendingMonsterLoads.current.has(String(item.id))
    );
    let completed = total - pendingMonsters.length - monstersToLoad.length;
    onProgress?.(completed, total);

    for (let offset = 0; offset < monstersToLoad.length; offset += batchSize) {
      const batch = monstersToLoad.slice(offset, offset + batchSize);

      for (const monster of batch) {
        requestedMonsterIds.current.add(String(monster.id));
      }

      if (batch.length > 0) {
        const load = queryMonsters(batch.map(({ id, name }) => ({ id, name })))
          .then(attributes => {
            const attributesById = new Map(
              (attributes ?? [])
                .filter(monster => monster.id !== undefined)
                .map(monster => [String(monster.id), monster])
            );

              for (const monster of batch) {
              const details = attributesById.get(String(monster.id));
              if (details) {
                Object.assign(monster, { details });
              }
            }

            setData(current => current ? {
              ...current,
              groups: {
                ...current.groups,
                monstres: {
                  ...current.groups.monstres,
                  items: [...current.groups.monstres.items],
                },
              },
            } : current);
          })
          .catch(error => {
            for (const monster of batch) {
              requestedMonsterIds.current.delete(String(monster.id));
            }
            throw error;
          });

        for (const monster of batch) {
          pendingMonsterLoads.current.set(String(monster.id), load);
        }

        const clearPending = () => {
          for (const monster of batch) {
            if (pendingMonsterLoads.current.get(String(monster.id)) === load) {
              pendingMonsterLoads.current.delete(String(monster.id));
            }
          }
        };
        void load.then(clearPending, clearPending);
        await load;
      }

      completed += batch.length;
      onProgress?.(completed, total);
    }

    await Promise.all(pendingLoads);
    completed += pendingMonsters.length;
    onProgress?.(completed, total);
  }, []);

  useEffect(() => {
    if (!selection || !index) {
      return;
    }

    const monsters = index.get(selection).filter(item => item.type === 'monstres');
    void loadMonsterDetails(monsters).catch(error => {
      console.error('Unable to load monster attributes:', error);
    });
  }, [selection, index, loadMonsterDetails]);

  const registerSceneRenderer = useCallback((renderer: () => void) => {
    sceneRenderers.current.add(renderer);
    return () => sceneRenderers.current.delete(renderer);
  }, []);
  const registerCenterOnCell = useCallback((center: (position: Point3D) => void) => {
    setCenterOnCell(() => center);
    return () => setCenterOnCell((current: ((position: Point3D) => void) | null) => current === center ? null : current);
  }, []);
  const requestSceneRender = useCallback(() => {
    sceneRenderers.current.forEach(renderer => renderer());
  }, []);
  const hasMissingMonsterDetails = Boolean(data?.groups.monstres.items.some(item =>
    isQueryableMonster(item) &&
    !item.details &&
    !requestedMonsterIds.current.has(String(item.id)) &&
    !pendingMonsterLoads.current.has(String(item.id))
  ));

  const contextValue = useMemo(() => ({
    data,
    inventory,
    index,
    dataReady,
    legend: data?.groups ?? null,
    hasMissingMonsterDetails,
    selection,
    setSelection,
    highlighted,
    setHighlighted,
    centerOnCell,
    registerCenterOnCell,
    loadMonsterDetails,
    registerSceneRenderer,
    requestSceneRender,
    needsLogin,
    loginError,
    loginPending,
    submitLogin,
    readUserData,
    writeUserData,
    admin
  }), [data, inventory, index, dataReady, selection, highlighted, centerOnCell, registerCenterOnCell, loadMonsterDetails, needsLogin, loginError, loginPending, registerSceneRenderer, requestSceneRender, hasMissingMonsterDetails, admin]);

  return createElement(DataContext.Provider, { value: contextValue }, children);
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

function buildDataFromIndex(index: Index): AppData {
  console.log('Building data from index:', index);
  const groups: Record<string, DataGroup> = {
    trolls: { items: [], autocolor: false },
    monstres: { items: [], autocolor: false },
    tresors: { items: [], autocolor: false },
  };
  for (const item of index.getAll()) {
    if (!isCoordinateItem(item)) {
      continue;
    }
    const groupName = String(item.type);
    groups[groupName] ??= { items: [], autocolor: true };
    groups[groupName].items.push(item);
  }
  const data: AppData = { groups, tgv: [] };
  console.log('Initial data groups:', data.groups);
  data.groups.trolls.autocolor = false;
  data.groups.monstres.autocolor = false;
  data.groups.tresors.autocolor = false;
  console.log('Built data from index:', data);
  return data;
}

function isCoordinateItem(item: IndexedItem): item is IndexedItem & { x: number; y: number; z: number } {
  return item.x !== undefined && item.y !== undefined && item.z !== undefined;
}

export function isQueryableMonster(item: IndexedItem): boolean {
  return item.id !== undefined && item.name !== "Créature Floue";
}