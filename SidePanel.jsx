import { useState, useContext } from 'react';
import './SidePanel.css';
import { SidePanelContext } from './SidePanelContext.mjs';

function SidePanel() {
  const [isOpen, setIsOpen] = useState(true);
  const { selection, legend } = useContext(SidePanelContext);
  const [visible, setVisible] = useState(mapLegendVisibility(legend));

  const togglePanel = () => {
    setIsOpen(!isOpen);
  };

  const legendClick = (item) => {
    if (item === 'all') {
        for (const x of Object.values(legend)) {
            if (x.items) {
                x.mesh.visible = !x.mesh.visible;
            }
        }
    } else {
        const mesh = item.mesh;
        mesh.visible = !mesh.visible;
    }
    setVisible(mapLegendVisibility(legend));
  };

  return (
    <div id="side-panel" className={isOpen ? '' : 'collapsed'}>
      <button onClick={togglePanel}>
        <span>{isOpen ? '✖' : '☰'}</span>
      </button>
      {isOpen && selection && legend && (
        <div id="side-panel-content">
          <div className="legend">
            <h2>Legend</h2>
            <ul>
                <li onClick={()=>legendClick('all')}>Tout</li>
                {Object.entries(legend).map(([legendKey, legendItem]) => (
                    <li onClick={() => legendClick(legendItem)}>
                        { visible[legendKey]=='hidden' && (
                            <span className="color-box" style={{ backgroundColor: 'white' }}></span>
                        )}
                        { visible[legendKey]!='hidden' && (
                            <span className="color-box" style={{ backgroundColor: `#${legendItem.color.getHexString()}` }}></span>
                        )}
                        {legendKey}
                    </li>
                ))}
            </ul>
          </div>
          <div>
            <h2>Selection</h2>
            <p>{JSON.stringify(selection.currentData)}</p>
            <ul>{selection.dataAtPoint.map(x=><li>{JSON.stringify(x)}</li>)}</ul>
          </div>
        </div>
      )}
    </div>
  );

    function mapLegendVisibility(legend) {
        return legend ?
              Object.fromEntries(Object.entries(legend).map(([legendKey, legendItem]) => [legendKey,legendItem.mesh.visible?'visible':'hidden']))
            : {};
    }
}

export default SidePanel;
