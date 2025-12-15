import { useState, useEffect } from 'react'

export function TerminalStatus({
  status = 'idle',
  children,
  animate = true,
  className = ''
}) {
  const [dots, setDots] = useState('')

  useEffect(() => {
    if (!animate) {
      setDots('')
      return
    }

    const interval = setInterval(() => {
      setDots((prev) => {
        if (prev.length >= 3) return ''
        return prev + '.'
      })
    }, 400)

    return () => clearInterval(interval)
  }, [animate])

  const statusConfig = {
    idle: {
      label: 'IDLE',
      color: 'text-terminal-muted'
    },
    building: {
      label: 'BUILDING',
      color: 'text-terminal-secondary text-glow-amber'
    },
    running: {
      label: 'RUNNING',
      color: 'text-terminal-primary text-glow-green'
    },
    error: {
      label: 'ERROR',
      color: 'text-terminal-red text-glow-red'
    },
    success: {
      label: 'SUCCESS',
      color: 'text-terminal-primary text-glow-green'
    },
    loading: {
      label: 'LOADING',
      color: 'text-terminal-cyan text-glow-cyan'
    },
    pending: {
      label: 'PENDING',
      color: 'text-terminal-secondary'
    },
    deploying: {
      label: 'DEPLOYING',
      color: 'text-terminal-cyan text-glow-cyan'
    }
  }

  const config = statusConfig[status] || statusConfig.idle

  return (
    <span
      className={`font-mono uppercase tracking-wider ${className}`}
      role="status"
      aria-label={`${config.label}: ${children || ''}`}
    >
      <span className={config.color}>
        {config.label}:
      </span>
      {children && (
        <span className="text-terminal-primary ml-2">
          {children}
          {animate && <span className="inline-block w-[3ch]">{dots}</span>}
        </span>
      )}
    </span>
  )
}

export default TerminalStatus
