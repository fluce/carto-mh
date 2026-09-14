import { useEffect, useState } from 'react';
import { usePathFinding } from './PathFindingContext.mjs';
import { useData } from './DataContext.mjs';

function formatPoint(point) {
  return `${point.x},${point.y},${point.z}`;
}

function parsePoint(value) {
  const coordinates = value.split(',').map(item => Number(item.trim()));
  if (coordinates.length !== 3 || coordinates.some(coordinate => !Number.isInteger(coordinate))) {
    throw new Error('Coordinates must be three integers separated by commas.');
  }
  return { x: coordinates[0], y: coordinates[1], z: coordinates[2] };
}

function formatPointWithLocation(index, point) {
  const locationNames = [...new Set(
    (index?.get(point) ?? [])
      .filter(item => item.type === 'lieux' && item.name)
      .map(item => item.name),
  )];
  const location = locationNames.length > 0 ? ` (${locationNames.join(', ')})` : '';
  return `${formatPoint(point)}${location}`;
}

function formatCost(cost) {
  return cost === 0 ? '' : ` (cost: ${cost})`;
}

function getInstructions(path, index) {
  if (path.length === 0) return [];

  const instructions = [`Start at ${formatPointWithLocation(index, path[0])}`];
  let stepIndex = 1;

  while (stepIndex < path.length) {
    if (path[stepIndex].shortcut) {
      const step = path[stepIndex];
      instructions.push(`Take shortcut to ${formatPointWithLocation(index, step)}${formatCost(step.cost)}`);
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
    instructions.push(`Walk ${walkStepCount} ${walkStepCount === 1 ? 'step' : 'steps'} to ${formatPointWithLocation(index, path[walkEndIndex])}${formatCost(walkCost)}`);
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
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('65,0,0');
  const [error, setError] = useState('');

  useEffect(() => {
    if (pathOrigin) {
      setFrom(formatPoint(pathOrigin));
    }
  }, [pathOrigin]);

  async function handleFind(event) {
    event.preventDefault();
    setError('');

    try {
      const start = parsePoint(from);
      const target = parsePoint(to);
      if (!findPath) {
        throw new Error('Pathfinder is still loading.');
      }
      await findPath(start, target);
    } catch (pathError) {
      setError(pathError.message);
    }
  }

  function toggleOpen() {
    if (!isOpen && selection) {
      setTo(formatPoint(selection));
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
          <label>
            <span>From</span>
            <input
              value={from}
              onChange={event => setFrom(event.target.value)}
              placeholder="x,y,z"
            />
          </label>
          <label>
            <span>To</span>
            <input
              value={to}
              onChange={event => setTo(event.target.value)}
              placeholder="x,y,z"
            />
          </label>
          <button type="submit" disabled={!findPath}>Find</button>
          {error && <p role="alert">{error}</p>}
          {path.length > 0 && (
            <ol className="path-instructions">
              {getInstructions(path, index).map(instruction => (
                <li key={instruction}>{instruction}</li>
              ))}
            </ol>
          )}
        </form>
      )}
    </div>
  );
}

export default PathFindingPanel;
