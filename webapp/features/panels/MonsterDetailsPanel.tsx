import type { CoordinateIndexedItem, MonsterDetails, MonsterDetailValue } from '../../shared/types';
import { renderObjectLabel } from './panelUtils';

interface MonsterDetailGroup {
  title: string;
  fields: string[];
}

interface MonsterDetailsPanelProps {
  monster: CoordinateIndexedItem;
  onClose: () => void;
}

const MONSTER_DETAIL_GROUPS = [
  { title: 'Identité', fields: ['fam', 'niv', 'vit', 'sangf'] },
  { title: 'Capacités', fields: ['pouv', 'portpouv', 'nb_att', 'attd', 'attm', 'vole', 'vlc'] },
  { title: 'Statistiques', fields: ['pv', 'bless', 'att', 'esq', 'deg', 'reg', 'armP', 'armM', 'arm', 'MM', 'RM', 'vue', 'duree'] },
  { title: 'Fiche', fields: ['id', 'nom', 'timegmt', 'nCdM', 'Mode'] },
];

const MONSTER_DETAIL_LABELS: Record<string, string> = {
  id: 'ID',
  nom: 'Nom complet',
  fam: 'Famille',
  niv: 'Niveau',
  bless: 'Blessures',
  pouv: 'Pouvoir',
  nb_att: 'Attaques',
  vit: 'Vitesse',
  attd: 'Attaque D.',
  attm: 'Attaque M.',
  sangf: 'Sang-froid',
  portpouv: 'Portée du pouvoir',
  vole: 'Vol',
  vlc: 'Vision du caché',
  timegmt: 'Mis à jour',
  pv: 'Points de vie',
  att: 'Attaque',
  esq: 'Esquive',
  deg: 'Dégâts',
  reg: 'Régénération',
  armP: 'Armure physique',
  armM: 'Armure magique',
  arm: 'Armure',
  MM: 'Déplacement',
  RM: 'Résistance magique',
  vue: 'Vue',
  duree: 'Durée',
  Mode: 'Mode',
  nCdM: 'Nombre de CdM',
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
    groups.push({ title: 'Autres', fields: otherFields });
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
    return 'Non renseigné';
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

function MonsterDetailsPanel({ monster, onClose }: MonsterDetailsPanelProps) {
  return (
    <aside className="monster-details-panel" aria-label="Fiche du monstre">
      <header className="monster-details-header">
        <div>
          <p>FICHE DU MONSTRE</p>
          <h2>{renderObjectLabel(monster)}</h2>
        </div>
        <button type="button" aria-label="Fermer la fiche du monstre" onClick={onClose}>
          <span aria-hidden="true">×</span>
        </button>
      </header>
      {monster.details ? (
        <div className="monster-details-content">
          {getMonsterDetailGroups(monster.details).map(group => (
            <section key={group.title}>
              <h3>{group.title}</h3>
              <dl>
                {group.fields.map(field => (
                  <div key={field}>
                    <dt>{MONSTER_DETAIL_LABELS[field] || field}</dt>
                    <dd>{formatMonsterDetail(field, monster.details?.[field])}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      ) : (
        <p className="monster-details-empty">La fiche de ce monstre n’est pas encore disponible.</p>
      )}
    </aside>
  );
}

export default MonsterDetailsPanel;