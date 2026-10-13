import { useEffect, useState } from 'react';
import './SidePanel.css';
import Accordion from '../../shared/Accordion';
import { callWorker, useData } from '../../data/DataContext.ts';
import DataActions from './DataActions';
import InventoryContent from './InventoryContent';
import LegendContent from './LegendContent';
import MonsterDetailsPanel from './MonsterDetailsPanel';
import SelectionContent from './SelectionContent';
import { setInstanceVisibility } from '../map/geometryHelpers';
import { MONSTER_LEVEL_MAX } from './panelUtils';
import type { CoordinateIndexedItem, DataGroup, DataGroupVisibility } from '../../shared/types';

function mapLegendVisibility(legend: Record<string, DataGroup> | null): DataGroupVisibility {
  return legend
    ? Object.fromEntries(Object.entries(legend).map(([legendKey, legendItem]) => [
      legendKey,
      legendItem.mesh?.visible ? 'visible' : 'hidden',
    ]))
    : {};
}

function SidePanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [updatePending, setUpdatePending] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [detailsPending, setDetailsPending] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsProgress, setDetailsProgress] = useState({ completed: 0, total: 0 });
  const [monsterLevelRange, setMonsterLevelRange] = useState<[number, number]>([0, MONSTER_LEVEL_MAX]);
  const [selectedMonster, setSelectedMonster] = useState<CoordinateIndexedItem | null>(null);
  const { selection, legend, index, inventory, data, loadMonsterDetails, requestSceneRender, admin } = useData();
  const [visible, setVisible] = useState<DataGroupVisibility>(mapLegendVisibility(legend));

  useEffect(() => {
    const monsterGroup = data?.groups.monstres;
    if (!monsterGroup) return;

    const [minimumLevel, maximumLevel] = monsterLevelRange;
    const hasLevelFilter = minimumLevel > 0 || maximumLevel < MONSTER_LEVEL_MAX;
    const itemVisibility = monsterGroup.items.map(monster => {
      if (!hasLevelFilter) return true;
      const level = monster.details?.niv;
      if (!level) return true;
      const ranges: Array<[number | undefined, number | undefined]> = [
        [level.min, level.max],
        [level.min2, level.max2],
      ];
      const knownRanges = ranges.filter(([rangeMin, rangeMax]) =>
        typeof rangeMin === 'number' || typeof rangeMax === 'number'
      );
      if (knownRanges.length === 0) return true;

      return knownRanges.some(([rangeMin, rangeMax]) => {
        const lowerBound = rangeMin ?? rangeMax;
        const upperBound = rangeMax ?? rangeMin;
        return lowerBound !== undefined && upperBound !== undefined &&
          upperBound >= minimumLevel &&
          (maximumLevel === MONSTER_LEVEL_MAX || lowerBound <= maximumLevel);
      });
    });

    monsterGroup.itemVisibility = itemVisibility;
    monsterGroup.mesh?.data.forEach((_, index) => {
      setInstanceVisibility(monsterGroup.mesh!, index, itemVisibility[index] ?? true);
    });
    requestSceneRender();
  }, [data, monsterLevelRange, requestSceneRender]);

  useEffect(() => {
    if (selection) setIsOpen(true);
  }, [selection]);

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

  const loadVisibleMonsterDetails = async () => {
    setDetailsPending(true);
    setDetailsError(null);
    setDetailsProgress({ completed: 0, total: 0 });
    try {
      await loadMonsterDetails(data?.groups.monstres.items ?? [], (completed, total) => {
        setDetailsProgress({ completed, total });
      });
    } catch (error) {
      setDetailsError(error instanceof Error ? error.message : String(error));
    } finally {
      setDetailsPending(false);
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
           { admin && <DataActions pending={updatePending} error={updateError} onUpdate={updateData} />}
          <Accordion
            key={selection ? `${selection.type}:${selection.id}` : 'none'}
            initialOpenId={selection ? 'selection' : 'legend'}
          >
            <Accordion.Item id="legend" title="Vue" contentClassName="legend">
              <LegendContent
                legend={legend}
                visible={visible}
                onLegendClick={legendClick}
                onLoadMonsterDetails={loadVisibleMonsterDetails}
                detailsPending={detailsPending}
                detailsError={detailsError}
                detailsProgress={detailsProgress}
                hasMonsters={Boolean(data?.groups.monstres.items.length)}
                minimumMonsterLevel={monsterLevelRange[0]}
                maximumMonsterLevel={monsterLevelRange[1]}
                onMonsterLevelRangeChange={(minimumLevel, maximumLevel) => {
                  setMonsterLevelRange([minimumLevel, maximumLevel]);
                }}
              />
            </Accordion.Item>
            <Accordion.Item id="selection" title="Sélection">
              <SelectionContent
                selection={selection}
                index={index}
                legend={legend}
                onShowMonster={setSelectedMonster}
              />
            </Accordion.Item>
            <Accordion.Item id="inventory" title="Inventaire">
              <InventoryContent inventory={inventory} />
            </Accordion.Item>
          </Accordion>
        </div>
      )}
      {selectedMonster && (
        <MonsterDetailsPanel monster={selectedMonster} onClose={() => setSelectedMonster(null)} />
      )}
    </div>
  );
}

export default SidePanel;
