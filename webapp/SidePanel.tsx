import { useState } from 'react';
import { Color } from 'three';
import './SidePanel.css';
import { callWorker, useData } from './DataContext.ts';
import type { CoordinateIndexedItem, DataGroup, DataGroupVisibility, MonsterDetailRange, MonsterDetails, MonsterDetailValue } from './types';

interface MonsterDetailGroup {
  title: string;
  fields: string[];
}

function formatLegendColor(color: Color | number | undefined) {
  if (color instanceof Color) {
    return `#${color.getHexString()}`;
  }
  if (typeof color === 'number') {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
  return 'white';
}

function getLegendKey(item: CoordinateIndexedItem, legend: Record<string, DataGroup>): string {
  if (item.type === 'lieux') {
    return item.typeLieu ?? '';
  }
  if (item.type === 'troll') {
    return 'trolls';
  }
  return item.type && legend[item.type] ? item.type : item.typeLieu ?? item.type ?? '';
}

function getObjectLabel(item: CoordinateIndexedItem) {
  return item.name || item.typeLieu || item.type || 'Objet';
}

function renderObjectLabel(item: CoordinateIndexedItem) {
  const label = getObjectLabel(item);
  const monsterName = item.type === 'monstres' && label.match(/^(.*?)(\s+\[[^\]]+\])$/);
  if (!monsterName) {
    return label;
  }
  return <>{monsterName[1]}<span className="monster-epithet">{monsterName[2]}</span></>;
}

function getMonsterLevel(niv: MonsterDetailRange) {
  if (niv.min === niv.max) {
    return `Niveau ${niv.min}`;
  }
  return `Niveau ${niv.min}-${niv.max}`;
}

const MONSTER_DETAIL_GROUPS = [
  { title: 'Identity', fields: ['fam', 'niv', 'vit', 'sangf'] },
  { title: 'Abilities', fields: ['pouv', 'portpouv', 'nb_att', 'attd', 'attm', 'vole', 'vlc'] },
  { title: 'Statistics', fields: ['pv', 'bless', 'att', 'esq', 'deg', 'reg', 'armP', 'armM', 'arm', 'MM', 'RM', 'vue', 'duree'] },
  { title: 'Record', fields: ['id', 'nom', 'timegmt', 'nCdM', 'Mode'] },
];

const MONSTER_DETAIL_LABELS: Record<string, string> = {
  id: 'ID',
  nom: 'Full name',
  fam: 'Family',
  niv: 'Level',
  bless: 'Injuries',
  pouv: 'Power',
  nb_att: 'Attacks',
  vit: 'Speed',
  attd: 'Att. D.',
  attm: 'Att. M.',
  sangf: 'Cold blood',
  portpouv: 'Power range',
  vole: 'Fly',
  vlc: 'See hidden',
  timegmt: 'Updated',
  pv: 'Health',
  att: 'Attack',
  esq: 'Dodge',
  deg: 'Damage',
  reg: 'Regeneration',
  armP: 'Physical armor',
  armM: 'Magical armor',
  arm: 'Armor',
  MM: 'Movement',
  RM: 'Magic resistance',
  vue: 'Sight',
  duree: 'Duration',
  Mode: 'Mode',
  nCdM: 'CdM count',
};

const MONSTER_DETAIL_FIELDS = new Set<string>(MONSTER_DETAIL_GROUPS.flatMap(group => group.fields));
const HIDDEN_MONSTER_DETAIL_FIELDS = new Set(['index']);

function getMonsterDetailGroups(details: MonsterDetails): MonsterDetailGroup[] {
  const groups = MONSTER_DETAIL_GROUPS
    .map(group => ({ ...group, fields: group.fields.filter(field => details[field] !== undefined) }))
    .filter(group => group.fields.length > 0);
  const otherFields = Object.keys(details).filter(field =>
    !MONSTER_DETAIL_FIELDS.has(field) && !HIDDEN_MONSTER_DETAIL_FIELDS.has(field)
  );
  if (otherFields.length > 0) {
    groups.push({ title: 'Other', fields: otherFields });
  }
  return groups;
}

function formatDetailRange(min: number | undefined, max: number | undefined) {
  if (min !== undefined && max !== undefined) {
    return min === max ? String(min) : `${min}-${max}`;
  }
  if (min !== undefined) {
    return `>= ${min}`;
  }
  if (max !== undefined) {
    return `<= ${max}`;
  }
  return null;
}

function formatMonsterDetail(field: string, value: MonsterDetailValue | undefined) {
  if (value === null || value === undefined) {
    return 'Not available';
  }
  if (field === 'timegmt' && typeof value === 'number') {
    return new Date(value * 1000).toLocaleString();
  }
  if (typeof value === 'object' && value !== null) {
    const primary = formatDetailRange(value.min, value.max);
    const secondary = formatDetailRange(value.min2, value.max2);
    return [primary, secondary].filter(Boolean).join(' / ') || JSON.stringify(value);
  }
  return String(value);
}

function SidePanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);
  const [selectionOpen, setSelectionOpen] = useState(true);
  const [updatePending, setUpdatePending] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [selectedMonster, setSelectedMonster] = useState<CoordinateIndexedItem | null>(null);
  const { selection, legend, index, requestSceneRender } = useData();
  const [visible, setVisible] = useState<DataGroupVisibility>(mapLegendVisibility(legend));

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  const updateData = async () => {
    setUpdatePending(true);
    setUpdateError(null);
    try {
      await callWorker('update', {});
    } catch (error) {
      setUpdateError(error instanceof Error ? error.message : String(error));
    } finally {
      setUpdatePending(false);
    }
  };

  const legendClick = (item: 'all' | DataGroup) => {
    if (!legend) return;
    if (item === 'all') {
        for (const x of Object.values(legend)) {
          if (x.mesh) {
                x.mesh.visible = !x.mesh.visible;
            }
        }
    } else {
        const mesh = item.mesh;
        if (mesh) {
          mesh.visible = !mesh.visible;
        }
    }
    setVisible(mapLegendVisibility(legend));
    requestSceneRender();
  };

  return (
    <div id="side-panel" className={isOpen ? '' : 'collapsed'}>
      <button onClick={togglePanel}>
        <span>{isOpen ? '✖' : '☰'}</span>
      </button>
      {isOpen && (
        <div id="side-panel-content">
          <div className="data-actions">
            <button type="button" onClick={updateData} disabled={updatePending}>
              {updatePending ? 'Updating...' : 'Update data'}
            </button>
            {updateError && <p role="alert">{updateError}</p>}
          </div>
          { legend && (
          <div className="legend">
            <button
              type="button"
              className="section-toggle"
              aria-expanded={legendOpen}
              onClick={() => setLegendOpen(!legendOpen)}
            >
              <span>Legend</span>
              <span>{legendOpen ? '−' : '+'}</span>
            </button>
            {legendOpen && (
              <ul>
                  <li onClick={()=>legendClick('all')}>Tout</li>
                  {Object.entries(legend).map(([legendKey, legendItem]) => (
                      <li key={legendKey} onClick={() => legendClick(legendItem)}>
                          { visible[legendKey]=='hidden' && (
                              <span className="color-box" style={{ backgroundColor: 'white' }}></span>
                          )}
                          { visible[legendKey]!='hidden' && (
                              <span className="color-box" style={{ backgroundColor: formatLegendColor(legendItem.color) }}></span>
                          )}
                          {legendKey}
                      </li>
                  ))}
              </ul>
            )}
          </div>)}
          <div className="selection">
            <button
              type="button"
              className="section-toggle"
              aria-expanded={selectionOpen}
              onClick={() => setSelectionOpen(!selectionOpen)}
            >
              <span>Selection</span>
              <span>{selectionOpen ? '−' : '+'}</span>
            </button>
            {selectionOpen && selection && index && legend && (
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
                  <div><dt>Coordinates</dt><dd>{selection.x}, {selection.y}, {selection.z}</dd></div>
                </dl>
                <h3>Objects at these coordinates</h3>
                <ul className="coordinate-objects">
                  {index.get(selection).map((item, itemIndex) => (
                    <li key={`${item.type}-${item.id ?? itemIndex}`}>
                      <span
                        className="color-box"
                        style={{ backgroundColor: formatLegendColor(legend[getLegendKey(item, legend)]?.color) }}
                      ></span>
                      <span className="coordinate-object-content">
                        <strong>{renderObjectLabel(item)}</strong>
                        <small>{item.typeLieu || item.type} - {item.id}</small>
                        { 
                        item.type === "trolls" && (
                          <>
                            <small> 
                              { item.race } - { item.level }
                            </small>
                            { item.guild && <small>{item.guild.name} [{item.guild.guildId}]</small> } 
                          </>
                        )}
                        { item.type === 'monstres' && (item.details?.fam || item.details?.niv) && <small>
                          {[item.details.fam, item.details.niv && getMonsterLevel(item.details.niv)].filter(Boolean).join(' - ')}
                          </small>}
                      </span>
                      {item.type === 'monstres' && (
                        <button
                          type="button"
                          className="coordinate-object-action"
                          aria-label={`Show details for ${item.name || 'monster'}`}
                          title="Show monster details"
                          onClick={() => setSelectedMonster(item)}
                        >
                          <span aria-hidden="true">›</span>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      {selectedMonster && (
        <aside className="monster-details-panel" aria-label="Monster details">
          <header className="monster-details-header">
            <div>
              <p>MONSTER PROFILE</p>
              <h2>{renderObjectLabel(selectedMonster)}</h2>
            </div>
            <button type="button" aria-label="Close monster details" onClick={() => setSelectedMonster(null)}>
              <span aria-hidden="true">×</span>
            </button>
          </header>
          {selectedMonster.details ? (
            <div className="monster-details-content">
              {getMonsterDetailGroups(selectedMonster.details).map(group => (
                <section key={group.title}>
                  <h3>{group.title}</h3>
                  <dl>
                    {group.fields.map(field => (
                      <div key={field}>
                        <dt>{MONSTER_DETAIL_LABELS[field] || field}</dt>
                        <dd>{formatMonsterDetail(field, selectedMonster.details?.[field])}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          ) : (
            <p className="monster-details-empty">Monster details are not available yet.</p>
          )}
        </aside>
      )}
    </div>
  );

    function mapLegendVisibility(legend: Record<string, DataGroup> | null): DataGroupVisibility {
        return legend ?
            Object.fromEntries(Object.entries(legend).map(([legendKey, legendItem]) => [legendKey,legendItem.mesh?.visible?'visible':'hidden']))
            : {};
    }
}

export default SidePanel;
