export function StatusIndicator({
  status = 'idle',
  label = '',
  size = 'md',
  showLabel = true,
  pulse = false,
  className = ''
}) {
  const statusConfig = {
    online: {
      dot: '●',
      color: 'text-terminal-primary',
      glow: 'text-glow-green',
      text: 'ONLINE'
    },
    offline: {
      dot: '○',
      color: 'text-terminal-muted',
      glow: '',
      text: 'OFFLINE'
    },
    error: {
      dot: '●',
      color: 'text-terminal-red',
      glow: 'text-glow-red',
      text: 'ERROR'
    },
    warning: {
      dot: '●',
      color: 'text-terminal-secondary',
      glow: 'text-glow-amber',
      text: 'WARNING'
    },
    loading: {
      dot: '◐',
      color: 'text-terminal-cyan',
      glow: 'text-glow-cyan',
      text: 'LOADING'
    },
    idle: {
      dot: '○',
      color: 'text-terminal-muted',
      glow: '',
      text: 'IDLE'
    },
    active: {
      dot: '●',
      color: 'text-terminal-primary',
      glow: 'text-glow-green',
      text: 'ACTIVE'
    },
    pending: {
      dot: '◌',
      color: 'text-terminal-secondary',
      glow: '',
      text: 'PENDING'
    }
  }

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  const config = statusConfig[status] || statusConfig.idle
  const sizeClass = sizeClasses[size] || sizeClasses.md
  const displayLabel = label || config.text

  return (
    <span
      className={`inline-flex items-center gap-2 font-mono ${sizeClass} ${className}`}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      <span
        className={`
          ${config.color} ${config.glow}
          ${pulse ? 'animate-pulse' : ''}
        `}
        aria-hidden="true"
      >
        {config.dot}
      </span>
      {showLabel && (
        <span className={`uppercase tracking-terminal-wide ${config.color}`}>
          {displayLabel}
        </span>
      )}
    </span>
  )
}

export function StatusBar({
  items = [],
  separator = '│',
  className = ''
}) {
  return (
    <div
      className={`flex items-center gap-3 font-mono text-sm ${className}`}
      role="status"
      aria-label="System status"
    >
      {items.map((item, index) => (
        <span key={index} className="inline-flex items-center gap-3">
          <StatusIndicator
            status={item.status}
            label={item.label}
            size="sm"
            showLabel={item.showLabel !== false}
            pulse={item.pulse}
          />
          {index < items.length - 1 && (
            <span className="text-terminal-muted" aria-hidden="true">
              {separator}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

export function ProgressGauge({
  value = 0,
  max = 100,
  width = 20,
  label = '',
  showPercentage = true,
  variant = 'default',
  className = ''
}) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))
  const filledBlocks = Math.round((percentage / 100) * width)
  const emptyBlocks = width - filledBlocks

  const getColor = () => {
    if (variant !== 'default') return variant
    if (percentage >= 90) return 'red'
    if (percentage >= 70) return 'amber'
    return 'green'
  }

  const color = getColor()

  const colorClasses = {
    green: 'text-terminal-primary',
    amber: 'text-terminal-secondary',
    red: 'text-terminal-red',
    cyan: 'text-terminal-cyan'
  }

  const textColor = colorClasses[color] || colorClasses.green

  return (
    <div
      className={`font-mono ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label || `Progress: ${Math.round(percentage)}%`}
    >
      {label && (
        <div className="text-terminal-muted text-sm uppercase tracking-terminal-wide mb-1">
          {label}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-terminal-muted" aria-hidden="true">[</span>
        <span className={textColor} aria-hidden="true">
          {'█'.repeat(filledBlocks)}
        </span>
        <span className="text-terminal-muted" aria-hidden="true">
          {'░'.repeat(emptyBlocks)}
        </span>
        <span className="text-terminal-muted" aria-hidden="true">]</span>
        {showPercentage && (
          <span className={`${textColor} min-w-[4ch] text-right`}>
            {Math.round(percentage)}%
          </span>
        )}
      </div>
    </div>
  )
}

export function ActivityIndicator({
  active = false,
  label = '',
  className = ''
}) {
  const frames = ['|', '/', '-', '\\']
  const frameIndex = active ? Math.floor(Date.now() / 100) % frames.length : 0

  return (
    <span
      className={`inline-flex items-center gap-2 font-mono ${className}`}
      role="status"
      aria-label={active ? `${label || 'Processing'}...` : label || 'Idle'}
    >
      <span
        className={active ? 'text-terminal-primary' : 'text-terminal-muted'}
        aria-hidden="true"
      >
        {active ? frames[frameIndex] : '-'}
      </span>
      {label && (
        <span className={active ? 'text-terminal-primary' : 'text-terminal-muted'}>
          {label}
          {active && '...'}
        </span>
      )}
    </span>
  )
}

export default StatusIndicator
