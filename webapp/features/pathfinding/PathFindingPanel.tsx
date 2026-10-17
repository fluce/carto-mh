import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { usePathFinding } from './PathFindingContext.ts';
import { useData } from '../../data/DataContext.ts';
import Coordinates from '../../shared/Coordinates';
import PathEndpointInput from './PathEndpointInput.tsx';
import type { GeoIndex } from '../../shared/types';
import type { PathStep, Point3D, SearchStats, PathTimings } from '../../shared/types';

interface PathEndpoint {
  value: string;
  point: Point3D | null;
}

interface PathInstruction {
  kind: 'start' | 'tgv' | 'shortcut' | 'walk';
  beforePoint: string;
  point: Point3D;
  afterPoint: string;
  locationName: string;
  locationType: string;
}

interface CalculationSummary {
  cost: number;
  durationMs: number;
  stats: SearchStats;
  timings: PathTimings;
}

function formatPoint(point: Point3D) {
  return `${point.x},${point.y},${point.z}`;
}

function parsePoint(value: string): Point3D {
  const coordinates = value.split(',').map(item => Number(item.trim()));
  if (coordinates.length !== 3 || coordinates.some(coordinate => !Number.isInteger(coordinate))) {
    throw new Error('Choisissez une suggestion ou saisissez trois entiers séparés par des virgules.');
  }
  return { x: coordinates[0], y: coordinates[1], z: coordinates[2] };
}

function getLocationInfo(index: GeoIndex | null, point: Point3D) {
  const location = (index?.get(point) ?? [])
    .filter(item => item.kind?.includes('location'))[0]
  return {
    name: location?.name ?? '',
    type: location?.type ?? '',
    isTgv: location?.transportNetwork === 'tgv',
  };
}

function formatCost(cost: number) {
  return cost === 0 ? '' : ` (coût : ${cost})`;
}

function getInstructions(path: PathStep[], index: GeoIndex | null): PathInstruction[] {
  if (path.length === 0) return [];

  const startLocation = getLocationInfo(index, path[0]);
  const instructions: PathInstruction[] = [{
    kind: 'start',
    beforePoint: 'Départ depuis ',
    point: path[0],
    afterPoint: '',
    locationName: startLocation.name,
    locationType: startLocation.type,
  }];
  let stepIndex = 1;

  while (stepIndex < path.length) {
    if (path[stepIndex].shortcut) {
      const step = path[stepIndex];
      const destination = getLocationInfo(index, step);
      instructions.push({
        kind: destination.isTgv ? 'tgv' : 'shortcut',
        beforePoint: `Prendre ${destination.isTgv ? 'le TGV' : 'un raccourci'} jusqu’à `,
        point: step,
        afterPoint: formatCost(step.cost),
        locationName: destination.name,
        locationType: destination.type,
      });
      stepIndex += 1;
      continue;
    }

    let walkEndIndex = stepIndex;
    while (walkEndIndex + 1 < path.length && !path[walkEndIndex + 1].shortcut) {
      walkEndIndex += 1;
    }
    const walkStepCount = walkEndIndex - stepIndex + 1;
    const walkCost = path
      .slice(stepIndex, walkEndIndex + 1)
      .reduce((total, step) => total + step.cost, 0);
    const destination = getLocationInfo(index, path[walkEndIndex]);
    instructions.push({
      kind: 'walk',
      beforePoint: `Parcourir ${walkStepCount} ${walkStepCount === 1 ? 'étape' : 'étapes'} jusqu’à `,
      point: path[walkEndIndex],
      afterPoint: formatCost(walkCost),
      locationName: destination.name,
      locationType: destination.type,
    });
    stepIndex = walkEndIndex + 1;
  }

  return instructions;
}

