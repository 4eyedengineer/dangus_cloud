import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * Terminal-styled input component with prompt prefix and blinking cursor animation
 */
const TerminalInput = ({
  value,
  onChange,
  placeholder = 'Enter text...',
  disabled = false,
  type = 'text',
  name,
  id,
  className = '',
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div
      className={`
        relative flex items-center
        bg-[var(--color-bg-secondary)]
        border border-[var(--color-border)]
        transition-all duration-150
        ${isFocused ? 'border-[var(--color-accent-green)] shadow-[var(--glow-green)]' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
    >
      <span className="text-[var(--color-text-muted)] px-2 select-none font-mono">
        {'>'}
      </span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        name={name}
        id={id}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`
          flex-1 bg-transparent
          text-[var(--color-text-primary)]
          font-mono text-sm
          py-2 pr-3
          outline-none
          placeholder:text-[var(--color-text-muted)]
          disabled:cursor-not-allowed
          ${isFocused ? 'caret-[var(--color-accent-green)]' : ''}
        `}
        style={{
          caretColor: 'var(--color-accent-green)',
        }}
        {...props}
      />
      {isFocused && (
        <span
          className="absolute right-3 w-2 h-4 bg-[var(--color-accent-green)] animate-pulse"
          style={{
            animation: 'blink 1s step-end infinite',
          }}
        />
      )}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

TerminalInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  placeholder: PropTypes.string,
  disabled: PropTypes.bool,
  type: PropTypes.string,
  name: PropTypes.string,
  id: PropTypes.string,
  className: PropTypes.string,
};

export default TerminalInput;
