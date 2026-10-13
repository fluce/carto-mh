import type { DataGroup, DataGroupVisibility } from '../../shared/types';
import { formatLegendColor } from './panelUtils';

interface LegendContentProps {
  legend: Record<string, DataGroup> | null;
  visible: DataGroupVisibility;
  onLegendClick: (item: 'all' | DataGroup) => void;
  onLoadMonsterDetails: () => void;
  detailsPending: boolean;
  detailsError: string | null;
  detailsProgress: { completed: number; total: number };
  hasMonsters: boolean;
  monsterLevelThreshold: string;
  onMonsterLevelThresholdChange: (value: string) => void;
}

function LegendContent({ legend, visible, onLegendClick, onLoadMonsterDetails, detailsPending, detailsError, detailsProgress, hasMonsters, monsterLevelThreshold, onMonsterLevelThresholdChange }: LegendContentProps) {
  if (!legend) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className="legend-load-details"
        onClick={onLoadMonsterDetails}
        disabled={!hasMonsters || detailsPending}
      >
        {detailsPending
          ? `Chargement ${detailsProgress.completed}/${detailsProgress.total}`
          : 'Charger les détails'}
      </button>
      {detailsPending && (
        <progress
          className="legend-load-progress"
          value={detailsProgress.completed}
          max={Math.max(detailsProgress.total, 1)}
          aria-label="Progression du chargement des détails des monstres"
        />
      )}
      {detailsError && <p className="legend-load-error" role="alert">{detailsError}</p>}
      <label className="legend-level-filter">
        Niveau strictement supérieur à
        <input
          type="number"
          min="0"
          step="1"
          value={monsterLevelThreshold}
          onChange={event => onMonsterLevelThresholdChange(event.target.value)}
          aria-label="Afficher les monstres de niveau strictement supérieur à"
        />
      </label>
      <ul>
        <li onClick={() => onLegendClick('all')}>Tout</li>
        {Object.entries(legend).map(([legendKey, legendItem]) => (
          <li key={legendKey} onClick={() => onLegendClick(legendItem)}>
            <span
              className="color-box"
              style={{ backgroundColor: visible[legendKey] === 'hidden' ? 'white' : formatLegendColor(legendItem.color) }}
            ></span>
            {legendKey}
          </li>
        ))}
      </ul>
    </>
  );
}

export default LegendContent;