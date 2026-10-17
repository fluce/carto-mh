import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ChangeEvent, CSSProperties, Dispatch, KeyboardEvent, ReactNode, SetStateAction } from 'react';
import type { GeoIndex, Point3D, SearchableItem } from '../../shared/types';

interface PathEndpoint {
  value: string;
  point: Point3D | null;
}

interface SuggestionPosition {
  style: Omit<CSSProperties, 'left' | 'top' | 'width' | 'maxHeight'> & {
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  };
  visibleSuggestionCount: number;
  openAbove: boolean;
}

interface PathEndpointInputProps {
  id: string;
  label: string;
  endpoint: PathEndpoint;
  onChange: Dispatch<SetStateAction<PathEndpoint>>;
  index: GeoIndex | null;
  onUseOrigin?: (() => void) | null;
  labelAction?: ReactNode;
}

function isCoordinateInput(value: string) {
  return /^\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*$/.test(value);
}

function formatPoint(point: Point3D) {
  return `${point.x},${point.y},${point.z}`;
}

function formatSuggestion(item: SearchableItem) {
  let category = 'Monstre';
  if (item.kind.includes('location')) {
    category = 'Lieu';
  } else if (item.kind.includes('troll')) {
    category = 'Troll';
  }
  return `${item.name} (${formatPoint(item)}) [${category}]`;
}

function PathEndpointInput({ id, label, endpoint, onChange, index, onUseOrigin, labelAction }: PathEndpointInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCoordinate = isCoordinateInput(endpoint.value);
  const suggestions = isCoordinate ? [] : (index?.search(endpoint.value, 10) ?? []);
  const [areSuggestionsOpen, setAreSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [suggestionPosition, setSuggestionPosition] = useState<SuggestionPosition | null>(null);
  const showSuggestions = areSuggestionsOpen && endpoint.value.trim() !== '' && suggestions.length > 0;

  useLayoutEffect(() => {
    if (!showSuggestions) {
      setSuggestionPosition(null);
      return undefined;
    }

    function updateSuggestionPosition() {
      const inputBounds = inputRef.current?.getBoundingClientRect();
      if (!inputBounds) return;

      const viewportPadding = 8;
      const availableBelow = window.innerHeight - inputBounds.bottom - viewportPadding;
      const availableAbove = inputBounds.top - viewportPadding;
      const openAbove = availableBelow < suggestions.length * 56 && availableAbove > availableBelow;
      const availableSpace = openAbove ? availableAbove : availableBelow;
      const maxHeight = Math.max(48, Math.min(320, availableSpace - 4));

      setSuggestionPosition({
        style: {
          left: Math.max(viewportPadding, Math.min(inputBounds.left, window.innerWidth - inputBounds.width - viewportPadding)),
          top: openAbove ? inputBounds.top - maxHeight - 4 : inputBounds.bottom + 4,
          width: inputBounds.width,
          maxHeight,
        },
        visibleSuggestionCount: Math.max(1, Math.min(suggestions.length, Math.floor(maxHeight / 56))),
        openAbove,
      });
    }

    updateSuggestionPosition();
    window.addEventListener('resize', updateSuggestionPosition);
    window.addEventListener('scroll', updateSuggestionPosition, true);
    return () => {
      window.removeEventListener('resize', updateSuggestionPosition);
      window.removeEventListener('scroll', updateSuggestionPosition, true);
    };
  }, [showSuggestions, endpoint.value]);

  useLayoutEffect(() => {
    if (!showSuggestions || !suggestionPosition) return;

    const inputBounds = inputRef.current?.getBoundingClientRect();
    const popup = document.getElementById(`${id}-suggestions`);
    if (!inputBounds || !popup) return;

    const top = suggestionPosition.openAbove
      ? inputBounds.top - popup.getBoundingClientRect().height - 4
      : inputBounds.bottom + 4;
    if (Math.abs(top - suggestionPosition.style.top) > 1) {
      setSuggestionPosition(current => current ? ({
        ...current,
        style: { ...current.style, top },
      }) : current);
    }
  }, [id, showSuggestions, suggestionPosition]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    onChange({ value, point: null });
    setAreSuggestionsOpen(value.trim() !== '' && !isCoordinateInput(value));
    setActiveSuggestionIndex(-1);
  }

  function selectSuggestion(item: SearchableItem) {
    onChange({
      value: formatSuggestion(item),
      point: { x: item.x, y: item.y, z: item.z },
    });
    setAreSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions) {
      if (event.key === 'Escape') setAreSuggestionsOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex(current => Math.min(current + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex(current => Math.max(current - 1, 0));
    } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      selectSuggestion(suggestions[activeSuggestionIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setAreSuggestionsOpen(false);
      setActiveSuggestionIndex(-1);
    }
  }

  return (
    <label className="path-endpoint">
      <div className="path-endpoint-label">
        <span>{label}</span>
        {labelAction}
      </div>
      <div className="path-endpoint-control">
        <div className="path-endpoint-input">
          <input
            ref={inputRef}
            value={endpoint.value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={() => setAreSuggestionsOpen(endpoint.value.trim() !== '' && !isCoordinate)}
            onBlur={() => setAreSuggestionsOpen(false)}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
            aria-controls={`${id}-suggestions`}
            aria-activedescendant={activeSuggestionIndex >= 0 ? `${id}-suggestion-${activeSuggestionIndex}` : undefined}
            placeholder="Nom ou x,y,z"
          />
          {showSuggestions && suggestionPosition && createPortal(
            <div
              className="path-endpoint-suggestions"
              id={`${id}-suggestions`}
              role="listbox"
              style={suggestionPosition.style}
            >
              {suggestions.slice(0, suggestionPosition.visibleSuggestionCount).map((item, suggestionIndex) => (
                <button
                  key={`${item.id}-${item.type}`}
                  id={`${id}-suggestion-${suggestionIndex}`}
                  className="path-endpoint-suggestion"
                  type="button"
                  role="option"
                  aria-selected={suggestionIndex === activeSuggestionIndex}
                  tabIndex={-1}
                  onPointerDown={event => event.preventDefault()}
                  onClick={() => selectSuggestion(item)}
                >
                  {formatSuggestion(item)}
                </button>
              ))}
            </div>,
            document.body,
          )}
          {endpoint.value && (
            <button
              className="path-clear-button"
              type="button"
              onClick={() => onChange({ value: '', point: null })}
              title={`Effacer ${label}`}
              aria-label={`Effacer ${label}`}
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
            title="Utiliser la position actuelle (origine)"
            aria-label="Utiliser la position actuelle (origine)"
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

export default PathEndpointInput;