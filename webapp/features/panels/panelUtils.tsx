import { Color } from 'three';
import type { CoordinateIndexedItem } from '../../shared/types';

export { MONSTER_LEVEL_MAX } from '../../shared/constants';

export function formatLegendColor(color: Color | number | undefined) {
  if (color instanceof Color) {
    return `#${color.getHexString()}`;
  }
  if (typeof color === 'number') {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
  return 'white';
}

function getObjectLabel(item: CoordinateIndexedItem) {
  return item.name || item.typeLieu || item.type || 'Objet';
}

export function renderObjectLabel(item: CoordinateIndexedItem) {
  const label = getObjectLabel(item);
  const monsterName = item.type === 'monstres' && label.match(/^(.*?)(\s+\[[^\]]+\])$/);
  if (!monsterName) {
    return label;
  }
  return <>{monsterName[1]}<span className="monster-epithet">{monsterName[2]}</span></>;
}
