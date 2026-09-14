import { useState } from 'react';
import './SidePanel.css';
import { useData } from './DataContext.mjs';

function formatLegendColor(color) {
  if (color?.getHexString) {
    return `#${color.getHexString()}`;
  }
  if (typeof color === 'number') {
    return `#${color.toString(16).padStart(6, '0')}`;
  }
  return 'white';
}

function getLegendKey(item, legend) {
  if (item.type === 'lieux') {
    return item.typeLieu;
  }
  if (item.type === 'troll') {
    return 'trolls';
  }
  return legend[item.type] ? item.type : item.typeLieu;
}

function getObjectLabel(item) {
  return item.name || item.typeLieu || item.type || 'Objet';
}

function SidePanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [legendOpen, setLegendOpen] = useState(true);
  const [selectionOpen, setSelectionOpen] = useState(true);
  const { selection, legend, index } = useData();
  const [visible, setVisible] = useState(mapLegendVisibility(legend));

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  const legendClick = (item) => {
    if (item === 'all') {
        for (const x of Object.values(legend)) {
          if (x.items && x.mesh) {
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
  };

  return (
    <div id="side-panel" className={isOpen ? '' : 'collapsed'}>
      <button onClick={togglePanel}>
        <span>{isOpen ? '✖' : '☰'}</span>
      </button>
      {isOpen && legend && (
        <div id="side-panel-content">
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
          </div>
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
            {selectionOpen && selection && (
              <div className="selection-content">
                <div className="selection-summary">
                  <span
                    className="color-box"
                    style={{ backgroundColor: formatLegendColor(legend[getLegendKey(selection, legend)]?.color) }}
                  ></span>
                  <div>
                    <strong>{getObjectLabel(selection)}</strong>
                    <span className="selection-type">{selection.typeLieu || selection.type}</span>
                  </div>
                </div>
                <dl className="selection-details">
                  <div><dt>ID</dt><dd>{selection.id}</dd></div>
                  <div><dt>Coordinates</dt><dd>{selection.x}, {selection.y}, {selection.z}</dd></div>
                </dl>
                <h3>Objects at these coordinates</h3>
                <ul className="coordinate-objects">
                  {index.get(selection).map((x, ix) => { console.log(x, ix); return x; }).map((item, itemIndex) => (
                    <li key={`${item.type}-${item.id ?? itemIndex}`}>
                      <span
                        className="color-box"
                        style={{ backgroundColor: formatLegendColor(legend[getLegendKey(item, legend)]?.color) }}
                      ></span>
                      <span>
                        <strong>{getObjectLabel(item)}</strong>
                        <small>{item.typeLieu || item.type}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

    function mapLegendVisibility(legend) {
        return legend ?
            Object.fromEntries(Object.entries(legend).map(([legendKey, legendItem]) => [legendKey,legendItem.mesh?.visible?'visible':'hidden']))
            : {};
    }
}

export default SidePanel;
