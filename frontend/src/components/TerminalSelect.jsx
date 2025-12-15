import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * Terminal-styled select/dropdown component with arrow indicator
 */
const TerminalSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  name,
  id,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const selectRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange?.({ target: { name, value: optionValue } });
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (disabled) return;

    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        setIsOpen(!isOpen);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          const currentIndex = options.findIndex((opt) => opt.value === value);
          const nextIndex = Math.min(currentIndex + 1, options.length - 1);
          handleSelect(options[nextIndex].value);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (isOpen) {
          const currentIndex = options.findIndex((opt) => opt.value === value);
          const prevIndex = Math.max(currentIndex - 1, 0);
          handleSelect(options[prevIndex].value);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div
      ref={selectRef}
      className={`relative ${className}`}
      id={id}
    >
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => !isOpen && setIsFocused(false)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between
          bg-[var(--color-bg-secondary)]
          border border-[var(--color-border)]
          text-left
          px-3 py-2
          font-mono text-sm
          transition-all duration-150
          ${isFocused || isOpen ? 'border-[var(--color-accent-green)] shadow-[var(--glow-green)]' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span className={selectedOption ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-[var(--color-text-muted)] ml-2">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div
          className="
            absolute z-50 w-full mt-1
            bg-[var(--color-bg-secondary)]
            border border-[var(--color-accent-green)]
            shadow-[var(--glow-green)]
            max-h-48 overflow-y-auto
          "
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`
                w-full text-left px-3 py-2
                font-mono text-sm
                transition-colors duration-100
                ${option.value === value
                  ? 'bg-[var(--color-accent-green)] text-[var(--color-bg-primary)]'
                  : 'text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]'
                }
              `}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

TerminalSelect.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  name: PropTypes.string,
  id: PropTypes.string,
  className: PropTypes.string,
};

export default TerminalSelect;
