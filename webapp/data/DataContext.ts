import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { Index } from './index/indexCore.ts';
import type { AppData, CoordinateIndexedItem, DataGroup, DataWorkerResponse, IndexedItem, WorkerRequestMap, WorkerResultMap } from '../shared/types';

type PendingCall = {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
};

export interface DataContextValue {
  data: AppData | null;
  index: Index | null;
  legend: Record<string, DataGroup> | null;
  selection: CoordinateIndexedItem | null;
  setSelection: Dispatch<SetStateAction<CoordinateIndexedItem | null>>;
  highlighted: CoordinateIndexedItem | null;
  setHighlighted: Dispatch<SetStateAction<CoordinateIndexedItem | null>>;
  registerSceneRenderer: (renderer: () => void) => () => void;
  requestSceneRender: () => void;
  needsLogin: boolean;
  loginError: string | null;
  loginPending: boolean;
  submitLogin: (id: string, secret: string) => Promise<{ success: true }>;
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
  const ready = new Promise<void>((resolve) => {
    worker.onmessage = (event: MessageEvent<DataWorkerResponse>) => {
        console.log("Received message from worker:", event.data);
        switch (event.data.type) {
          case 'ready':
            console.log("Worker is ready");
            resolve();
            break;
          case 'result:login':
          case 'result:load':
          case 'result:update':
          case 'result:monsters': {
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
          case 'error:login':
          case 'error:load':
          case 'error:update':
          case 'error:monsters':
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
  return {workerForLogin: worker, ready: ready.then(() => worker)};
}

const { workerForLogin, ready: workerPromise } = setupWorker();
const calls = new Map<string, PendingCall>();

export async function callWorker<Action extends keyof WorkerRequestMap>(
  type: Action,
  payload: WorkerRequestMap[Action],
): Promise<WorkerResultMap[Action]>
{
  const worker = type === 'login' ? workerForLogin : await workerPromise;
  const id = crypto.randomUUID();
  return new Promise<WorkerResultMap[Action]>((resolve, reject) => {
    calls.set(id, {
      resolve: result => resolve(result as WorkerResultMap[Action]),
      reject,
    });
    worker.postMessage({ type, message_id: id, ...payload });
  });
}

async function loadData() {
  return callWorker('load', {});
}

async function queryMonsters(ids: Array<Pick<IndexedItem, 'id' | 'name'>>) {
  return callWorker('monsters', { ids })
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [index, setIndex] = useState<Index | null>(null);
  const [selection, setSelection] = useState<CoordinateIndexedItem | null>(null);
  const [highlighted, setHighlighted] = useState<CoordinateIndexedItem | null>(null);
  const sceneRenderers = useRef(new Set<() => void>());
  const requestedMonsterIds = useRef(new Set());
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
      })
      .catch(error => {
        console.error('Unable to load data:', error);
      });

    return () => {};
  }, []);

  useEffect(() => {
    if (!selection || !index) {
      return;
    }

    const monsters = index.get(selection).filter(item => item.type === 'monstres');
    const missingAttributes = monsters.filter(item =>
      item.id !== undefined && !item.details && !requestedMonsterIds.current.has(String(item.id))
    );
    if (missingAttributes.length === 0) {
      return;
    }

    for (const monster of missingAttributes) {
      requestedMonsterIds.current.add(String(monster.id));
    }

    queryMonsters(missingAttributes.map(({ id, name }) => ({ id, name })))
      .then(attributes => {
        const attributesById = new Map(
          (attributes ?? [])
            .filter(monster => monster.id !== undefined)
            .map(monster => [String(monster.id), monster])
        );

        for (const monster of missingAttributes) {
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
        for (const monster of missingAttributes) {
          requestedMonsterIds.current.delete(String(monster.id));
        }
        console.error('Unable to load monster attributes:', error);
      });
  }, [selection, index]);

  const registerSceneRenderer = useCallback((renderer: () => void) => {
    sceneRenderers.current.add(renderer);
    return () => sceneRenderers.current.delete(renderer);
  }, []);
  const requestSceneRender = useCallback(() => {
    sceneRenderers.current.forEach(renderer => renderer());
  }, []);

  const contextValue = useMemo(() => ({
    data,
    index,
    legend: data?.groups ?? null,
    selection,
    setSelection,
    highlighted,
    setHighlighted,
    registerSceneRenderer,
    requestSceneRender,
    needsLogin,
    loginError,
    loginPending,
    submitLogin,
  }), [data, index, selection, highlighted, needsLogin, loginError, loginPending, registerSceneRenderer, requestSceneRender]);

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
