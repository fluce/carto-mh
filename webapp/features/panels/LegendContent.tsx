import type { DataGroup, DataGroupVisibility } from '../../shared/types';
import { formatLegendColor } from './panelUtils';

interface LegendContentProps {
  legend: Record<string, DataGroup> | null;
  visible: DataGroupVisibility;
  onLegendClick: (item: 'all' | DataGroup) => void;
}

function LegendContent({ legend, visible, onLegendClick }: LegendContentProps) {
  if (!legend) {
    return null;
  }

  return (
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
  );
}

export default LegendContent;