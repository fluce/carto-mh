import { createContext, createElement, useContext, useEffect, useMemo, useState } from 'react';
import { createIndex } from './dataIndex.mjs';

export const DataContext = createContext(null);
let dataPromise;

function loadData() {
  if (dataPromise) return dataPromise;

  console.log("Starting Worker")
  const worker = new Worker(new URL('./dataWorker.mjs', import.meta.url), { type: 'module' });
  dataPromise = new Promise((resolve, reject) => {
    
    worker.onmessage = event => {
      if (event.data.type === 'ready') {
        console.log("Worker is ready");
        worker.postMessage({ type: 'load' });
      } else if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        console.log("Worker has loaded data");
        resolve(event.data);
      }
    };
    worker.onerror = reject;
  }).finally(() => worker.terminate());

  return dataPromise;
}

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [index, setIndex] = useState(null);
  const [selection, setSelection] = useState(null);
  const [highlighted, setHighlighted] = useState(null);

  useEffect(() => {
    loadData()
      .then(loadedData => {
        console.log('Loaded data:', loadedData);
        setData(loadedData.data);
        setIndex(createIndex(loadedData.index));
      })
      .catch(error => {
        console.error('Unable to load data:', error);
      });

    return () => {};
  }, []);

  const contextValue = useMemo(() => ({
    data,
    index,
    legend: data?.groups ?? null,
    selection,
    setSelection,
    highlighted,
    setHighlighted,
  }), [data, selection, highlighted]);

  return createElement(DataContext.Provider, { value: contextValue }, children);
}

export function useData() {
  return useContext(DataContext);
}
