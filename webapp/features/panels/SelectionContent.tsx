import type { Index } from '../../data/index/indexCore.ts';
import { useUserData } from '../../data/UserDataContext.tsx';
import Coordinates from '../../shared/Coordinates';
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
  const { userData, updateUserData, error: userDataError } = useUserData();
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
        <div>
          <dt>Coordonnées</dt>
          <dd>
            <Coordinates
              position={selection}
              label="Centrer la vue sur cette case"
              className="selection-coordinate"
            />
          </dd>
        </div>
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
              <span className="coordinate-object-heading">
                <strong>{renderObjectLabel(item)}</strong>
                {item.type === 'trolls' && (
                  <RelationStateButton
                    entityType="troll"
                    entityId={item.id}
                    entityName={item.name ?? formatObjectId(item.id)}
                    friendIds={userData?.friendTrolls ?? []}
                    foeIds={userData?.foeTrolls ?? []}
                    onChange={nextState => updateUserData(current => ({
                      ...current,
                      friendTrolls: updateIds(current.friendTrolls, item.id, nextState === 'friend'),
                      foeTrolls: updateIds(current.foeTrolls, item.id, nextState === 'foe'),
                    }))}
                  />
                )}
              </span>
              <small>{item.typeLieu || item.type} - {formatObjectId(item.id)}</small>
              {item.type === 'trolls' && (
                <>
                  <small>{item.race} - {item.level}</small>
                  {item.guild && (
                    <span className="coordinate-object-guild">
                      <small>{item.guild.name} [{item.guild.guildId}]</small>
                      <RelationStateButton
                        entityType="guilde"
                        entityId={item.guild.guildId ?? item.guild.id}
                        entityName={item.guild.name ?? item.guild.guildId ?? item.guild.id}
                        friendIds={userData?.friendGuilds ?? []}
                        foeIds={userData?.foeGuilds ?? []}
                        onChange={nextState => updateUserData(current => ({
                          ...current,
                          friendGuilds: updateIds(current.friendGuilds, item.guild!.guildId ?? item.guild!.id, nextState === 'friend'),
                          foeGuilds: updateIds(current.foeGuilds, item.guild!.guildId ?? item.guild!.id, nextState === 'foe'),
                        }))}
                      />
                    </span>
                  )}
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
      {userDataError && <p className="user-data-error" role="alert">Impossible d'enregistrer les préférences : {userDataError}</p>}
    </div>
  );
}

type GuildState = 'neutral' | 'friend' | 'foe';

interface RelationStateButtonProps {
  entityType: 'guilde' | 'troll';
  entityId: string | number;
  entityName: string;
  friendIds: Array<string | number>;
  foeIds: Array<string | number>;
  onChange: (state: GuildState) => Promise<void>;
}

function RelationStateButton({ entityType, entityId, entityName, friendIds, foeIds, onChange }: RelationStateButtonProps) {
  const isFriend = friendIds.some(id => String(id) === String(entityId));
  const isFoe = foeIds.some(id => String(id) === String(entityId));
  const currentState: GuildState = isFriend ? 'friend' : isFoe ? 'foe' : 'neutral';
  const nextState: GuildState = currentState === 'neutral' ? 'friend' : currentState === 'friend' ? 'foe' : 'neutral';
  const friendLabel = entityType === 'guilde' ? 'amie' : 'ami';
  const foeLabel = entityType === 'guilde' ? 'ennemie' : 'ennemi';
  const stateLabel = currentState === 'friend' ? friendLabel : currentState === 'foe' ? foeLabel : 'neutre';
  const nextLabel = nextState === 'friend' ? friendLabel : nextState === 'foe' ? foeLabel : 'neutre';
  const action = entityType === 'guilde' ? 'la marquer' : 'le marquer';

  return (
    <button
      type="button"
      className={`relation-state-button relation-state-button--${currentState}`}
      aria-label={`${entityType === 'guilde' ? 'Guilde' : 'Troll'} ${entityName}, état ${stateLabel}. Cliquer pour ${action} comme ${nextLabel}.`}
      title={`État : ${stateLabel}. Cliquer pour passer à ${nextLabel}.`}
      onClick={() => {
        void onChange(nextState).catch(error => console.error('Unable to save relation state:', error));
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {currentState === 'friend'
          ? <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
          : currentState === 'foe'
            ? <><path d="m5 4 15 15M4 20l8-8m2-6 5-5m-2 8 5-5M4 4l5 5m-2 2 5 5" /><path d="m3 3 4 1 1 4M21 3l-4 1-1 4" /></>
            : <><circle cx="12" cy="12" r="8.5" /><path d="M12 12h0" /></>}
      </svg>
    </button>
  );
}

function updateIds(ids: Array<string | number>, entityId: string | number, include: boolean): Array<string | number> {
  const remaining = ids.filter(id => String(id) !== String(entityId));
  return include ? [...remaining, entityId] : remaining;
}

export default SelectionContent;