import PropTypes from 'prop-types'

/**
 * TerminalCard - CSS-based retro terminal box component
 *
 * Replaces character-based AsciiBox with pure CSS implementation that:
 * - Is fully responsive (no hardcoded character widths)
 * - Maintains the retro terminal aesthetic with corner decorations
 * - Uses CSS pseudo-elements for box-drawing character corners
 * - Supports all existing color variants and glow effects
 *
 * The corner characters (┌ ┐ └ ┘) are rendered as absolutely positioned
 * pseudo-elements that sit at the corners of CSS borders, giving the
 * appearance of box-drawing characters while remaining fully fluid.
 */
export function TerminalCard({
  title = '',
  children,
  variant = 'default',
  glow = false,
  className = '',
  noPadding = false,
}) {
  const colorConfig = {
    default: {
      border: 'border-terminal-border',
      text: 'text-terminal-muted',
      title: 'text-terminal-muted',
      glow: '',
    },
    green: {
      border: 'border-terminal-primary',
      text: 'text-terminal-primary',
      title: 'text-terminal-secondary',
      glow: 'glow-green',
    },
    amber: {
      border: 'border-terminal-secondary',
      text: 'text-terminal-secondary',
      title: 'text-terminal-secondary',
      glow: 'glow-amber',
    },
    cyan: {
      border: 'border-terminal-cyan',
      text: 'text-terminal-cyan',
      title: 'text-terminal-cyan',
      glow: 'glow-cyan',
    },
    red: {
      border: 'border-terminal-red',
      text: 'text-terminal-red',
      title: 'text-terminal-red',
      glow: 'glow-red',
    },
  }

  const config = colorConfig[variant] || colorConfig.default
  const glowClass = glow ? config.glow : ''

  return (
    <div
      className={`
        terminal-card
        relative
        border
        ${config.border}
        ${glowClass}
        ${className}
      `}
    >
      {/* Corner decorations via CSS */}
      <span
        className={`absolute -top-px -left-px font-mono ${config.text} leading-none select-none pointer-events-none`}
        aria-hidden="true"
      >
        ┌
      </span>
      <span
        className={`absolute -top-px -right-px font-mono ${config.text} leading-none select-none pointer-events-none`}
        aria-hidden="true"
      >
        ┐
      </span>
      <span
        className={`absolute -bottom-px -left-px font-mono ${config.text} leading-none select-none pointer-events-none`}
        aria-hidden="true"
      >
        └
      </span>
      <span
        className={`absolute -bottom-px -right-px font-mono ${config.text} leading-none select-none pointer-events-none`}
        aria-hidden="true"
      >
        ┘
      </span>

      {/* Title badge - positioned on top border */}
      {title && (
        <div
          className={`
            absolute -top-2.5 left-3
            px-2
            bg-terminal-bg-primary
            font-mono text-xs uppercase tracking-wide
            ${config.title}
          `}
        >
          ─ {title} ─
        </div>
      )}

      {/* Content */}
      <div className={noPadding ? '' : 'p-4'}>
        {children}
      </div>
    </div>
  )
}

TerminalCard.propTypes = {
  title: PropTypes.string,
  children: PropTypes.node,
  variant: PropTypes.oneOf(['default', 'green', 'amber', 'cyan', 'red']),
  glow: PropTypes.bool,
  className: PropTypes.string,
  noPadding: PropTypes.bool,
}

/**
 * TerminalDivider - CSS-based horizontal divider
 *
 * Replaces character-repeat dividers with CSS border that:
 * - Naturally spans full width (or specified width)
 * - No character overflow on small screens
 * - Optional label floats in the middle
 */
export function TerminalDivider({
  label = '',
  variant = 'single',
  color = 'muted',
  className = '',
}) {
  const colorClasses = {
    muted: 'border-terminal-border text-terminal-muted',
    green: 'border-terminal-primary text-terminal-primary',
    amber: 'border-terminal-secondary text-terminal-secondary',
    cyan: 'border-terminal-cyan text-terminal-cyan',
    red: 'border-terminal-red text-terminal-red',
  }

  const borderStyles = {
    single: 'border-t',
    double: 'border-t-2',
    dashed: 'border-t border-dashed',
    dotted: 'border-t border-dotted',
  }

  const colorClass = colorClasses[color] || colorClasses.muted
  const borderStyle = borderStyles[variant] || borderStyles.single

  if (label) {
    return (
      <div
        className={`flex items-center gap-3 ${className}`}
        role="separator"
        aria-label={label}
      >
        <div className={`flex-1 ${borderStyle} ${colorClass}`} aria-hidden="true" />
        <span className={`font-mono text-xs uppercase tracking-wide ${colorClass} whitespace-nowrap`}>
          {label}
        </span>
        <div className={`flex-1 ${borderStyle} ${colorClass}`} aria-hidden="true" />
      </div>
    )
  }

  return (
    <div
      className={`${borderStyle} ${colorClass} ${className}`}
      role="separator"
      aria-hidden="true"
    />
  )
}

