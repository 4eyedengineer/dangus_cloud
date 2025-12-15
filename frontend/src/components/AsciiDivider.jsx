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
  className = ''
}) {
  const colorClasses = {
    muted: 'text-terminal-muted',
    green: 'text-terminal-primary',
    amber: 'text-terminal-secondary',
    cyan: 'text-terminal-cyan',
    red: 'text-terminal-red'
  }

  const textColor = colorClasses[color] || colorClasses.amber
  const indicator = collapsed ? '►' : '▼'

  if (onToggle) {
    return (
      <button
        onClick={onToggle}
        className={`
          flex items-center gap-2 w-full text-left font-mono ${textColor}
          hover:text-glow-amber transition-terminal-base ${className}
        `}
        aria-expanded={!collapsed}
      >
        <span aria-hidden="true">{indicator}</span>
        <span className="uppercase tracking-terminal-wide">{title}</span>
        <span
          className="flex-1 overflow-hidden text-terminal-muted select-none"
          aria-hidden="true"
        >
          {'─'.repeat(100)}
        </span>
      </button>
    )
  }

  return (
    <div className={`flex items-center gap-2 font-mono ${textColor} ${className}`}>
      <span aria-hidden="true">{indicator}</span>
      <span className="uppercase tracking-terminal-wide">{title}</span>
      <span
        className="flex-1 overflow-hidden text-terminal-muted select-none"
        aria-hidden="true"
      >
        {'─'.repeat(100)}
      </span>
    </div>
  )
}

export default AsciiDivider
