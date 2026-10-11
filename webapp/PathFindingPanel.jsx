import { useEffect, useState } from 'react';
import { usePathFinding } from './PathFindingContext.mjs';
import { useData } from './DataContext.mjs';

function formatPoint(point) {
  return `${point.x},${point.y},${point.z}`;
}

function parsePoint(value) {
  const coordinates = value.split(',').map(item => Number(item.trim()));
  if (coordinates.length !== 3 || coordinates.some(coordinate => !Number.isInteger(coordinate))) {
    throw new Error('Choose a suggestion or enter three integers separated by commas.');
  }
  return { x: coordinates[0], y: coordinates[1], z: coordinates[2] };
}

function formatSuggestion(item) {
  let category = 'Monster';
  if (item.kind.includes('location')) {
    category = 'Location';
  } else if (item.kind.includes('troll')) {
    category = 'Troll';
  }
  return `${item.name} (${formatPoint(item)}) [${category}]`;
}

function PathEndpointInput({ id, label, endpoint, onChange, index, onUseOrigin }) {
  const isCoordinate = /^\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*$/.test(endpoint.value);
  const suggestions = isCoordinate ? [] : (index?.search(endpoint.value, 10) ?? []);
  const suggestionsByLabel = new Map(suggestions.map(item => [formatSuggestion(item), item]));

  function handleChange(event) {
    const value = event.target.value;
    const selected = suggestionsByLabel.get(value);
    onChange({ value, point: selected ? { x: selected.x, y: selected.y, z: selected.z } : null });
  }

  return (
    <label className="path-endpoint">
      <span>{label}</span>
      <div className="path-endpoint-control">
        <div className="path-endpoint-input">
          <input
            list={`${id}-suggestions`}
            value={endpoint.value}
            onChange={handleChange}
            placeholder="Name or x,y,z"
          />
          <datalist id={`${id}-suggestions`}>
            {suggestions.map(item => (
              <option key={`${item.id}-${item.type}`} value={formatSuggestion(item)} />
            ))}
          </datalist>
          {endpoint.value && (
            <button
              className="path-clear-button"
              type="button"
              onClick={() => onChange({ value: '', point: null })}
              title={`Clear ${label}`}
              aria-label={`Clear ${label}`}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          )}
        </div>
        {onUseOrigin && (
          <button
            className="path-origin-button"
            type="button"
            onClick={onUseOrigin}
            title="Use current position (Origin)"
            aria-label="Use current position (Origin)"
          >
            <svg className="path-origin-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm8.94 3A9.994 9.994 0 0 0 13 3.06V1h-2v2.06A9.994 9.994 0 0 0 3.06 11H1v2h2.06A9.994 9.994 0 0 0 11 20.94V23h2v-2.06A9.994 9.994 0 0 0 20.94 13H23v-2h-2.06ZM12 19a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
            </svg>
          </button>
        )}
      </div>
    </label>
  );
}

function getLocationInfo(index, point) {
  const locations = (index?.get(point) ?? [])
    .filter(item => item.kind?.includes('location') || item.type === 'lieux');
  const names = [...new Set(locations.map(item => item.name).filter(Boolean))];
  return {
    name: names.join(', '),
    isTgv: locations.some(item => item.transportNetwork === 'tgv'),
  };
}

function formatCost(cost) {
  return cost === 0 ? '' : ` (cost: ${cost})`;
}

function getInstructions(path, index) {
  if (path.length === 0) return [];

  const startLocation = getLocationInfo(index, path[0]);
  const instructions = [{
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
  const [from, setFrom] = useState({ value: '', point: null });
  const [to, setTo] = useState({ value: '65,0,0', point: null });
  const [error, setError] = useState('');
  const [calculation, setCalculation] = useState(null);

  useEffect(() => {
    if (pathOrigin) {
      setFrom({ value: formatPoint(pathOrigin), point: pathOrigin });
    }
  }, [pathOrigin]);

  async function handleFind(event) {
    event.preventDefault();
    setError('');
    setCalculation(null);

    try {
      const start = from.point ?? parsePoint(from.value);
      const target = to.point ?? parsePoint(to.value);
      if (!findPath) {
        throw new Error('Pathfinder is still loading.');
      }
      const startedAt = performance.now();
      const result = await findPath(start, target);
      setCalculation({ cost: result.cost, durationMs: performance.now() - startedAt });
    } catch (pathError) {
      setError(pathError.message);
    }
  }

  function toggleOpen() {
    if (!isOpen && selection) {
      setTo({ value: formatPoint(selection), point: selection });
    }
    setIsOpen(!isOpen);
  }

  function handleNetworkChange(event) {
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
        <div className="path-summary" role="status">
          <span>Total cost: <strong>{calculation.cost}</strong></span>
          <span>Calculation: <strong>{calculation.durationMs.toFixed(2)} ms</strong></span>
        </div>
      )}
    </div>
  );
}

export default PathFindingPanel;