TerminalDivider.propTypes = {
  label: PropTypes.string,
  variant: PropTypes.oneOf(['single', 'double', 'dashed', 'dotted']),
  color: PropTypes.oneOf(['muted', 'green', 'amber', 'cyan', 'red']),
  className: PropTypes.string,
}

/**
 * TerminalSection - Collapsible section header with CSS-based divider
 *
 * Replaces AsciiSectionDivider with a responsive CSS approach:
 * - No character overflow on small screens
 * - Clean toggle button with accessible states
 * - Optional command flags display
 */
export function TerminalSection({
  title,
  collapsed = false,
  onToggle,
  color = 'amber',
  commandFlags = [],
  showDots = true,
  className = '',
  children,
}) {
  const colorClasses = {
    muted: 'text-terminal-muted border-terminal-muted',
    green: 'text-terminal-primary border-terminal-primary',
    amber: 'text-terminal-secondary border-terminal-secondary',
    cyan: 'text-terminal-cyan border-terminal-cyan',
    red: 'text-terminal-red border-terminal-red',
  }

  const colorClass = colorClasses[color] || colorClasses.amber
  const indicator = collapsed ? '►' : '▼'
  const displayTitle = showDots ? `${title}..` : title

  const header = (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`font-mono ${colorClass}`} aria-hidden="true">
        {indicator}
      </span>
      <span className={`font-mono tracking-wide ${colorClass} whitespace-nowrap`}>
        {displayTitle}
      </span>
      <div className={`flex-1 border-t ${colorClass} opacity-50`} aria-hidden="true" />
    </div>
  )

  return (
    <div>
      {/* Command flags */}
      {commandFlags.length > 0 && (
        <div
          className="text-terminal-ghost text-xs tracking-wide mb-1 select-none"
          aria-hidden="true"
        >
          {commandFlags.join(' ')}
        </div>
      )}

      {/* Header - button or static */}
      {onToggle ? (
        <button
          onClick={onToggle}
          className="w-full text-left hover:opacity-80 transition-opacity"
          aria-expanded={!collapsed}
        >
          {header}
        </button>
      ) : (
        header
      )}

      {/* Collapsible content */}
      {children && !collapsed && (
        <div className="mt-4">
          {children}
        </div>
      )}
    </div>
  )
}

TerminalSection.propTypes = {
  title: PropTypes.string.isRequired,
  collapsed: PropTypes.bool,
  onToggle: PropTypes.func,
  color: PropTypes.oneOf(['muted', 'green', 'amber', 'cyan', 'red']),
  commandFlags: PropTypes.arrayOf(PropTypes.string),
  showDots: PropTypes.bool,
  className: PropTypes.string,
  children: PropTypes.node,
}

/**
 * TerminalModal - CSS-based modal with retro border
 *
 * Replaces hardcoded +-- TITLE --+ patterns with responsive CSS.
 */
export function TerminalModal({
  title,
  variant = 'amber',
  onClose,
  children,
  className = '',
}) {
  const colorClasses = {
    amber: 'border-terminal-secondary text-terminal-secondary',
    green: 'border-terminal-primary text-terminal-primary',
    red: 'border-terminal-red text-terminal-red',
    cyan: 'border-terminal-cyan text-terminal-cyan',
  }

  const colorClass = colorClasses[variant] || colorClasses.amber

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div
        className={`w-full max-w-md ${className}`}
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        {/* Modal container with corners */}
        <div className={`relative border ${colorClass} bg-terminal-bg-secondary`}>
          {/* Corner decorations */}
          <span className={`absolute -top-px -left-px font-mono ${colorClass} leading-none`} aria-hidden="true">┌</span>
          <span className={`absolute -top-px -right-px font-mono ${colorClass} leading-none`} aria-hidden="true">┐</span>
          <span className={`absolute -bottom-px -left-px font-mono ${colorClass} leading-none`} aria-hidden="true">└</span>
          <span className={`absolute -bottom-px -right-px font-mono ${colorClass} leading-none`} aria-hidden="true">┘</span>

          {/* Title bar */}
          {title && (
            <div className={`px-4 py-2 border-b ${colorClass}`}>
              <span id="modal-title" className={`font-mono uppercase tracking-wide ${colorClass}`}>
                ─ {title} ─
              </span>
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

TerminalModal.propTypes = {
  title: PropTypes.string,
  variant: PropTypes.oneOf(['amber', 'green', 'red', 'cyan']),
  onClose: PropTypes.func,
  children: PropTypes.node,
  className: PropTypes.string,
}

export default TerminalCard
