import { createContext, createElement, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Index } from './data/index.mjs';

export const DataContext = createContext(null);

let loginRequired = false;
const loginListeners = new Set();

function subscribeToLoginRequired(listener) {
  loginListeners.add(listener);
  if (loginRequired) {
    listener();
  }
  return () => loginListeners.delete(listener);
}

function setupWorker() {
  console.log("Starting Worker")
  const worker = new Worker(new URL('./dataWorker.mjs', import.meta.url), { type: 'module' });
  const ready = new Promise((resolve) => {
    worker.onmessage = event => {
        const [mainType, subType] = event.data.type.split(':');
        console.log("Received message from worker:", event.data);
        switch (mainType) {
          case 'ready':
            console.log("Worker is ready");
            resolve();
            break;
          case 'result': {
            console.log(`Worker has finished ${subType} !`);
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
          case 'error':
            console.error("Worker reported an error", event.data.error);
            calls.get(event.data.message_id)?.reject(new Error(event.data.error));
            calls.delete(event.data.message_id);
            break;
          case 'need':
            switch (subType) {
              case 'login':
                console.log("Worker indicates login is needed");
                loginRequired = true;
                loginListeners.forEach(listener => listener());
                break;
              default:
                console.log("Worker sent unknown need type:", subType);
                break;
            }
            break;
          default:
            console.log("Worker sent unknown message type:", event.data.type);
            break;
        }
      };
    worker.onerror = (event) => {
      console.error("Worker encountered an error:", event, worker);
      worker.terminate();
    };
  });
  return ready.then(() => worker);
}

const workerPromise = setupWorker();
const calls = new Map();

export async function callWorker(type, payload) 
{
  const worker = await workerPromise;
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    calls.set(id, { resolve, reject });
    worker.postMessage({ type, message_id: id, ...payload });
  });
}

async function loadData() {
  return callWorker('load', {});
}

async function queryMonsters(ids) {
  return callWorker('monsters', { ids })
}

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(null);
  const [selection, setSelection] = useState(null);
  const [highlighted, setHighlighted] = useState(null);
  const requestedMonsterIds = useRef(new Set());
  const [needsLogin, setNeedsLogin] = useState(loginRequired);
  const [loginError, setLoginError] = useState(null);
  const [loginPending, setLoginPending] = useState(false);

  useEffect(() => subscribeToLoginRequired(() => setNeedsLogin(true)), []);

  async function submitLogin(id, secret) {
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
      setLoginError(error.message);
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

  const contextValue = useMemo(() => ({
    data,
    index,
    legend: data?.groups ?? null,
    selection,
    setSelection,
    highlighted,
    setHighlighted,
    needsLogin,
    loginError,
    loginPending,
    submitLogin,
  }), [data, index, selection, highlighted, needsLogin, loginError, loginPending]);

  return createElement(DataContext.Provider, { value: contextValue }, children);
}

export function useData() {
  return useContext(DataContext);
}

function buildDataFromIndex(index) {
  const data = {
    groups: {
      ...index.getAll().reduce((acc, item) => {
        if (item.x === undefined || item.y === undefined || item.z === undefined) {
          return acc;
        }
        acc[item.type] ??= { items: [], autocolor: true };
        acc[item.type].items.push(item);
        return acc;
      }, {}),
    },
    tgv: [],
  };
  console.log('Initial data groups:', data.groups);
  data.groups.trolls.autocolor = false;
  data.groups.monstres.autocolor = false;
  data.groups.tresors.autocolor = false;
  console.log('Built data from index:', data);
  return data;
}
