import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { usePathFinding } from './PathFindingContext.ts';
import { useData } from './DataContext.ts';
import PathEndpointInput from './PathEndpointInput.tsx';
import type { GeoIndex } from './types';
import type { PathStep, Point3D, SearchStats, PathTimings } from './types';

interface PathEndpoint {
  value: string;
  point: Point3D | null;
}

interface PathInstruction {
  kind: 'start' | 'tgv' | 'shortcut' | 'walk';
  text: string;
  locationName: string;
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
    throw new Error('Choose a suggestion or enter three integers separated by commas.');
  }
  return { x: coordinates[0], y: coordinates[1], z: coordinates[2] };
}

function getLocationInfo(index: GeoIndex | null, point: Point3D) {
  const locations = (index?.get(point) ?? [])
    .filter(item => item.kind?.includes('location') || item.type === 'lieux');
  const names = [...new Set(locations.map(item => item.name).filter(Boolean))];
  return {
    name: names.join(', '),
    isTgv: locations.some(item => item.transportNetwork === 'tgv'),
  };
}

function formatCost(cost: number) {
  return cost === 0 ? '' : ` (cost: ${cost})`;
}

function getInstructions(path: PathStep[], index: GeoIndex | null): PathInstruction[] {
  if (path.length === 0) return [];

  const startLocation = getLocationInfo(index, path[0]);
  const instructions: PathInstruction[] = [{
    kind: 'start',
    text: `Start at ${formatPoint(path[0])}`,
    locationName: startLocation.name,
  }];
  let stepIndex = 1;

  while (stepIndex < path.length) {
    if (path[stepIndex].shortcut) {
      const step = path[stepIndex];
      const destination = getLocationInfo(index, step);
      instructions.push({
        kind: destination.isTgv ? 'tgv' : 'shortcut',
        text: `Take ${destination.isTgv ? 'TGV' : 'shortcut'} to ${formatPoint(step)}${formatCost(step.cost)}`,
        locationName: destination.name,
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
      text: `Walk ${walkStepCount} ${walkStepCount === 1 ? 'step' : 'steps'} to ${formatPoint(path[walkEndIndex])}${formatCost(walkCost)}`,
      locationName: destination.name,
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

  function handleNetworkChange(event: ChangeEvent<HTMLSelectElement>) {
    const selectedNetworks = [...event.target.selectedOptions].map(option => option.value);
    setShortcutNetwork(selectedNetworks.includes('all') ? ['all'] : selectedNetworks);
  }

  return (
    <div id="path-finding-panel" className={isOpen ? 'open' : ''}>
      <button type="button" onClick={toggleOpen}>
        {isOpen ? 'Close pathfinder' : 'Find path'}
      </button>
      {isOpen && (
        <form onSubmit={handleFind}>
          <label>
            <span>Shortcut network</span>
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
          <PathEndpointInput
            id="path-from"
            label="From"
            endpoint={from}
            onChange={setFrom}
            index={index}
            onUseOrigin={pathOrigin ? () => setFrom({ value: formatPoint(pathOrigin), point: pathOrigin }) : null}
          />
          <PathEndpointInput
            id="path-to"
            label="To"
            endpoint={to}
            onChange={setTo}
            index={index}
          />
          <button type="submit" disabled={!findPath}>Find</button>
          {error && <p role="alert">{error}</p>}
          {path.length > 0 && (
            <ol className="path-instructions" aria-label="Journey steps">
              {getInstructions(path, index).map((instruction, instructionIndex, instructions) => (
                <li
                  key={`${instruction.kind}-${instructionIndex}`}
                  className={`path-step path-step--${instruction.kind}${instructionIndex === instructions.length - 1 ? ' path-step--destination' : ''}`}
                >
                  <span className="path-step-description">{instruction.text}</span>
                  {instruction.locationName && (
                    <small className="path-step-location">{instruction.locationName}</small>
                  )}
                </li>
              ))}
            </ol>
          )}
        </form>
      )}
      {isOpen && calculation && (
        <div className="path-summary" aria-live="polite">
          <span>Total cost: <strong>{calculation.cost}</strong></span>
          {calculation.timings && calculation.stats ? (
            <button
              className="path-summary-toggle"
              type="button"
              aria-expanded={showCalculationDetails}
              aria-controls="path-timing-details"
              onClick={() => setShowCalculationDetails(!showCalculationDetails)}
            >
              Total time: <strong>{calculation.durationMs.toFixed(2)} ms</strong>
            </button>
          ) : (
            <span>Total time: <strong>{calculation.durationMs.toFixed(2)} ms</strong></span>
          )}
          {calculation.timings && calculation.stats && (
            <div
              className="path-summary-details"
              id="path-timing-details"
              hidden={!showCalculationDetails}
            >
              <span>A* call: <strong>{calculation.timings.searchDurationMs.toFixed(2)} ms</strong></span>
              <span>Expanded nodes: <strong>{calculation.stats.expandedNodes.toLocaleString()}</strong></span>
              <span>Popped nodes: <strong>{calculation.stats.poppedNodes.toLocaleString()}</strong></span>
              <span>Stale pops: <strong>{calculation.stats.stalePops.toLocaleString()}</strong></span>
              <span>Relaxations: <strong>{calculation.stats.relaxations.toLocaleString()}</strong></span>
              <span>Peak queue: <strong>{calculation.stats.maxOpenSetSize.toLocaleString()}</strong></span>
              <span>Shortcut endpoints: <strong>{calculation.stats.shortcutEndpointCount.toLocaleString()}</strong></span>
              <span>Pathfinder setup: <strong>{calculation.timings.pathfinderInitializationDurationMs.toFixed(2)} ms</strong></span>
              <span>WASM init: <strong>{calculation.timings.wasmInitializationDurationMs.toFixed(2)} ms</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PathFindingPanel;
