import type { Index } from '../../data/index/indexCore.ts';
import type { CoordinateIndexedItem, DataGroup, MonsterDetailRange } from '../../shared/types';
import { formatLegendColor, renderObjectLabel } from './panelUtils';

function getLegendKey(item: CoordinateIndexedItem, legend: Record<string, DataGroup>): string {
  if (item.type === 'lieux') {
    return item.typeLieu ?? '';
  }
  if (item.type === 'troll') {
    return 'trolls';
  }
  return item.type && legend[item.type] ? item.type : item.typeLieu ?? item.type ?? '';
}

function getMonsterLevel(niv: MonsterDetailRange) {
  if (niv.min === niv.max) {
    return `Niveau ${niv.min}`;
  }
  return `Niveau ${niv.min}-${niv.max}`;
}

function formatObjectId(id: string | number): string {
  if (typeof id === 'string') {
    const parts = id.split(':');
    return parts[parts.length - 1];
  }
  return id.toString();
}

interface SelectionContentProps {
  selection: CoordinateIndexedItem | null;
  index: Index | null;
  legend: Record<string, DataGroup> | null;
  onShowMonster: (monster: CoordinateIndexedItem) => void;
}

function SelectionContent({ selection, index, legend, onShowMonster }: SelectionContentProps) {
  if (!selection || !index || !legend) {
    return null;
  }

  return (
    <div className="selection-content">
      <div className="selection-summary">
        <span
          className="color-box"
          style={{ backgroundColor: formatLegendColor(legend[getLegendKey(selection, legend)]?.color) }}
        ></span>
        <div>
          <strong>{renderObjectLabel(selection)}</strong>
          <span className="selection-type">{selection.typeLieu || selection.type}</span>
        </div>
      </div>
      <dl className="selection-details">
        <div><dt>ID</dt><dd>{selection.id}</dd></div>
        <div><dt>Coordonnées</dt><dd>{selection.x}, {selection.y}, {selection.z}</dd></div>
      </dl>
      <h3>Objets à ces coordonnées</h3>
      <ul className="coordinate-objects">
        {index.get(selection).map((item, itemIndex) => (
          <li key={`${item.type}-${item.id ?? itemIndex}`}>
            <span
              className="color-box"
              style={{ backgroundColor: formatLegendColor(legend[getLegendKey(item, legend)]?.color) }}
            ></span>
            <span className="coordinate-object-content">
              <strong>{renderObjectLabel(item)}</strong>
              <small>{item.typeLieu || item.type} - {formatObjectId(item.id)}</small>
              {item.type === 'trolls' && (
                <>
                  <small>{item.race} - {item.level}</small>
                  {item.guild && <small>{item.guild.name} [{item.guild.guildId}]</small>}
                </>
              )}
              {item.type === 'monstres' && (item.details?.fam || item.details?.niv) && (
                <small>
                  {[item.details.fam, item.details.niv && getMonsterLevel(item.details.niv)].filter(Boolean).join(' - ')}
                </small>
              )}
            </span>
            {item.type === 'monstres' && (
              <button
                type="button"
                className="coordinate-object-action"
                aria-label={`Afficher la fiche de ${item.name || 'ce monstre'}`}
                title="Afficher la fiche du monstre"
                onClick={() => onShowMonster(item)}
              >
                <span aria-hidden="true">›</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SelectionContent;