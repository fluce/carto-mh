import CenterViewButton from './CenterViewButton';
import type { Point3D } from './types';

interface CoordinatesProps {
  position: Point3D;
  label: string;
  className?: string;
  separator?: string;
}

function Coordinates({ position, label, className, separator = ', ' }: CoordinatesProps) {
  return (
    <span className={`coordinates${className ? ` ${className}` : ''}`}>
      <span>{[position.x, position.y, position.z].join(separator)}</span>
      <CenterViewButton
        position={position}
        className="coordinates-center-button"
        label={label}
      />
    </span>
  );
}

export default Coordinates;
