import { createContext, useContext } from 'react';
import type { AppData, GeoIndex, PathNetworkOption, PathResult, PathStep, Point3D } from '../../shared/types';

export interface PathFindingContextValue {
  data: AppData | null;
  index: GeoIndex | null;
  path: PathStep[];
  pathOrigin: Point3D | null;
  findPath: (from: Point3D, target: Point3D, network?: string[]) => Promise<PathResult>;
  shortcutNetwork: string[];
  setShortcutNetwork: (network: string[]) => void;
  shortcutNetworks: PathNetworkOption[];
}

export const PathFindingContext = createContext<PathFindingContextValue | null>(null);

export function usePathFinding() {
  const context = useContext(PathFindingContext);
  if (!context) {
    throw new Error('usePathFinding must be used within a PathFindingProvider');
  }
  return context;
}
