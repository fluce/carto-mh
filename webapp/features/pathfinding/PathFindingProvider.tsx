import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { findPath as findPathWithWasm } from './findPathWasm.ts';
import { useData } from '../../data/DataContext.ts';
import { PathFindingContext } from './PathFindingContext.ts';
import type { PathFindingContextValue } from './PathFindingContext.ts';
import type { InventoryItem, PathStep, Point3D, ShortcutNetworks } from '../../shared/types';

export function PathFindingProvider({ children }: { children: ReactNode }) {
  const { data, index, inventory } = useData();
  const [path, setPath] = useState<PathStep[]>([]);
  const [shortcutNetwork, setShortcutNetwork] = useState<ShortcutNetworks[]>(['ALL']);
  const pathOrigin = data
    ? (data.groups?.origine?.items ?? [{ x: 0, y: 0, z: 0 }])[0]
    : null;
  const shortcutNetworks = useMemo(() => [
    { value: 'ALL', label: 'Tous les réseaux' },
    { value: 'TGV', label: 'TGV' },
    { value: 'TGV_REDUCED', label: 'TGV hors tanières' },
    { value: 'SHORTCUTS', label: 'Raccourcis' },
    { value: 'SHORTCUTS_REDUCED', label: 'Raccourcis dont j\'ai la carte' },
    ...[...new Set((data?.raccourcis ?? []).map(raccourci => raccourci.typeLieu))]
      .filter((typeLieu): typeLieu is string => Boolean(typeLieu))
      .sort((first, second) => first.localeCompare(second))
      .map(typeLieu => ({ value: `raccourci:${typeLieu}`, label: typeLieu })),
  ], [data]);

  const findPath = useCallback(async (from: Point3D, target: Point3D, network = shortcutNetwork) => {
    if (!data || !index) {
      throw new Error('Le calcul d’itinéraire est encore en cours de chargement.');
    }

    const result = await findPathWithWasm(index, from, target, network, getOwnedMaps(inventory));
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

function getOwnedMaps(inventory: InventoryItem[]|null): string[] {  
  if (!inventory) return [];
  return inventory.filter(item => item.type === 'Carte' && item.name==="Carte des Raccourcis :").map(item => `shortcut:${item.magic}`);
}
