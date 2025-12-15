import PropTypes from 'prop-types';

/**
 * Terminal-styled slider component for storage allocation
 * Displays: [████████░░░░] 8 GB
 */
const TerminalSlider = ({
  value = 1,
  onChange,
  min = 1,
  max = 10,
  step = 1,
  unit = 'GB',
  disabled = false,
  name,
  id,
  label,
  className = '',
}) => {
  const totalBars = 12;
  const filledBars = Math.round(((value - min) / (max - min)) * totalBars);
  const emptyBars = totalBars - filledBars;

  const progressDisplay = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

  const handleChange = (event) => {
    const newValue = Number(event.target.value);
    onChange?.({ target: { name, value: newValue } });
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    let newValue = value;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        newValue = Math.min(value + step, max);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        newValue = Math.max(value - step, min);
        break;
      case 'Home':
        event.preventDefault();
        newValue = min;
        break;
      case 'End':
        event.preventDefault();
        newValue = max;
        break;
      default:
        return;
    }

    if (newValue !== value) {
      onChange?.({ target: { name, value: newValue } });
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="font-mono text-sm text-[var(--color-text-muted)]"
        >
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <div
          className={`
            font-mono text-sm
            px-2 py-1
            border border-[var(--color-border)]
            bg-[var(--color-bg-secondary)]
            ${disabled ? 'opacity-50' : ''}
          `}
        >
          <span className="text-[var(--color-accent-green)]">[</span>
          <span className="text-[var(--color-accent-green)]">{progressDisplay}</span>
          <span className="text-[var(--color-accent-green)]">]</span>
        </div>
        <span className="font-mono text-sm text-[var(--color-text-primary)] min-w-[60px]">
          {value} {unit}
        </span>
      </div>
      <input
        type="range"
        id={id}
        name={name}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          w-full h-1
          appearance-none
          bg-[var(--color-border)]
          cursor-pointer
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3
          [&::-webkit-slider-thumb]:bg-[var(--color-accent-green)]
          [&::-webkit-slider-thumb]:border-none
          [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-[var(--glow-green)]
          [&::-moz-range-thumb]:w-3
          [&::-moz-range-thumb]:h-3
          [&::-moz-range-thumb]:bg-[var(--color-accent-green)]
          [&::-moz-range-thumb]:border-none
          [&::-moz-range-thumb]:cursor-pointer
          [&::-moz-range-thumb]:shadow-[var(--glow-green)]
        `}
      />
      <div className="flex justify-between font-mono text-xs text-[var(--color-text-muted)]">
        <span>{min} {unit}</span>
        <span>{max} {unit}</span>
      </div>
    </div>
  );
};

TerminalSlider.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func,
  min: PropTypes.number,
  max: PropTypes.number,
  step: PropTypes.number,
  unit: PropTypes.string,
  disabled: PropTypes.bool,
  name: PropTypes.string,
  id: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
};

export default TerminalSlider;
