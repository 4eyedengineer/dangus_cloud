export function AsciiBox({
  title = '',
  children,
  variant = 'default',
  glowColor = 'none',
  className = ''
}) {
  const colorClasses = {
    default: 'text-terminal-muted',
    green: 'text-terminal-primary',
    amber: 'text-terminal-secondary',
    cyan: 'text-terminal-cyan',
    red: 'text-terminal-red'
  }

  const glowClasses = {
    none: '',
    green: 'glow-green',
    amber: 'glow-amber',
    cyan: 'glow-cyan',
    red: 'glow-red'
  }

  const borderColor = colorClasses[variant] || colorClasses.default
  const glowClass = glowClasses[glowColor] || ''

  return (
    <div className={`relative ${glowClass} ${className}`}>
      {/* Top border with optional title */}
      <div
        className={`font-mono whitespace-pre ${borderColor} select-none`}
        aria-hidden="true"
      >
        {title ? (
          <span>
            ┌─ <span className={variant !== 'default' ? borderColor : 'text-terminal-secondary'}>{title}</span> {'─'.repeat(Math.max(0, 40 - title.length - 4))}┐
          </span>
        ) : (
          <span>┌{'─'.repeat(42)}┐</span>
        )}
      </div>

      {/* Content area with side borders */}
      <div className="relative">
        <span
          className={`absolute left-0 top-0 bottom-0 font-mono ${borderColor} select-none`}
          aria-hidden="true"
        >
          │
        </span>
        <div className="px-4 py-2">
          {children}
        </div>
        <span
          className={`absolute right-0 top-0 bottom-0 font-mono ${borderColor} select-none`}
          aria-hidden="true"
        >
          │
        </span>
      </div>

      {/* Bottom border */}
      <div
        className={`font-mono whitespace-pre ${borderColor} select-none`}
        aria-hidden="true"
      >
        └{'─'.repeat(42)}┘
      </div>
    </div>
  )
}

export function AsciiBoxDynamic({
  title = '',
  children,
  variant = 'default',
  glowColor = 'none',
  className = ''
}) {
  const colorClasses = {
    default: 'border-terminal-border',
    green: 'border-terminal-primary',
    amber: 'border-terminal-secondary',
    cyan: 'border-terminal-cyan',
    red: 'border-terminal-red'
  }

  const textColorClasses = {
    default: 'text-terminal-muted',
    green: 'text-terminal-primary',
    amber: 'text-terminal-secondary',
    cyan: 'text-terminal-cyan',
    red: 'text-terminal-red'
  }

  const glowClasses = {
    none: '',
    green: 'glow-green',
    amber: 'glow-amber',
    cyan: 'glow-cyan',
    red: 'glow-red'
  }

  const borderColor = colorClasses[variant] || colorClasses.default
  const textColor = textColorClasses[variant] || textColorClasses.default
  const glowClass = glowClasses[glowColor] || ''

  return (
    <div
      className={`
        relative border ${borderColor} ${glowClass}
        before:content-['┌'] before:absolute before:-top-[1px] before:-left-[1px] before:${textColor} before:bg-terminal-primary before:leading-none
        after:content-['┐'] after:absolute after:-top-[1px] after:-right-[1px] after:${textColor} after:bg-terminal-primary after:leading-none
        ${className}
      `}
    >
      {title && (
        <div
          className={`absolute -top-3 left-4 px-2 bg-terminal-primary text-terminal-secondary font-mono text-sm`}
        >
          {title}
        </div>
      )}
      <div
        className={`
          absolute -bottom-[1px] -left-[1px] ${textColor} font-mono leading-none
        `}
        aria-hidden="true"
      >
        └
      </div>
      <div
        className={`
          absolute -bottom-[1px] -right-[1px] ${textColor} font-mono leading-none
        `}
        aria-hidden="true"
      >
        ┘
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

export default AsciiBox
