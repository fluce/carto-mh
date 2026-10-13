import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import './DualRangeSlider.css';

interface DualRangeSliderProps {
  min: number;
  max: number;
  step?: number;
  lowerValue: number;
  upperValue: number;
  lowerLabel: string;
  upperLabel: string;
  formatLowerValue?: (value: number) => string;
  formatUpperValue?: (value: number) => string;
  onChange: (lowerValue: number, upperValue: number) => void;
}

type SliderThumb = 'lower' | 'upper';

function DualRangeSlider({
  min,
  max,
  step = 1,
  lowerValue,
  upperValue,
  lowerLabel,
  upperLabel,
  formatLowerValue = value => String(value),
  formatUpperValue = value => String(value),
  onChange,
}: DualRangeSliderProps) {
  const sliderRef = useRef<HTMLDivElement>(null);
  const activeThumb = useRef<SliderThumb | null>(null);
  const [frontThumb, setFrontThumb] = useState<SliderThumb>('lower');
  const range = max - min;

  const updateFromPointer = (thumb: SliderThumb, clientX: number) => {
    const bounds = sliderRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0 || range <= 0) return;

    const rawValue = min + ((clientX - bounds.left) / bounds.width) * range;
    const value = min + Math.round((Math.max(min, Math.min(max, rawValue)) - min) / step) * step;
    if (thumb === 'lower') {
      onChange(Math.min(value, upperValue), upperValue);
    } else {
      onChange(lowerValue, Math.max(value, lowerValue));
    }
  };

  const handleThumbPointerDown = (thumb: SliderThumb, event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    activeThumb.current = thumb;
    setFrontThumb(thumb);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleTrackPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('[data-slider-thumb]')) return;
    const bounds = sliderRef.current?.getBoundingClientRect();
    if (!bounds || bounds.width === 0) return;

    const value = min + ((event.clientX - bounds.left) / bounds.width) * range;
    const thumb = Math.abs(value - lowerValue) <= Math.abs(value - upperValue) ? 'lower' : 'upper';
    activeThumb.current = thumb;
    setFrontThumb(thumb);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateFromPointer(thumb, event.clientX);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (activeThumb.current) {
      updateFromPointer(activeThumb.current, event.clientX);
    }
  };

  const handleKeyDown = (thumb: SliderThumb, event: KeyboardEvent<HTMLDivElement>) => {
    const current = thumb === 'lower' ? lowerValue : upperValue;
    const lowerLimit = thumb === 'lower' ? min : lowerValue;
    const upperLimit = thumb === 'lower' ? upperValue : max;
    let next: number;

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = current + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current - step;
        break;
      case 'PageUp':
        next = current + step * 10;
        break;
      case 'PageDown':
        next = current - step * 10;
        break;
      case 'Home':
        next = lowerLimit;
        break;
      case 'End':
        next = upperLimit;
        break;
      default:
        return;
    }

    event.preventDefault();
    setFrontThumb(thumb);
    if (thumb === 'lower') {
      onChange(Math.max(min, Math.min(next, upperValue)), upperValue);
    } else {
      onChange(lowerValue, Math.max(lowerValue, Math.min(next, max)));
    }
  };

  const renderThumb = (thumb: SliderThumb, value: number) => {
    const isLower = thumb === 'lower';
    return (
      <div
        className="dual-range-slider__thumb"
        data-slider-thumb={thumb}
        role="slider"
        tabIndex={0}
        aria-label={isLower ? lowerLabel : upperLabel}
        aria-valuemin={isLower ? min : lowerValue}
        aria-valuemax={isLower ? upperValue : max}
        aria-valuenow={value}
        aria-valuetext={(isLower ? formatLowerValue : formatUpperValue)(value)}
        style={{ left: `${((value - min) / range) * 100}%`, zIndex: frontThumb === thumb ? 2 : 1 }}
        onFocus={() => setFrontThumb(thumb)}
        onKeyDown={event => handleKeyDown(thumb, event)}
        onPointerDown={event => handleThumbPointerDown(thumb, event)}
      />
    );
  };

  return (
    <div className="dual-range-slider__container">
      <output className="dual-range-slider__values" aria-live="polite">
        <span>{formatLowerValue(lowerValue)}</span>
        <span aria-hidden="true">–</span>
        <span>{formatUpperValue(upperValue)}</span>
      </output>
      <div
        className="dual-range-slider"
        ref={sliderRef}
        onPointerDown={handleTrackPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => { activeThumb.current = null; }}
        onPointerCancel={() => { activeThumb.current = null; }}
      >
        <div className="dual-range-slider__track" aria-hidden="true" />
        <div
          className="dual-range-slider__selection"
          aria-hidden="true"
          style={{
            left: `${((lowerValue - min) / range) * 100}%`,
            right: `${((max - upperValue) / range) * 100}%`,
          }}
        />
        {renderThumb('lower', lowerValue)}
        {renderThumb('upper', upperValue)}
      </div>
    </div>
  );
}

export default DualRangeSlider;