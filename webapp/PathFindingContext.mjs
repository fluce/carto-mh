import { createContext, useContext } from 'react';

export const PathFindingContext = createContext(null);

export function usePathFinding() {
  return useContext(PathFindingContext);
}