function PathFindingPanel() {
  const {
    findPath,
    index,
    path,
    pathOrigin,
    shortcutNetwork,
    setShortcutNetwork,
    shortcutNetworks,
  } = usePathFinding();
  const { selection } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [from, setFrom] = useState<PathEndpoint>({ value: '', point: null });
  const [to, setTo] = useState<PathEndpoint>({ value: '65,0,0', point: null });
  const [error, setError] = useState('');
  const [calculation, setCalculation] = useState<CalculationSummary | null>(null);
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);

  useEffect(() => {
    if (pathOrigin) {
      setFrom({ value: formatPoint(pathOrigin), point: pathOrigin });
    }
  }, [pathOrigin]);

  async function handleFind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setCalculation(null);
    setShowCalculationDetails(false);

    try {
      const start = from.point ?? parsePoint(from.value);
      const target = to.point ?? parsePoint(to.value);
      const startedAt = performance.now();
      const result = await findPath(start, target);
      setCalculation({
        cost: result.cost,
        durationMs: performance.now() - startedAt,
        stats: result.stats,
        timings: result.timings,
      });
    } catch (pathError) {
      setError(pathError instanceof Error ? pathError.message : String(pathError));
    }
  }

  function toggleOpen() {
    if (!isOpen && selection) {
      setTo({ value: formatPoint(selection), point: selection });
    }
    setIsOpen(!isOpen);
  }

  function handleSwapEndpoints() {
    setFrom(to);
    setTo(from);
    setError('');
    setCalculation(null);
    setShowCalculationDetails(false);
  }

  function handleNetworkChange(event: ChangeEvent<HTMLSelectElement>) {
    const selectedNetworks = [...event.target.selectedOptions].map(option => option.value);
    setShortcutNetwork(selectedNetworks.includes('all') ? ['all'] : selectedNetworks);
  }

  return (
    <div id="path-finding-panel" className={isOpen ? 'open' : ''}>
      <div className="path-finding-header">
        {isOpen && <h2>Calcul d’itinéraire</h2>}
        <button
          type="button"
          className={isOpen ? 'path-finding-close' : ''}
          aria-label={isOpen ? 'Fermer le calculateur d’itinéraire' : 'Ouvrir le calculateur d’itinéraire'}
          onClick={toggleOpen}
        >
          {isOpen ? '×' : 'Itinéraire'}
        </button>
      </div>
      {isOpen && (
        <form onSubmit={handleFind}>
          <label>
            <span>Réseaux de raccourcis</span>
            <select
              multiple
              size={Math.min(shortcutNetworks.length, 5)}
              value={shortcutNetwork}
              onChange={handleNetworkChange}
            >
              {shortcutNetworks.map(network => (
                <option key={network.value} value={network.value}>{network.label}</option>
              ))}
            </select>
          </label>
          <div className="path-endpoints">
            <PathEndpointInput
              id="path-from"
              label="Départ"
              endpoint={from}
              onChange={setFrom}
              index={index}
              onUseOrigin={pathOrigin ? () => setFrom({ value: formatPoint(pathOrigin), point: pathOrigin }) : null}
            />
            <PathEndpointInput
              id="path-to"
              label="Arrivée"
              endpoint={to}
              onChange={setTo}
              index={index}
              labelAction={
                <button
                  type="button"
                  className="path-swap-button"
                  onClick={handleSwapEndpoints}
                  aria-label="Inverser le départ et l’arrivée"
                  title="Inverser le départ et l’arrivée"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 4v16m0 0-4-4m4 4 4-4M16 20V4m0 0-4 4m4-4 4 4" />
                  </svg>
                </button>
              }
            />
          </div>
          <button type="submit" disabled={!findPath}>Calculer</button>
          {error && <p role="alert">{error}</p>}
          {path.length > 0 && (
            <ol className="path-instructions" aria-label="Étapes de l’itinéraire">
              {getInstructions(path, index).map((instruction, instructionIndex, instructions) => (
                <li
                  key={`${instruction.kind}-${instructionIndex}`}
                  className={`path-step path-step--${instruction.kind}${instructionIndex === instructions.length - 1 ? ' path-step--destination' : ''}`}
                >
                  <span className="path-step-description">
                    {instruction.beforePoint}
                    <Coordinates
                      position={instruction.point}
                      label={`Centrer la vue sur ${formatPoint(instruction.point)}`}
                      className="path-step-coordinate"
                      separator=","
                    />
                    {instruction.afterPoint}
                  </span>
                  {instruction.locationName && (
                    <small className="path-step-location">{instruction.locationName} ({instruction.locationType})</small>
                  )}
                </li>
              ))}
            </ol>
          )}
        </form>
      )}
      {isOpen && calculation && (
        <div className="path-summary" aria-live="polite">
          <span>Coût total : <strong>{calculation.cost}</strong></span>
          {calculation.timings && calculation.stats ? (
            <button
              className="path-summary-toggle"
              type="button"
              aria-expanded={showCalculationDetails}
              aria-controls="path-timing-details"
              onClick={() => setShowCalculationDetails(!showCalculationDetails)}
            >
              Durée totale : <strong>{calculation.durationMs.toFixed(2)} ms</strong>
            </button>
          ) : (
            <span>Durée totale : <strong>{calculation.durationMs.toFixed(2)} ms</strong></span>
          )}
          {calculation.timings && calculation.stats && (
            <div
              className="path-summary-details"
              id="path-timing-details"
              hidden={!showCalculationDetails}
            >
              <span>Appel A* : <strong>{calculation.timings.searchDurationMs.toFixed(2)} ms</strong></span>
              <span>Nœuds explorés : <strong>{calculation.stats.expandedNodes.toLocaleString()}</strong></span>
              <span>Nœuds extraits : <strong>{calculation.stats.poppedNodes.toLocaleString()}</strong></span>
              <span>Extractions obsolètes : <strong>{calculation.stats.stalePops.toLocaleString()}</strong></span>
              <span>Mises à jour : <strong>{calculation.stats.relaxations.toLocaleString()}</strong></span>
              <span>Taille maximale de la file : <strong>{calculation.stats.maxOpenSetSize.toLocaleString()}</strong></span>
              <span>Extrémités de raccourcis : <strong>{calculation.stats.shortcutEndpointCount.toLocaleString()}</strong></span>
              <span>Initialisation du calculateur : <strong>{calculation.timings.pathfinderInitializationDurationMs.toFixed(2)} ms</strong></span>
              <span>Initialisation WASM : <strong>{calculation.timings.wasmInitializationDurationMs.toFixed(2)} ms</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PathFindingPanel;
