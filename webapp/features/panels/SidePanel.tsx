import { useEffect, useState } from 'react';
import './SidePanel.css';
import Accordion from '../../shared/Accordion';
import { callWorker, useData } from '../../data/DataContext.ts';
import DataActions from './DataActions';
import InventoryContent from './InventoryContent';
import LegendContent from './LegendContent';
import MonsterDetailsPanel from './MonsterDetailsPanel';
import SelectionContent from './SelectionContent';
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
  const [selectedMonster, setSelectedMonster] = useState<CoordinateIndexedItem | null>(null);
  const { selection, legend, index, inventory, requestSceneRender, admin } = useData();
  const [visible, setVisible] = useState<DataGroupVisibility>(mapLegendVisibility(legend));

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
            <Accordion.Item id="legend" title="Légende" contentClassName="legend">
              <LegendContent legend={legend} visible={visible} onLegendClick={legendClick} />
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
