import PropTypes from 'prop-types';

/**
 * Terminal-styled toggle component with [ ON ] / [OFF] style
 */
const TerminalToggle = ({
  checked = false,
  onChange,
  disabled = false,
  name,
  id,
  label,
  className = '',
}) => {
  const handleClick = () => {
    if (!disabled && onChange) {
      onChange({ target: { name, checked: !checked } });
    }
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        id={id}
        className={`
          font-mono text-sm
          px-2 py-1
          border
          transition-all duration-150
          ${checked
            ? 'border-[var(--color-accent-green)] text-[var(--color-accent-green)] shadow-[var(--glow-green)]'
            : 'border-[var(--color-border)] text-[var(--color-text-muted)]'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-[var(--color-accent-green)]'}
        `}
      >
        {checked ? '[ ON ]' : '[OFF]'}
      </button>
      {label && (
        <label
          htmlFor={id}
          className={`
            font-mono text-sm cursor-pointer
            ${checked ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}
            ${disabled ? 'cursor-not-allowed' : ''}
          `}
          onClick={handleClick}
        >
          {label}
        </label>
      )}
    </div>
  );
};

TerminalToggle.propTypes = {
  checked: PropTypes.bool,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  name: PropTypes.string,
  id: PropTypes.string,
  label: PropTypes.string,
  className: PropTypes.string,
};

export default TerminalToggle;
