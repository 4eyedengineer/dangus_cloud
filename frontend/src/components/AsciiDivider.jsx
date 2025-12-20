export function AsciiDivider({
  variant = 'single',
  label = '',
  labelPosition = 'center',
  color = 'muted',
  width = 'full',
  className = ''
}) {
  const colorClasses = {
    muted: 'text-terminal-muted',
    green: 'text-terminal-primary',
    amber: 'text-terminal-secondary',
    cyan: 'text-terminal-cyan',
    red: 'text-terminal-red'
  }

  const widthClasses = {
    full: 'w-full',
    '3/4': 'w-3/4',
    '1/2': 'w-1/2',
    '1/4': 'w-1/4'
  }

  const patterns = {
    single: '─',
    double: '═',
    dashed: '┄',
    dotted: '·',
    mixed: '─·─',
    thick: '━',
    wave: '∼'
  }

  const textColor = colorClasses[color] || colorClasses.muted
  const widthClass = widthClasses[width] || widthClasses.full
  const pattern = patterns[variant] || patterns.single

  const justifyClass = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end'
  }[labelPosition] || 'justify-center'

  if (label) {
    return (
      <div
        className={`flex items-center ${widthClass} ${className}`}
        role="separator"
        aria-label={label}
      >
        <div
          className={`flex-1 font-mono ${textColor} overflow-hidden select-none`}
          aria-hidden="true"
        >
          {pattern.repeat(50)}
        </div>
        <span className={`px-3 font-mono text-sm uppercase tracking-terminal-wide ${textColor}`}>
          {label}
        </span>
        <div
          className={`flex-1 font-mono ${textColor} overflow-hidden select-none`}
          aria-hidden="true"
        >
          {pattern.repeat(50)}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`font-mono ${textColor} overflow-hidden ${widthClass} select-none ${className}`}
      role="separator"
      aria-hidden="true"
    >
      {pattern.repeat(200)}
    </div>
  )
}

export function AsciiSectionDivider({
  title,
  collapsed = false,
  onToggle,
  color = 'amber',
  commandFlags = [],
  indicatorStyle = 'arrow', // 'arrow' (►/▼) or 'caret' (^)
  showTrailingDots = true,
  showLeftBorder = false,
  className = ''
}) {
  const colorClasses = {
    muted: 'text-terminal-muted',
    green: 'text-terminal-primary',
    amber: 'text-terminal-secondary',
    cyan: 'text-terminal-cyan',
    red: 'text-terminal-red'
  }

  const borderColorClasses = {
    muted: 'border-terminal-muted',
    green: 'border-terminal-primary',
    amber: 'border-terminal-secondary',
    cyan: 'border-terminal-cyan',
    red: 'border-terminal-red'
  }

  const textColor = colorClasses[color] || colorClasses.amber
  const borderColor = borderColorClasses[color] || borderColorClasses.amber

  // v2 indicators: ^ for expandable hint, ► for collapsed, ▼ for expanded
  const getIndicator = () => {
    if (indicatorStyle === 'caret') {
      return '^'
    }
    return collapsed ? '►' : '▼'
  }

  const indicator = getIndicator()
  const displayTitle = showTrailingDots ? `${title}..` : title

  // Render command flags if provided
  const renderFlags = () => {
    if (!commandFlags || commandFlags.length === 0) return null
    return (
      <div
        className="text-terminal-ghost text-[0.85em] tracking-[0.5px] mb-1 select-none"
        aria-hidden="true"
      >
        {commandFlags.join(' ')}
      </div>
    )
  }

  const wrapperClass = showLeftBorder
    ? `border-l-2 ${borderColor} pl-2`
    : ''

  if (onToggle) {
    return (
      <div className={wrapperClass}>
        {renderFlags()}
        <button
          onClick={onToggle}
          className={`
            flex items-center gap-2 w-full text-left font-mono ${textColor}
            hover:text-glow-amber transition-terminal-fast ${className}
          `}
          aria-expanded={!collapsed}
        >
          <span aria-hidden="true">{indicator}</span>
          <span className="tracking-terminal-wide">{displayTitle}</span>
          <span
            className="flex-1 overflow-hidden text-terminal-muted select-none"
            aria-hidden="true"
          >
            {'─'.repeat(100)}
          </span>
        </button>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      {renderFlags()}
      <div className={`flex items-center gap-2 font-mono ${textColor} ${className}`}>
        <span aria-hidden="true">{indicator}</span>
        <span className="tracking-terminal-wide">{displayTitle}</span>
        <span
          className="flex-1 overflow-hidden text-terminal-muted select-none"
          aria-hidden="true"
        >
          {'─'.repeat(100)}
        </span>
      </div>
    </div>
  )
}

export default AsciiDivider
