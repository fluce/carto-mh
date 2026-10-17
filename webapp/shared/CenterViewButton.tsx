import { useData } from '../data/DataContext.ts';
import type { Point3D } from './types';

interface CenterViewButtonProps {
  position: Point3D | null;
  className: string;
  label: string;
}

function CenterViewButton({ position, className, label }: CenterViewButtonProps) {
  const { centerOnCell } = useData();

  return (
    <button
      type="button"
      className={className}
      onClick={() => position && centerOnCell?.(position)}
      disabled={!position || !centerOnCell}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="7" />
        <circle cx="12" cy="12" r="2" />
        <path d="M12 1v4m0 14v4M1 12h4m14 0h4" />
      </svg>
    </button>
  );
}

export default CenterViewButton;
