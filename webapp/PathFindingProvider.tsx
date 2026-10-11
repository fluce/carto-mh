import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { findPath as findPathWithWasm } from './findPathWasm.ts';
import { useData } from './DataContext.ts';
import { PathFindingContext } from './PathFindingContext.ts';
import type { PathFindingContextValue } from './PathFindingContext.ts';
import type { PathStep, Point3D } from './types';

export function PathFindingProvider({ children }: { children: ReactNode }) {
  const { data, index } = useData();
  const [path, setPath] = useState<PathStep[]>([]);
  const [shortcutNetwork, setShortcutNetwork] = useState<string[]>(['all']);
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
      .filter((typeLieu): typeLieu is string => Boolean(typeLieu))
      .sort((first, second) => first.localeCompare(second))
      .map(typeLieu => ({ value: `raccourci:${typeLieu}`, label: typeLieu })),
  ], [data]);

  const findPath = useCallback(async (from: Point3D, target: Point3D, network = shortcutNetwork) => {
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

  const contextValue: PathFindingContextValue = useMemo(() => ({
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
