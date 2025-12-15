export function TerminalProgress({
  value = 0,
  max = 100,
  width = 16,
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
    <span
      className={`font-mono inline-flex items-center ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`Progress: ${Math.round(percentage)}%`}
    >
      <span className="text-terminal-muted" aria-hidden="true">[</span>
      <span className={textColor} aria-hidden="true">
        {'█'.repeat(filledBlocks)}
      </span>
      <span className="text-terminal-muted" aria-hidden="true">
        {'░'.repeat(emptyBlocks)}
      </span>
      <span className="text-terminal-muted" aria-hidden="true">]</span>
      {showPercentage && (
        <span className={`${textColor} ml-1`}>
          {Math.round(percentage)}%
        </span>
      )}
    </span>
  )
}

export default TerminalProgress
