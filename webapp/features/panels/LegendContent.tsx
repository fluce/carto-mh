import type { DataGroup, DataGroupVisibility } from '../../shared/types';
import DualRangeSlider from '../../shared/DualRangeSlider';
import { formatLegendColor, MONSTER_LEVEL_MAX } from './panelUtils';

interface LegendContentProps {
  legend: Record<string, DataGroup> | null;
  visible: DataGroupVisibility;
  onLegendClick: (item: 'all' | DataGroup) => void;
  onLoadMonsterDetails: () => void;
  detailsPending: boolean;
  detailsError: string | null;
  detailsProgress: { completed: number; total: number };
  hasMonsters: boolean;
  minimumMonsterLevel: number;
  maximumMonsterLevel: number;
  onMonsterLevelRangeChange: (minimumLevel: number, maximumLevel: number) => void;
}

function LegendContent({ legend, visible, onLegendClick, onLoadMonsterDetails, detailsPending, detailsError, detailsProgress, hasMonsters, minimumMonsterLevel, maximumMonsterLevel, onMonsterLevelRangeChange }: LegendContentProps) {
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
      <fieldset className="legend-level-filter">
        <legend>Niveau des monstres</legend>
        <DualRangeSlider
          min={0}
          max={MONSTER_LEVEL_MAX}
          lowerValue={minimumMonsterLevel}
          upperValue={maximumMonsterLevel}
          lowerLabel="Niveau minimum des monstres"
          upperLabel="Niveau maximum des monstres"
          formatUpperValue={value => value === MONSTER_LEVEL_MAX ? `${value}+` : String(value)}
          onChange={onMonsterLevelRangeChange}
        />
      </fieldset>
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