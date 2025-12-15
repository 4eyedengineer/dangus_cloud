import PropTypes from 'prop-types';

/**
 * Terminal-styled button component with variants
 * Variants: primary (green), secondary (amber), danger (red)
 */
const TerminalButton = ({
  children,
  variant = 'primary',
  disabled = false,
  onClick,
  type = 'button',
  className = '',
  ...props
}) => {
  const variantStyles = {
    primary: {
      border: 'border-[var(--color-accent-green)]',
      text: 'text-[var(--color-accent-green)]',
      hover: 'hover:bg-[var(--color-accent-green)] hover:text-[var(--color-bg-primary)] hover:shadow-[var(--glow-green)]',
    },
    secondary: {
      border: 'border-[var(--color-accent-amber)]',
      text: 'text-[var(--color-accent-amber)]',
      hover: 'hover:bg-[var(--color-accent-amber)] hover:text-[var(--color-bg-primary)] hover:shadow-[var(--glow-amber)]',
    },
    danger: {
      border: 'border-[var(--color-accent-red)]',
      text: 'text-[var(--color-accent-red)]',
      hover: 'hover:bg-[var(--color-accent-red)] hover:text-[var(--color-bg-primary)] hover:shadow-[var(--glow-red)]',
    },
  };

  const styles = variantStyles[variant] || variantStyles.primary;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        bg-transparent
        border
        ${styles.border}
        ${styles.text}
        px-4 py-2
        font-mono text-sm
        uppercase
        tracking-[2px]
        cursor-pointer
        transition-all duration-150
        ${!disabled ? styles.hover : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

TerminalButton.propTypes = {
  children: PropTypes.node.isRequired,
  variant: PropTypes.oneOf(['primary', 'secondary', 'danger']),
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  type: PropTypes.oneOf(['button', 'submit', 'reset']),
  className: PropTypes.string,
};

export default TerminalButton;
