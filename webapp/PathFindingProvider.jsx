import { useCallback, useEffect, useMemo, useState } from 'react';
import { findPath as findPathWithWasm } from './findPathWasm.mjs';
import { useData } from './DataContext.mjs';
import { PathFindingContext } from './PathFindingContext.mjs';

export function PathFindingProvider({ children }) {
  const { data, index } = useData();
  const [path, setPath] = useState([]);
  const [shortcutNetwork, setShortcutNetwork] = useState(['all']);
  const pathOrigin = data
    ? (data.groups?.origine?.items ?? [{ x: 0, y: 0, z: 0 }])[0]
    : null;
  const shortcutNetworks = useMemo(() => [
    { value: 'all', label: 'All networks' },
    { value: 'tgv', label: 'TGV' },
    { value: 'tgv-reduced', label: 'TGV hors tanières' },
    { value: 'raccourcis', label: 'Raccourcis' },
    { value: 'raccourcis-reduced', label: 'Raccourcis dont j\'ai la carte' },
    ...[...new Set((data?.raccourcis ?? []).map(raccourci => raccourci.typeLieu))]
      .filter(Boolean)
      .sort((first, second) => first.localeCompare(second))
      .map(typeLieu => ({ value: `raccourci:${typeLieu}`, label: typeLieu })),
  ], [data]);

  const findPath = useCallback(async (from, target, network = shortcutNetwork) => {
    if (!data || !index) {
      throw new Error('Pathfinder is still loading.');
    }

    const result = await findPathWithWasm(index, from, target, network);
    setPath(result.path);
    return result;
  }, [data, index, shortcutNetwork]);

  useEffect(() => {
    if (!data || !index || !pathOrigin) return;
    //findPath(pathOrigin, { x: 65, y: 0, z: 0 });
  }, [data, index, pathOrigin, findPath]);

  const contextValue = useMemo(() => ({
    data,
    index,
    path,
    pathOrigin,
    findPath,
    shortcutNetwork,
    setShortcutNetwork,
    shortcutNetworks,
  }), [data, index, path, pathOrigin, findPath, shortcutNetwork, shortcutNetworks]);

  return (
    <PathFindingContext.Provider value={contextValue}>
      {children}
    </PathFindingContext.Provider>
  );
}
